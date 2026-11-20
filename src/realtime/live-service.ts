import type { WebSocketServer } from "ws";
import {
  checkDeviceOfflineAlert,
  checkDeviceOnlineAlert,
  checkTelemetryAlerts,
} from "../alerts.js";
import type { MqttGateway } from "../mqtt-gateway.js";
import {
  loadAllLatestTelemetry,
  saveLatestTelemetry,
  saveTelemetry,
} from "../telemetry-repository.js";
import {
  attachWebSocketServer,
  broadcast,
  detachWebSocketServer,
  type LiveSocket,
} from "./broadcaster.js";
import { confirmPendingCommands, expirePendingCommands } from "./commands.js";
import {
  lastHistoryWriteByDevice,
  lastLiveAtByDevice,
  latestByDevice,
  onlineByDevice,
} from "./state.js";
import {
  resyncFlows,
  resyncRainThreshold,
  resyncStopThresholds,
  resyncTargets,
  resyncThresholds,
} from "./sync.js";

const DEVICE_TIMEOUT_MS = 6000;
const HISTORY_WRITE_INTERVAL_MS = 10_000;

let heartbeat: ReturnType<typeof setInterval> | null = null;
let deviceWatchdog: ReturnType<typeof setInterval> | null = null;
let commandWatchdog: ReturnType<typeof setInterval> | null = null;
let unsubscribeTelemetry: (() => void) | null = null;

export function startLive(ws: WebSocketServer, gateway: MqttGateway) {
  attachWebSocketServer(ws);

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
    socket.on("error", (error) =>
      console.error("WebSocket error:", error.message),
    );

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

    // Retained chỉ đến khi backend (re)subscribe. Nếu là snapshot của lần chạy cũ
    // (uptime thấp hơn snapshot đã lưu) thì bỏ qua, để lần live kế tiếp vẫn phát
    // hiện reboot và không ghi đè dữ liệu mới hơn bằng dữ liệu cũ.
    const staleRetained =
      meta.retained &&
      previousTelemetry !== undefined &&
      typeof telemetry.uptimeMs === "number" &&
      typeof previousTelemetry.uptimeMs === "number" &&
      telemetry.uptimeMs < previousTelemetry.uptimeMs;
    if (staleRetained) return;

    latestByDevice.set(deviceId, telemetry);

    if (!meta.retained && previousTelemetry) {
      checkTelemetryAlerts(previousTelemetry, telemetry);
    }

    // Live state vẫn 2s/lần, nhưng history chỉ ghi 10s/lần cho nhẹ DB.
    // Retained chỉ là snapshot cũ nên không ghi vào history để khỏi lệch chart.
    const now = Date.now();
    const lastSavedAt = lastHistoryWriteByDevice.get(deviceId) ?? 0;
    try {
      if (!meta.retained && now - lastSavedAt >= HISTORY_WRITE_INTERVAL_MS) {
        saveTelemetry(telemetry);
        lastHistoryWriteByDevice.set(deviceId, now);
      } else {
        // Snapshot hiển thị phải bám sát telemetry vừa nhận, kể cả retained
        // đầu tiên sau khi backend khởi động lại; history vẫn giữ nhịp riêng.
        saveLatestTelemetry(telemetry);
      }
    } catch (error) {
      console.error(
        "Failed to persist telemetry:",
        error instanceof Error ? error.message : error,
      );
    }

    // Retained telemetry chỉ là snapshot cũ, không dùng để gửi lệnh:
    // ESP32 có thể đang offline nên command MQTT sẽ bị mất.
    // Chờ telemetry live kế tiếp để chắc chắn thiết bị đã online và nhận lệnh.
    if (!meta.retained) {
      resyncThresholds(telemetry, gateway);
      // Ngưỡng dừng chạy sau ngưỡng bật để giá trị cuối cùng khớp với DB.
      resyncStopThresholds(telemetry, gateway);
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
        if (wasKnown) {
          checkDeviceOnlineAlert(deviceId);
        }
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
      checkDeviceOfflineAlert(deviceId);
    });
  }, 2000);
  deviceWatchdog.unref();

  commandWatchdog = setInterval(expirePendingCommands, 1000);
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
  detachWebSocketServer();
}
