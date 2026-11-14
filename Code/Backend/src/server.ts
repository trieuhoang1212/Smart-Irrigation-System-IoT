import cors from "cors";
import express from "express";
import http from "node:http";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { closeDatabase, databaseFile, db } from "./db.js";
import { gardenConfig } from "./garden-config.js";
import { getLiveStats, startLive, stopLive } from "./live.js";
import { MqttGateway } from "./mqtt-gateway.js";
import { createApiRouter } from "./routes.js";
import {
  backfillWateringRuns,
  pruneHistory,
  timeoutStaleCommands,
} from "./telemetry-repository.js";
import { seedZoneSettings } from "./zone-settings-repository.js";
import { seedZoneProfiles } from "./zone-profile-repository.js";
import { uploadDir } from "./uploads.js";

// Tạo ngưỡng mặc định trong DB cho zone chưa từng được lưu.
seedZoneSettings(gardenConfig.deviceId, gardenConfig.zones);

// Hồ sơ cây (tên, nhóm, ngày trồng, ảnh) do người dùng chỉnh trên Web.
seedZoneProfiles(gardenConfig.deviceId, gardenConfig.zones);

// Lần đầu chạy, dựng lại các lần tưới từ telemetry 6 giờ gần nhất.
const backfilled = backfillWateringRuns(gardenConfig.deviceId);
if (backfilled > 0) console.log(`Backfilled watering runs from ${backfilled} samples`);

// Lệnh pending chỉ nằm trong RAM; restart xong thì không còn ai xác nhận nữa.
const staleCommands = timeoutStaleCommands();
if (staleCommands > 0) console.log(`Marked ${staleCommands} stale commands as timeout`);

const gateway = new MqttGateway();
const app = express();
const server = http.createServer(app);
const webSockets = new WebSocketServer({ server, path: "/realtime" });

app.use(cors({ origin: config.webOrigin }));
app.use(express.json({ limit: "16kb" }));
app.use("/uploads", express.static(uploadDir, { maxAge: "7d", immutable: true }));

startLive(webSockets, gateway);

app.get("/api/health", (_request, response) => {
  let database = false;
  try {
    db.prepare("SELECT 1").get();
    database = true;
  } catch {
    database = false;
  }

  const { devices, onlineDevices } = getLiveStats();
  const ok = database && gateway.connected;
  response.status(ok ? 200 : 503).json({
    ok,
    mqtt: gateway.connected,
    database: { ok: database, driver: "sqlite", file: databaseFile },
    devices,
    onlineDevices,
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
  clearInterval(retentionTimer);
  stopLive();
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
