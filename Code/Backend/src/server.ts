import cors from "cors";
import { randomUUID } from "node:crypto";
import express from "express";
import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { config } from "./config.js";
import { closeDatabase, databaseFile } from "./db.js";
import { type CommandRequest, type Telemetry, toMqttCommand } from "./domain.js";
import { MqttGateway } from "./mqtt-gateway.js";
import { gardenConfig } from "./garden-config.js";
import {
  getTelemetryHistory,
  listCommands,
  loadAllLatestTelemetry,
  logCommand,
  pruneHistory,
  resolveCommand,
  saveTelemetry,
} from "./telemetry-repository.js";
import {
  clampThreshold,
  deriveStopThreshold,
  getZoneSettings,
  isZoneId,
  listZoneSettingChanges,
  saveZoneSetting,
  seedZoneSettings,
} from "./zone-settings-repository.js";

const DEVICE_TIMEOUT_MS = 6000;
const latestByDevice = new Map<string, Telemetry>();
const onlineByDevice = new Map<string, boolean>();
const lastLiveAtByDevice = new Map<string, number>();
type PendingCommand = {
  id: string;
  deviceId: string;
  command: string;
  expiresAt: number;
};
const pendingCommands = new Map<string, PendingCommand>();

// Tạo ngưỡng mặc định trong DB cho zone chưa từng được lưu.
seedZoneSettings(gardenConfig.deviceId, gardenConfig.zones);

// Khôi phục snapshot mới nhất sau restart; chưa chứng minh thiết bị đang online.
for (const telemetry of loadAllLatestTelemetry()) {
  latestByDevice.set(telemetry.deviceId, telemetry);
  onlineByDevice.set(telemetry.deviceId, false);
}

const gateway = new MqttGateway();
const app = express();
const server = http.createServer(app);
const webSockets = new WebSocketServer({ server, path: "/realtime" });

type LiveSocket = WebSocket & { isAlive?: boolean };

app.use(cors({ origin: config.webOrigin }));
app.use(express.json({ limit: "16kb" }));

function broadcast(payload: unknown) {
  const message = JSON.stringify(payload);
  webSockets.clients.forEach((socket: LiveSocket) => {
    if (socket.readyState === socket.OPEN) socket.send(message);
  });
}

/** gardenConfig gốc + ngưỡng đã lưu trong DB (DB là nguồn cấu hình thật). */
function buildDeviceConfig(deviceId: string) {
  const settings = new Map(
    getZoneSettings(deviceId).map((setting) => [setting.zoneId as string, setting]),
  );

  return {
    ...gardenConfig,
    zones: gardenConfig.zones.map((zone) => {
      const setting = settings.get(zone.id);
      return setting
        ? { ...zone, threshold: setting.threshold, stopThreshold: setting.stopThreshold }
        : zone;
    }),
  };
}

const THRESHOLD_SYNC_COOLDOWN_MS = 10_000;
const lastThresholdSyncAt = new Map<string, number>();

/**
 * Firmware có thể reboot và quay về ngưỡng mặc định. Khi telemetry báo ngưỡng
 * khác DB, gửi lại SET_THRESHOLD (có cooldown để tránh spam mỗi 2 giây).
 */
function resyncThresholds(telemetry: Telemetry) {
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
  if (command === "PUMP_ON") return telemetry.pump;
  if (command === "PUMP_OFF") return !telemetry.pump;

  const pump = command.match(/^(PUMP_ON|PUMP_OFF)_(T00[1-6])$/);
  if (pump) return telemetry.zones.find((zone) => zone.id === pump[2])?.pump === (pump[1] === "PUMP_ON");

  const threshold = command.match(/^SET_THRESHOLD_(T00[1-6])_(\d{1,3})$/);
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

webSockets.on("connection", (socket: LiveSocket) => {
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

const heartbeat = setInterval(() => {
  webSockets.clients.forEach((socket: LiveSocket) => {
    if (socket.isAlive === false) {
      socket.terminate();
      return;
    }
    socket.isAlive = false;
    socket.ping();
  });
}, 30000);
heartbeat.unref();

webSockets.on("close", () => clearInterval(heartbeat));

gateway.onTelemetry((telemetry, meta) => {
  const deviceId = telemetry.deviceId;
  const wasKnown = latestByDevice.has(deviceId);
  latestByDevice.set(deviceId, telemetry);

  try {
    saveTelemetry(telemetry);
  } catch (error) {
    console.error("Failed to persist telemetry:", error instanceof Error ? error.message : error);
  }

  resyncThresholds(telemetry);

  if (meta.retained) {
    // Retained message chỉ là snapshot cuối, không chứng minh thiết bị đang chạy.
    if (!onlineByDevice.has(deviceId)) onlineByDevice.set(deviceId, false);
  } else {
    lastLiveAtByDevice.set(deviceId, Date.now());
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

const deviceWatchdog = setInterval(() => {
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

function queryNumber(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    mqtt: gateway.connected,
    database: { driver: "sqlite", file: databaseFile },
    devices: latestByDevice.size,
    onlineDevices: Array.from(onlineByDevice.values()).filter(Boolean).length,
    realtimeClients: webSockets.clients.size,
  });
});

app.get("/api/config", (_request, response) => {
  response.json(buildDeviceConfig(gardenConfig.deviceId));
});

app.get("/api/devices/:deviceId/config", (request, response) => {
  if (request.params.deviceId !== gardenConfig.deviceId) {
    response.status(404).json({ error: "Device config not found" });
    return;
  }
  response.json(buildDeviceConfig(request.params.deviceId));
});

app.get("/api/devices/:deviceId/config/changes", (request, response) => {
  const limit = queryNumber(request.query.limit);
  response.json({
    deviceId: request.params.deviceId,
    changes: listZoneSettingChanges(request.params.deviceId, limit),
  });
});

app.put("/api/devices/:deviceId/config/zones/:zoneId", async (request, response) => {
  const { deviceId, zoneId } = request.params;
  if (deviceId !== gardenConfig.deviceId) {
    response.status(404).json({ error: "Device not found" });
    return;
  }
  if (!isZoneId(zoneId) || !gardenConfig.zones.some((zone) => zone.id === zoneId)) {
    response.status(404).json({ error: "Zone not found" });
    return;
  }

  const body = request.body as { threshold?: unknown };
  const numeric = Number(body.threshold);
  if (!Number.isFinite(numeric)) {
    response.status(400).json({ error: "threshold must be a number" });
    return;
  }

  const threshold = clampThreshold(numeric);
  const stopThreshold = deriveStopThreshold(threshold);
  const setting = saveZoneSetting(deviceId, zoneId, threshold, stopThreshold);

  let appliedRemotely = false;
  try {
    await gateway.publish(`SET_THRESHOLD_${zoneId}_${threshold}`);
    appliedRemotely = true;
  } catch (error) {
    console.error(
      "Threshold saved but MQTT publish failed:",
      error instanceof Error ? error.message : error,
    );
  }

  response.json({ ...setting, appliedRemotely });
});

app.get("/api/devices/:deviceId/telemetry/latest", (request, response) => {
  const telemetry = latestByDevice.get(request.params.deviceId);
  if (!telemetry) {
    response.status(404).json({ error: "Telemetry not available" });
    return;
  }
  response.json(telemetry);
});

app.get("/api/devices/:deviceId/telemetry/history", (request, response) => {
  const to = queryNumber(request.query.to) ?? Date.now();
  const from = queryNumber(request.query.from) ?? to - 24 * 60 * 60 * 1000;
  const limit = queryNumber(request.query.limit);
  const bucketMs = queryNumber(request.query.bucketMs);
  const zoneId = typeof request.query.zoneId === "string" ? request.query.zoneId : undefined;

  const samples = getTelemetryHistory({
    deviceId: request.params.deviceId,
    zoneId,
    from,
    to,
    limit,
    bucketMs,
  });

  response.json({
    deviceId: request.params.deviceId,
    zoneId: zoneId ?? null,
    from,
    to,
    bucketMs: bucketMs ?? null,
    count: samples.length,
    samples,
  });
});

app.get("/api/devices/:deviceId/commands", (request, response) => {
  const limit = queryNumber(request.query.limit);
  response.json({
    deviceId: request.params.deviceId,
    commands: listCommands(request.params.deviceId, limit),
  });
});

app.post("/api/devices/:deviceId/commands", async (request, response) => {
  if (request.params.deviceId !== gardenConfig.deviceId) {
    response.status(404).json({ error: "Device not found" });
    return;
  }
  const commandRequest = request.body as CommandRequest;
  const command = toMqttCommand(commandRequest);
  if (!command) {
    response.status(400).json({ error: "Invalid command or zoneId" });
    return;
  }

  // Lưu ngay ngưỡng mới để cấu hình không mất khi restart, kể cả khi MQTT lỗi.
  if (
    commandRequest.action === "SET_THRESHOLD" &&
    commandRequest.zoneId &&
    isZoneId(commandRequest.zoneId)
  ) {
    const threshold = clampThreshold(Number(commandRequest.value));
    saveZoneSetting(
      request.params.deviceId,
      commandRequest.zoneId,
      threshold,
      deriveStopThreshold(threshold),
    );
  }

  const commandId = randomUUID();
  const sentAt = new Date().toISOString();

  try {
    await gateway.publish(command);
  } catch (error) {
    console.error("MQTT command failed:", error);
    response.status(503).json({ error: "MQTT unavailable" });
    return;
  }

  pendingCommands.set(commandId, {
    id: commandId,
    deviceId: request.params.deviceId,
    command,
    expiresAt: Date.now() + DEVICE_TIMEOUT_MS * 2,
  });

  try {
    logCommand(commandId, request.params.deviceId, command);
  } catch (error) {
    console.error("Failed to log command:", error instanceof Error ? error.message : error);
  }

  response.status(202).json({
    accepted: true,
    commandId,
    deviceId: request.params.deviceId,
    command,
    sentAt,
  });
});

const commandWatchdog = setInterval(() => {
  const now = Date.now();
  pendingCommands.forEach((pending, commandId) => {
    if (pending.expiresAt > now) return;
    pendingCommands.delete(commandId);
    resolveCommand(commandId, "timeout");
    broadcast({ type: "command-result", commandId, deviceId: pending.deviceId, status: "timeout" });
  });
}, 1000);
commandWatchdog.unref();

try {
  const removed = pruneHistory(config.dbRetentionDays);
  if (removed > 0) {
    console.log(`Pruned ${removed} telemetry samples older than ${config.dbRetentionDays} days`);
  }
} catch (error) {
  console.error("Failed to prune old telemetry:", error instanceof Error ? error.message : error);
}

const retentionTimer = setInterval(() => {
  try {
    pruneHistory(config.dbRetentionDays);
  } catch (error) {
    console.error("Failed to prune old telemetry:", error instanceof Error ? error.message : error);
  }
}, 24 * 60 * 60 * 1000);
retentionTimer.unref();

server.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
  console.log(`SQLite database: ${databaseFile}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  clearInterval(deviceWatchdog);
  clearInterval(commandWatchdog);
  clearInterval(retentionTimer);
  gateway.close();
  webSockets.close();
  server.close(() => {
    try {
      closeDatabase();
    } catch (error) {
      console.error("Failed to close database:", error instanceof Error ? error.message : error);
    }
    process.exit(0);
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
