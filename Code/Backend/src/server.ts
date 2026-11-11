import cors from "cors";
import { randomUUID } from "node:crypto";
import express from "express";
import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { config } from "./config.js";
import { closeDatabase, databaseFile, db } from "./db.js";
import { type CommandRequest, type Telemetry, ZONE_IDS, toMqttCommand } from "./domain.js";
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
  timeoutStaleCommands,
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
const HISTORY_WRITE_INTERVAL_MS = 10_000;
const latestByDevice = new Map<string, Telemetry>();
const onlineByDevice = new Map<string, boolean>();
const lastLiveAtByDevice = new Map<string, number>();
const lastHistoryWriteByDevice = new Map<string, number>();
type PendingCommand = {
  id: string;
  deviceId: string;
  command: string;
  expiresAt: number;
};
const pendingCommands = new Map<string, PendingCommand>();

// Tạo ngưỡng mặc định trong DB cho zone chưa từng được lưu.
seedZoneSettings(gardenConfig.deviceId, gardenConfig.zones);

// Lệnh pending chỉ nằm trong RAM; restart xong thì không còn ai xác nhận nữa.
const staleCommands = timeoutStaleCommands();
if (staleCommands > 0) console.log(`Marked ${staleCommands} stale commands as timeout`);

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

// Một nguồn device ID duy nhất; route nào có :deviceId đều trả 404 như nhau.
app.param("deviceId", (_request, response, next, value: string) => {
  if (value !== gardenConfig.deviceId) {
    response.status(404).json({ error: "Device not found" });
    return;
  }
  next();
});

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

  resyncThresholds(telemetry);

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
  let database = false;
  try {
    db.prepare("SELECT 1").get();
    database = true;
  } catch {
    database = false;
  }

  const ok = database && gateway.connected;
  response.status(ok ? 200 : 503).json({
    ok,
    mqtt: gateway.connected,
    database: { ok: database, driver: "sqlite", file: databaseFile },
    devices: latestByDevice.size,
    onlineDevices: Array.from(onlineByDevice.values()).filter(Boolean).length,
    realtimeClients: webSockets.clients.size,
  });
});

app.get("/api/config", (_request, response) => {
  response.json(buildDeviceConfig(gardenConfig.deviceId));
});

app.get("/api/devices/:deviceId/config", (request, response) => {
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
  if (!isZoneId(zoneId) || !gardenConfig.zones.some((zone) => zone.id === zoneId)) {
    response.status(404).json({ error: "Zone not found" });
    return;
  }

  const body = request.body as { threshold?: unknown } | undefined;
  if (!body || typeof body !== "object" || typeof body.threshold !== "number" || !Number.isFinite(body.threshold)) {
    response.status(400).json({ error: "threshold must be a number" });
    return;
  }

  const threshold = clampThreshold(body.threshold);
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
  const requestedBucket = queryNumber(request.query.bucketMs);
  const zoneId = typeof request.query.zoneId === "string" ? request.query.zoneId : undefined;

  if (from >= to) {
    response.status(400).json({ error: "from must be earlier than to" });
    return;
  }
  if (zoneId !== undefined && !isZoneId(zoneId)) {
    response.status(400).json({ error: "Invalid zoneId" });
    return;
  }

  // Luôn gộp bucket để chart dài ngày không trả về quá nhiều điểm.
  const bucketMs = Math.max(1000, Math.floor(requestedBucket ?? (to - from) / 500));

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
    bucketMs,
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
  const deviceId = request.params.deviceId;
  const commandRequest = request.body as CommandRequest | undefined;
  if (!commandRequest || typeof commandRequest !== "object") {
    response.status(400).json({ error: "Invalid request body" });
    return;
  }

  const command = toMqttCommand(commandRequest);
  if (!command) {
    response.status(400).json({ error: "Invalid command or zoneId" });
    return;
  }

  // Firmware chỉ nhận lệnh bơm toàn vườn khi đang ở chế độ manual.
  if (
    (commandRequest.action === "PUMP_ON" || commandRequest.action === "PUMP_OFF") &&
    commandRequest.zoneId === undefined &&
    latestByDevice.get(deviceId)?.mode === "auto"
  ) {
    response.status(409).json({ error: "Global pump control requires manual mode" });
    return;
  }

  // Lưu ngay ngưỡng mới để cấu hình không mất khi restart, kể cả khi MQTT lỗi.
  let setting: ReturnType<typeof saveZoneSetting> | undefined;
  if (commandRequest.action === "SET_THRESHOLD" && commandRequest.zoneId && isZoneId(commandRequest.zoneId)) {
    const threshold = clampThreshold(Number(commandRequest.value));
    setting = saveZoneSetting(deviceId, commandRequest.zoneId, threshold, deriveStopThreshold(threshold));
  }

  const commandId = randomUUID();
  const sentAt = new Date().toISOString();

  // Đăng ký lệnh chờ và ghi DB trước khi publish để không bỏ lỡ
  // telemetry phản hồi có thể đến ngay sau khi ESP32 nhận lệnh.
  pendingCommands.set(commandId, {
    id: commandId,
    deviceId,
    command,
    expiresAt: Date.now() + DEVICE_TIMEOUT_MS * 2,
  });

  try {
    logCommand(commandId, deviceId, command);
  } catch (error) {
    console.error("Failed to log command:", error instanceof Error ? error.message : error);
  }

  try {
    await gateway.publish(command);
  } catch (error) {
    pendingCommands.delete(commandId);
    resolveCommand(commandId, "timeout");
    console.error("MQTT command failed:", error);
    if (setting) {
      // Ngưỡng đã nằm trong DB, chỉ chưa áp được xuống thiết bị.
      response.status(202).json({ accepted: true, saved: true, appliedRemotely: false, setting, sentAt });
      return;
    }
    response.status(503).json({ error: "MQTT unavailable" });
    return;
  }

  response.status(202).json({
    accepted: true,
    saved: setting !== undefined,
    appliedRemotely: true,
    commandId,
    deviceId,
    command,
    setting,
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

app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});

// Express 5 tự bắt lỗi async; middleware này giữ response luôn là JSON.
app.use(
  (error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status: unknown }).status) || 500
        : 500;
    if (status >= 500) console.error("Unhandled request error:", error);
    response.status(status).json({ error: status === 400 ? "Invalid JSON body" : "Internal server error" });
  },
);

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
  webSockets.clients.forEach((socket) => socket.terminate());
  webSockets.close();
  server.closeAllConnections();
  server.close(() => {
    try {
      closeDatabase();
    } catch (error) {
      console.error("Failed to close database:", error instanceof Error ? error.message : error);
    }
    process.exit(0);
  });
  // Không để process treo nếu còn kết nối chưa đóng.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
