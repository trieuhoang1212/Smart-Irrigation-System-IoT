import type { WebSocket, WebSocketServer } from "ws";
import { ZONE_IDS, targetSecondsFor, type Telemetry } from "./domain.js";
import { getZoneSettings } from "./zone-settings-repository.js";
import { getGardenRainThreshold } from "./garden-settings-repository.js";
import {
  loadAllLatestTelemetry,
  resolveCommand,
  saveTelemetry,
} from "./telemetry-repository.js";
import type { MqttGateway } from "./mqtt-gateway.js";
import { sendPushToDevice, type PushPayload } from "./push.js";

const DEVICE_TIMEOUT_MS = 6000;
const HISTORY_WRITE_INTERVAL_MS = 10_000;
// Không gửi lại cùng một cấu hình xuống thiết bị quá dày.
const SYNC_COOLDOWN_MS = 10_000;

// Cùng một cảnh báo chỉ đẩy về điện thoại một lần trong khoảng này.
const OFFLINE_ALERT_COOLDOWN_MS = 5 * 60_000;
const ENVIRONMENT_ALERT_COOLDOWN_MS = 30 * 60_000;

const latestByDevice = new Map<string, Telemetry>();
const onlineByDevice = new Map<string, boolean>();
const lastLiveAtByDevice = new Map<string, number>();
const lastHistoryWriteByDevice = new Map<string, number>();
const lastThresholdSyncAt = new Map<string, number>();
const lastTargetSyncAt = new Map<string, number>();
const lastFlowSyncAt = new Map<string, number>();
const lastRainThresholdSyncAt = new Map<string, number>();
const lastAlertAt = new Map<string, number>();

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

function notify(deviceId: string, kind: string, cooldownMs: number, payload: PushPayload) {
  const key = `${deviceId}:${kind}`;
  const now = Date.now();
  if (now - (lastAlertAt.get(key) ?? 0) < cooldownMs) return;
  lastAlertAt.set(key, now);

  void sendPushToDevice(deviceId, payload).catch((error) => {
    console.error(
      "Push notification failed:",
      error instanceof Error ? error.message : error,
    );
  });
}

// Chỉ báo khi trạng thái đổi từ bình thường sang bất thường, tránh lặp mỗi 2 giây.
function notifyTelemetryChanges(previous: Telemetry, current: Telemetry) {
  const deviceId = current.deviceId;

  if (!previous.raining && current.raining && current.weatherGate) {
    notify(deviceId, "rain", ENVIRONMENT_ALERT_COOLDOWN_MS, {
      title: "Trời bắt đầu mưa",
      body: "Hệ thống đã tạm hoãn tưới tự động để tránh tưới thừa.",
      data: { type: "rain", deviceId },
    });
  }

  if (!previous.tank.empty && current.tank.empty) {
    notify(deviceId, "tank", ENVIRONMENT_ALERT_COOLDOWN_MS, {
      title: "Bồn nước đã cạn",
      body: "Tưới tự động dừng cho đến khi bồn có nước trở lại.",
      data: { type: "tank", deviceId },
    });
  }
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
    if (now - (lastThresholdSyncAt.get(key) ?? 0) < SYNC_COOLDOWN_MS) continue;
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

function resyncTargets(telemetry: Telemetry, gateway: MqttGateway) {
  const settings = getZoneSettings(telemetry.deviceId);
  if (settings.length === 0) return;

  const byZone = new Map(
    settings.map((setting) => [setting.zoneId as string, setting]),
  );
  const now = Date.now();

  for (const zone of telemetry.zones) {
    // Firmware cũ chưa gửi mục tiêu; không đẩy lệnh lặp lại ngoài ý muốn.
    if (zone.targetSeconds === undefined) continue;
    const setting = byZone.get(zone.id);
    if (!setting) continue;

    const targetSeconds = targetSecondsFor(setting.flowLitersPerHour, setting.targetLiters);
    if (zone.targetSeconds === targetSeconds) continue;

    const key = `${telemetry.deviceId}:${zone.id}`;
    if (now - (lastTargetSyncAt.get(key) ?? 0) < SYNC_COOLDOWN_MS) continue;
    lastTargetSyncAt.set(key, now);

    const command = `SET_TARGET_${zone.id}_${targetSeconds}`;
    void gateway.publish(command).catch((error) => {
      console.error(
        `Target resync failed (${zone.id}):`,
        error instanceof Error ? error.message : error,
      );
    });
    console.log(`Target resync ${zone.id}: ${zone.targetSeconds ?? 0} -> ${targetSeconds}s`);
  }
}

function resyncFlows(telemetry: Telemetry, gateway: MqttGateway) {
  const settings = getZoneSettings(telemetry.deviceId);
  if (settings.length === 0) return;

  const byZone = new Map(
    settings.map((setting) => [setting.zoneId as string, setting]),
  );
  const now = Date.now();

  for (const zone of telemetry.zones) {
    // Firmware cũ chưa gửi lưu lượng; không đẩy lệnh để tránh đổi hành vi ngoài ý muốn.
    if (zone.flowLph === undefined) continue;
    const setting = byZone.get(zone.id);
    if (!setting || setting.flowLitersPerHour === null) continue;
    if (setting.flowLitersPerHour === zone.flowLph) continue;

    const key = `${telemetry.deviceId}:${zone.id}`;
    if (now - (lastFlowSyncAt.get(key) ?? 0) < SYNC_COOLDOWN_MS) continue;
    lastFlowSyncAt.set(key, now);

    const command = `SET_FLOW_${zone.id}_${setting.flowLitersPerHour}`;
    void gateway.publish(command).catch((error) => {
      console.error(
        `Flow resync failed (${zone.id}):`,
        error instanceof Error ? error.message : error,
      );
    });
    console.log(`Flow resync ${zone.id}: ${zone.flowLph} -> ${setting.flowLitersPerHour} L/h`);
  }
}

function resyncRainThreshold(telemetry: Telemetry, gateway: MqttGateway) {
  // Firmware cũ chưa gửi ngưỡng mưa; không đẩy lệnh để tránh đổi hành vi ngoài ý muốn.
  if (telemetry.rainThreshold === undefined) return;

  const stored = getGardenRainThreshold(telemetry.deviceId);
  if (stored === telemetry.rainThreshold) return;

  const now = Date.now();
  if (now - (lastRainThresholdSyncAt.get(telemetry.deviceId) ?? 0) < SYNC_COOLDOWN_MS) {
    return;
  }
  lastRainThresholdSyncAt.set(telemetry.deviceId, now);

  void gateway.publish(`SET_RAIN_THRESHOLD_${stored}`).catch((error) => {
    console.error(
      "Rain threshold resync failed:",
      error instanceof Error ? error.message : error,
    );
  });
  console.log(`Rain threshold resync: ${telemetry.rainThreshold} -> ${stored}`);
}

function restoreSoilAfterReboot(
  previous: Telemetry | undefined,
  current: Telemetry,
  gateway: MqttGateway,
) {
  if (!previous || current.uptimeMs === undefined || previous.uptimeMs === undefined) {
    return;
  }

  // Uptime là số 32-bit nên sau ~49,7 ngày sẽ quay về 0; đó không phải reboot.
  const wrapped = previous.uptimeMs > 0xffff0000 && current.uptimeMs < 0x00010000;
  if (wrapped || current.uptimeMs + 5000 >= previous.uptimeMs) return;

  for (const zone of previous.zones) {
    const command = `SET_SOIL_${zone.id}_${Math.round(zone.moisture)}`;
    void gateway.publish(command).catch((error) => {
      console.error(
        `Soil restore failed (${zone.id}):`,
        error instanceof Error ? error.message : error,
      );
    });
  }
  console.log(
    `Device reboot detected (${previous.uptimeMs} -> ${current.uptimeMs} ms); restoring soil state`,
  );
}

function commandMatchesTelemetry(command: string, telemetry: Telemetry): boolean {
  if (command === "MODE_AUTO") return telemetry.mode === "auto";
  if (command === "MODE_MANUAL") return telemetry.mode === "manual";
  if (command === "WEATHER_GATE_ON") return telemetry.weatherGate;
  if (command === "WEATHER_GATE_OFF") return !telemetry.weatherGate;
  // Firmware chỉ nhận lệnh bơm ở chế độ manual; hết nước/khoá 10 phút có thể chặn bơm
  // nên chỉ xác nhận thiết bị đã nhận lệnh, không đòi hỏi mọi vùng phải chạy.
  if (command === "PUMP_ON" || command === "PUMP_OFF") return telemetry.mode === "manual";

  const zonePattern = ZONE_IDS.join("|");
  const pump = command.match(new RegExp(`^(PUMP_ON|PUMP_OFF)_(${zonePattern})$`));
  if (pump) return telemetry.mode === "manual";

  const threshold = command.match(new RegExp(`^SET_THRESHOLD_(${zonePattern})_(\\d{1,3})$`));
  if (threshold) return telemetry.zones.find((zone) => zone.id === threshold[1])?.threshold === Number(threshold[2]);

  const target = command.match(new RegExp(`^SET_TARGET_(${zonePattern})_(\\d{1,3})$`));
  if (target) return telemetry.zones.find((zone) => zone.id === target[1])?.targetSeconds === Number(target[2]);

  const flow = command.match(new RegExp(`^SET_FLOW_(${zonePattern})_(\\d{1,3})$`));
  if (flow) return telemetry.zones.find((zone) => zone.id === flow[1])?.flowLph === Number(flow[2]);

  const rainThreshold = command.match(/^SET_RAIN_THRESHOLD_(\d{1,3})$/);
  if (rainThreshold) return telemetry.rainThreshold === Number(rainThreshold[1]);

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
    const previousTelemetry = latestByDevice.get(deviceId);
    if (!meta.retained) restoreSoilAfterReboot(previousTelemetry, telemetry, gateway);
    latestByDevice.set(deviceId, telemetry);

    if (!meta.retained && previousTelemetry) {
      notifyTelemetryChanges(previousTelemetry, telemetry);
    }

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

    // Retained telemetry chỉ là snapshot cũ, không dùng để gửi lệnh:
    // ESP32 có thể đang offline nên command MQTT sẽ bị mất.
    // Chờ telemetry live kế tiếp để chắc chắn thiết bị đã online và nhận lệnh.
    if (!meta.retained) {
      resyncThresholds(telemetry, gateway);
      resyncTargets(telemetry, gateway);
      resyncFlows(telemetry, gateway);
      resyncRainThreshold(telemetry, gateway);
    }

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
    // Retained chỉ là snapshot cũ nên không dùng để xác nhận lệnh vừa gửi.
    if (!meta.retained) confirmPendingCommands(telemetry);
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
      notify(deviceId, "offline", OFFLINE_ALERT_COOLDOWN_MS, {
        title: "Vườn mất kết nối",
        body: "Không nhận dữ liệu từ thiết bị. Kiểm tra nguồn và Wi-Fi.",
        data: { type: "offline", deviceId },
      });
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
