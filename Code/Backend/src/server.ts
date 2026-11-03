import cors from "cors";
import express from "express";
import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { config } from "./config.js";
import { type CommandRequest, type Telemetry, toMqttCommand } from "./domain.js";
import { MqttGateway } from "./mqtt-gateway.js";

const DEVICE_TIMEOUT_MS = 6000;
const latestByDevice = new Map<string, Telemetry>();
const onlineByDevice = new Map<string, boolean>();
const lastLiveAtByDevice = new Map<string, number>();
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

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    mqtt: gateway.connected,
    devices: latestByDevice.size,
    onlineDevices: Array.from(onlineByDevice.values()).filter(Boolean).length,
    realtimeClients: webSockets.clients.size,
  });
});

app.get("/api/devices/:deviceId/telemetry/latest", (request, response) => {
  const telemetry = latestByDevice.get(request.params.deviceId);
  if (!telemetry) {
    response.status(404).json({ error: "Telemetry not available" });
    return;
  }
  response.json(telemetry);
});

app.post("/api/devices/:deviceId/commands", async (request, response) => {
  const command = toMqttCommand(request.body as CommandRequest);
  if (!command) {
    response.status(400).json({ error: "Invalid command or zoneId" });
    return;
  }

  try {
    await gateway.publish(command);
    response.status(202).json({
      accepted: true,
      deviceId: request.params.deviceId,
      command,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("MQTT command failed:", error);
    response.status(503).json({ error: "MQTT unavailable" });
  }
});

server.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  clearInterval(deviceWatchdog);
  gateway.close();
  webSockets.close();
  server.close(() => process.exit(0));
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
