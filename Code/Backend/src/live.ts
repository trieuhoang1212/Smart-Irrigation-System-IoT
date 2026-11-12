import type { WebSocket, WebSocketServer } from "ws";
import { ZONE_IDS, type Telemetry } from "./domain.js";
import { getZoneSettings } from "./zone-settings-repository.js";
import {
  loadAllLatestTelemetry,
  resolveCommand,
  saveTelemetry,
} from "./telemetry-repository.js";
import type { MqttGateway } from "./mqtt-gateway.js";

const DEVICE_TIMEOUT_MS = 6000;
const HISTORY_WRITE_INTERVAL_MS = 10_000;
const THRESHOLD_SYNC_COOLDOWN_MS = 10_000;

const latestByDevice = new Map<string, Telemetry>();
const onlineByDevice = new Map<string, boolean>();
const lastLiveAtByDevice = new Map<string, number>();
const lastHistoryWriteByDevice = new Map<string, number>();
const lastThresholdSyncAt = new Map<string, number>();

type PendingCommand = {
  id: string;
  deviceId: string;
  command: string;
  expiresAt: number;
};
const pendingCommands = new Map<string, PendingCommand>();

type LiveSocket = WebSocket & { isAlive?: boolean };

let webSockets: WebSocketServer | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let deviceWatchdog: ReturnType<typeof setInterval> | null = null;
let commandWatchdog: ReturnType<typeof setInterval> | null = null;
let unsubscribeTelemetry: (() => void) | null = null;

export function getLatestTelemetry(deviceId: string): Telemetry | undefined {
  return latestByDevice.get(deviceId);
}

export function getLiveStats() {
  return {
    devices: latestByDevice.size,
    onlineDevices: Array.from(onlineByDevice.values()).filter(Boolean).length,
  };
}

export function trackCommand(commandId: string, deviceId: string, command: string) {
  pendingCommands.set(commandId, {
    id: commandId,
    deviceId,
    command,
    expiresAt: Date.now() + DEVICE_TIMEOUT_MS * 2,
  });
}

function broadcast(payload: unknown) {
  if (!webSockets) return;
  const message = JSON.stringify(payload);
  webSockets.clients.forEach((socket: LiveSocket) => {
    if (socket.readyState === socket.OPEN) socket.send(message);
  });
}

function resyncThresholds(telemetry: Telemetry, gateway: MqttGateway) {
  const settings = getZoneSettings(telemetry.deviceId);
  if (settings.length === 0) return;

  const byZone = new Map(
    settings.map((setting) => [setting.zoneId as string, setting]),
  );
  const now = Date.now();

  for (const zone of telemetry.zones) {
    const setting = byZone.get(zone.id);
    if (!setting || setting.threshold === zone.threshold) continue;

    const key = `${telemetry.deviceId}:${zone.id}`;
    if (now - (lastThresholdSyncAt.get(key) ?? 0) < THRESHOLD_SYNC_COOLDOWN_MS) continue;
    lastThresholdSyncAt.set(key, now);

    const command = `SET_THRESHOLD_${zone.id}_${Math.round(setting.threshold)}`;
    void gateway.publish(command).catch((error) => {
      console.error(
        `Threshold resync failed (${zone.id}):`,
        error instanceof Error ? error.message : error,
      );
    });
    console.log(`Threshold resync ${zone.id}: ${zone.threshold} -> ${setting.threshold}`);
  }
}

function commandMatchesTelemetry(command: string, telemetry: Telemetry): boolean {
  if (command === "MODE_AUTO") return telemetry.mode === "auto";
  if (command === "MODE_MANUAL") return telemetry.mode === "manual";
  if (command === "WEATHER_GATE_ON") return telemetry.weatherGate;
  if (command === "WEATHER_GATE_OFF") return !telemetry.weatherGate;
  // Firmware chỉ nhận lệnh bơm toàn vườn ở chế độ manual.
  if (command === "PUMP_ON") return telemetry.mode === "manual" && telemetry.zones.every((zone) => zone.pump);
  if (command === "PUMP_OFF") return telemetry.mode === "manual" && telemetry.zones.every((zone) => !zone.pump);

  const zonePattern = ZONE_IDS.join("|");
  const pump = command.match(new RegExp(`^(PUMP_ON|PUMP_OFF)_(${zonePattern})$`));
  if (pump) return telemetry.zones.find((zone) => zone.id === pump[2])?.pump === (pump[1] === "PUMP_ON");

  const threshold = command.match(new RegExp(`^SET_THRESHOLD_(${zonePattern})_(\\d{1,3})$`));
  if (threshold) return telemetry.zones.find((zone) => zone.id === threshold[1])?.threshold === Number(threshold[2]);

  return false;
}

function confirmPendingCommands(telemetry: Telemetry) {
  pendingCommands.forEach((pending, commandId) => {
    if (pending.deviceId !== telemetry.deviceId || !commandMatchesTelemetry(pending.command, telemetry)) return;
    pendingCommands.delete(commandId);
    resolveCommand(commandId, "confirmed");
    broadcast({ type: "command-result", commandId, deviceId: pending.deviceId, status: "confirmed" });
  });
}

export function startLive(ws: WebSocketServer, gateway: MqttGateway) {
  webSockets = ws;

  // Khôi phục snapshot mới nhất sau restart; chưa chứng minh thiết bị đang online.
  for (const telemetry of loadAllLatestTelemetry()) {
    latestByDevice.set(telemetry.deviceId, telemetry);
    onlineByDevice.set(telemetry.deviceId, false);
  }

  ws.on("connection", (socket: LiveSocket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    socket.on("error", (error) => console.error("WebSocket error:", error.message));

    latestByDevice.forEach((telemetry, deviceId) => {
      socket.send(
        JSON.stringify({
          type: "telemetry",
          data: telemetry,
          online: onlineByDevice.get(deviceId) ?? false,
        }),
      );
      socket.send(
        JSON.stringify({
          type: "device-status",
          deviceId,
          online: onlineByDevice.get(deviceId) ?? false,
        }),
      );
    });
  });

  heartbeat = setInterval(() => {
    ws.clients.forEach((socket: LiveSocket) => {
      if (socket.isAlive === false) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);
  heartbeat.unref();

  ws.on("close", () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
  });

  unsubscribeTelemetry = gateway.onTelemetry((telemetry, meta) => {
    const deviceId = telemetry.deviceId;
    const wasKnown = latestByDevice.has(deviceId);
    latestByDevice.set(deviceId, telemetry);

    // Live state vẫn 2s/lần, nhưng history chỉ ghi 10s/lần cho nhẹ DB.
    // Retained chỉ là snapshot cũ nên không ghi vào history để khỏi lệch chart.
    const now = Date.now();
    const lastSavedAt = lastHistoryWriteByDevice.get(deviceId) ?? 0;
    if (!meta.retained && now - lastSavedAt >= HISTORY_WRITE_INTERVAL_MS) {
      try {
        saveTelemetry(telemetry);
        lastHistoryWriteByDevice.set(deviceId, now);
      } catch (error) {
        console.error("Failed to persist telemetry:", error instanceof Error ? error.message : error);
      }
    }

    resyncThresholds(telemetry, gateway);

    if (meta.retained) {
      // Retained message chỉ là snapshot cuối, không chứng minh thiết bị đang chạy.
      if (!onlineByDevice.has(deviceId)) onlineByDevice.set(deviceId, false);
    } else {
      lastLiveAtByDevice.set(deviceId, now);
      if (!onlineByDevice.get(deviceId)) {
        onlineByDevice.set(deviceId, true);
        broadcast({ type: "device-status", deviceId, online: true });
      }
      if (!wasKnown) console.log(`Live telemetry from ${deviceId}`);
    }

    broadcast({
      type: "telemetry",
      data: telemetry,
      online: onlineByDevice.get(deviceId) ?? false,
    });
    confirmPendingCommands(telemetry);
  });

  deviceWatchdog = setInterval(() => {
    const now = Date.now();
    onlineByDevice.forEach((online, deviceId) => {
      if (!online) return;
      const lastLiveAt = lastLiveAtByDevice.get(deviceId) ?? 0;
      if (now - lastLiveAt <= DEVICE_TIMEOUT_MS) return;

      onlineByDevice.set(deviceId, false);
      console.log(`Device ${deviceId} offline (no live telemetry)`);
      broadcast({ type: "device-status", deviceId, online: false });
    });
  }, 2000);
  deviceWatchdog.unref();

  commandWatchdog = setInterval(() => {
    const now = Date.now();
    pendingCommands.forEach((pending, commandId) => {
      if (pending.expiresAt > now) return;
      pendingCommands.delete(commandId);
      resolveCommand(commandId, "timeout");
      broadcast({ type: "command-result", commandId, deviceId: pending.deviceId, status: "timeout" });
    });
  }, 1000);
  commandWatchdog.unref();
}

export function stopLive() {
  if (heartbeat) clearInterval(heartbeat);
  if (deviceWatchdog) clearInterval(deviceWatchdog);
  if (commandWatchdog) clearInterval(commandWatchdog);
  heartbeat = null;
  deviceWatchdog = null;
  commandWatchdog = null;
  unsubscribeTelemetry?.();
  unsubscribeTelemetry = null;
  webSockets = null;
}
