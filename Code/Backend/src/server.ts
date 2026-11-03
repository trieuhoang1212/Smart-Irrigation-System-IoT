import cors from "cors";
import { randomUUID } from "node:crypto";
import express from "express";
import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { config } from "./config.js";
import { type CommandRequest, type Telemetry, toMqttCommand } from "./domain.js";
import { MqttGateway } from "./mqtt-gateway.js";
import { gardenConfig } from "./garden-config.js";

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

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    mqtt: gateway.connected,
    devices: latestByDevice.size,
    onlineDevices: Array.from(onlineByDevice.values()).filter(Boolean).length,
    realtimeClients: webSockets.clients.size,
  });
});

app.get("/api/config", (_request, response) => {
  response.json(gardenConfig);
});

app.get("/api/devices/:deviceId/config", (request, response) => {
  if (request.params.deviceId !== gardenConfig.deviceId) {
    response.status(404).json({ error: "Device config not found" });
    return;
  }
  response.json(gardenConfig);
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
  if (request.params.deviceId !== gardenConfig.deviceId) {
    response.status(404).json({ error: "Device not found" });
    return;
  }
  const command = toMqttCommand(request.body as CommandRequest);
  if (!command) {
    response.status(400).json({ error: "Invalid command or zoneId" });
    return;
  }

  try {
    await gateway.publish(command);
    const commandId = randomUUID();
    pendingCommands.set(commandId, {
      id: commandId,
      deviceId: request.params.deviceId,
      command,
      expiresAt: Date.now() + DEVICE_TIMEOUT_MS * 2,
    });
    response.status(202).json({
      accepted: true,
      commandId,
      deviceId: request.params.deviceId,
      command,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("MQTT command failed:", error);
    response.status(503).json({ error: "MQTT unavailable" });
  }
});

const commandWatchdog = setInterval(() => {
  const now = Date.now();
  pendingCommands.forEach((pending, commandId) => {
    if (pending.expiresAt > now) return;
    pendingCommands.delete(commandId);
    broadcast({ type: "command-result", commandId, deviceId: pending.deviceId, status: "timeout" });
  });
}, 1000);
commandWatchdog.unref();

server.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  clearInterval(deviceWatchdog);
  clearInterval(commandWatchdog);
  gateway.close();
  webSockets.close();
  server.close(() => process.exit(0));
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
