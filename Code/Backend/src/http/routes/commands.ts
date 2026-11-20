import { randomUUID } from "node:crypto";
import type { Router } from "express";
import { type CommandRequest, toMqttCommand } from "../../domain.js";
import { getLatestTelemetry, trackCommand } from "../../live.js";
import type { MqttGateway } from "../../mqtt-gateway.js";
import { listCommands, logCommand } from "../../telemetry-repository.js";
import {
  clampStopThreshold,
  clampThreshold,
  deriveStopThreshold,
  getZoneSetting,
  isZoneId,
  saveZoneSetting,
} from "../../zone-settings-repository.js";
import { queryNumber } from "../query.js";

export function registerCommandRoutes(router: Router, gateway: MqttGateway) {
  router.get("/api/devices/:deviceId/commands", async (request, response) => {
    const limit = queryNumber(request.query.limit);
    response.json({
      deviceId: request.params.deviceId,
      commands: await listCommands(request.params.deviceId, limit),
    });
  });

  router.post("/api/devices/:deviceId/commands", async (request, response) => {
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
    let outgoing = command;

    // Firmware chỉ nhận lệnh bơm (toàn vườn hoặc từng vùng) khi đang ở chế độ manual.
    if (
      (commandRequest.action === "PUMP_ON" || commandRequest.action === "PUMP_OFF") &&
      getLatestTelemetry(deviceId)?.mode === "auto"
    ) {
      response.status(409).json({ error: "Pump control requires manual mode" });
      return;
    }

    // Lưu ngay ngưỡng mới để cấu hình không mất khi restart, kể cả khi MQTT lỗi.
    let setting: Awaited<ReturnType<typeof saveZoneSetting>> | undefined;
    if (commandRequest.action === "SET_THRESHOLD" && commandRequest.zoneId && isZoneId(commandRequest.zoneId)) {
      const threshold = clampThreshold(Number(commandRequest.value));
      const previous = await getZoneSetting(deviceId, commandRequest.zoneId);
      // Ngưỡng dừng độc lập: giữ số đang dùng, chỉ nâng khi bị ngưỡng bật vượt qua.
      const stopThreshold = previous
        ? clampStopThreshold(previous.stopThreshold, threshold)
        : deriveStopThreshold(threshold);
      setting = await saveZoneSetting(deviceId, commandRequest.zoneId, threshold, stopThreshold);
    }

    if (commandRequest.action === "SET_STOP" && commandRequest.zoneId && isZoneId(commandRequest.zoneId)) {
      const previous = await getZoneSetting(deviceId, commandRequest.zoneId);
      if (previous) {
        setting = await saveZoneSetting(
          deviceId,
          commandRequest.zoneId,
          previous.threshold,
          clampStopThreshold(Number(commandRequest.value), previous.threshold),
        );
        // Gửi đúng giá trị đã kẹp để lệnh xác nhận khớp với telemetry thiết bị báo.
        outgoing = `SET_STOP_${commandRequest.zoneId}_${setting.stopThreshold}`;
      }
    }

    const commandId = randomUUID();
    const sentAt = new Date().toISOString();

    try {
      await gateway.publish(outgoing);
    } catch (error) {
      console.error("MQTT command failed:", error);
      if (setting) {
        // Ngưỡng đã nằm trong DB, chỉ chưa áp được xuống thiết bị.
        response.status(202).json({ accepted: true, saved: true, appliedRemotely: false, setting, sentAt });
        return;
      }
      response.status(503).json({ error: "MQTT unavailable" });
      return;
    }

    trackCommand(commandId, deviceId, outgoing);

    try {
      await logCommand(commandId, deviceId, outgoing);
    } catch (error) {
      console.error("Failed to log command:", error instanceof Error ? error.message : error);
    }

    response.status(202).json({
      accepted: true,
      saved: setting !== undefined,
      appliedRemotely: true,
      commandId,
      deviceId,
      command: outgoing,
      setting,
      sentAt,
    });
  });
}
