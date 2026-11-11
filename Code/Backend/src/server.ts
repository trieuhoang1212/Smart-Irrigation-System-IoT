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
import { pruneHistory, timeoutStaleCommands } from "./telemetry-repository.js";
import { seedZoneSettings } from "./zone-settings-repository.js";

// Tạo ngưỡng mặc định trong DB cho zone chưa từng được lưu.
seedZoneSettings(gardenConfig.deviceId, gardenConfig.zones);

// Lệnh pending chỉ nằm trong RAM; restart xong thì không còn ai xác nhận nữa.
const staleCommands = timeoutStaleCommands();
if (staleCommands > 0) console.log(`Marked ${staleCommands} stale commands as timeout`);

const gateway = new MqttGateway();
const app = express();
const server = http.createServer(app);
const webSockets = new WebSocketServer({ server, path: "/realtime" });

app.use(cors({ origin: config.webOrigin }));
app.use(express.json({ limit: "16kb" }));

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

app.use(createApiRouter(gateway));

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
