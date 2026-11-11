import { randomUUID } from "node:crypto";
import { Router } from "express";
import {
  type CommandRequest,
  ZONE_PROFILE_LIMITS,
  toMqttCommand,
} from "./domain.js";
import { gardenConfig } from "./garden-config.js";
import type { MqttGateway } from "./mqtt-gateway.js";
import { getLatestTelemetry, trackCommand } from "./live.js";
import {
  getTelemetryHistory,
  listCommands,
  logCommand,
} from "./telemetry-repository.js";
import {
  clampThreshold,
  deriveStopThreshold,
  getZoneSettings,
  isZoneId,
  listZoneSettingChanges,
  saveZoneSetting,
  updateZoneProfile,
} from "./zone-settings-repository.js";

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
        ? {
            ...zone,
            threshold: setting.threshold,
            stopThreshold: setting.stopThreshold,
            duration: setting.duration ?? zone.duration,
            pumpSeconds: setting.pumpSeconds ?? zone.pumpSeconds,
            flowLitersPerHour: setting.flowLitersPerHour ?? zone.flowLitersPerHour,
            targetLiters: setting.targetLiters ?? zone.targetLiters,
          }
        : zone;
    }),
  };
}

function queryNumber(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function createApiRouter(gateway: MqttGateway) {
  const router = Router();

  // Một nguồn device ID duy nhất; route nào có :deviceId đều trả 404 như nhau.
  router.param("deviceId", (_request, response, next, value: string) => {
    if (value !== gardenConfig.deviceId) {
      response.status(404).json({ error: "Device not found" });
      return;
    }
    next();
  });

  router.get("/api/config", (_request, response) => {
    response.json(buildDeviceConfig(gardenConfig.deviceId));
  });

  router.get("/api/devices/:deviceId/config", (request, response) => {
    response.json(buildDeviceConfig(request.params.deviceId));
  });

  router.get("/api/devices/:deviceId/config/changes", (request, response) => {
    const limit = queryNumber(request.query.limit);
    response.json({
      deviceId: request.params.deviceId,
      changes: listZoneSettingChanges(request.params.deviceId, limit),
    });
  });

  router.put("/api/devices/:deviceId/config/zones/:zoneId", async (request, response) => {
    const { deviceId, zoneId } = request.params;
    if (!isZoneId(zoneId) || !gardenConfig.zones.some((zone) => zone.id === zoneId)) {
      response.status(404).json({ error: "Zone not found" });
      return;
    }

    const body = request.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== "object") {
      response.status(400).json({ error: "Invalid request body" });
      return;
    }

    const hasThreshold = body.threshold !== undefined;
    if (hasThreshold && (typeof body.threshold !== "number" || !Number.isFinite(body.threshold))) {
      response.status(400).json({ error: "threshold must be a number" });
      return;
    }

    const profile: {
      duration?: number;
      pumpSeconds?: number;
      flowLitersPerHour?: number;
      targetLiters?: number;
    } = {};
    for (const field of ["duration", "pumpSeconds", "flowLitersPerHour", "targetLiters"] as const) {
      const value = body[field];
      if (value === undefined) continue;
      const limits = ZONE_PROFILE_LIMITS[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < limits.min || value > limits.max) {
        response.status(400).json({ error: `${field} must be between ${limits.min} and ${limits.max}` });
        return;
      }
      profile[field] = value;
    }

    if (!hasThreshold && Object.keys(profile).length === 0) {
      response.status(400).json({ error: "No configuration fields provided" });
      return;
    }

    const threshold = hasThreshold ? clampThreshold(body.threshold as number) : null;
    let setting = threshold !== null
      ? saveZoneSetting(deviceId, zoneId, threshold, deriveStopThreshold(threshold))
      : null;

    if (Object.keys(profile).length > 0) {
      setting = updateZoneProfile(deviceId, zoneId, profile) ?? setting;
    }
    if (!setting) {
      response.status(404).json({ error: "Zone setting not found" });
      return;
    }

    let appliedRemotely = false;
    if (threshold !== null) {
      try {
        await gateway.publish(`SET_THRESHOLD_${zoneId}_${threshold}`);
        appliedRemotely = true;
      } catch (error) {
        console.error(
          "Threshold saved but MQTT publish failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    response.json({ ...setting, appliedRemotely });
  });

  router.get("/api/devices/:deviceId/telemetry/latest", (request, response) => {
    const telemetry = getLatestTelemetry(request.params.deviceId);
    if (!telemetry) {
      response.status(404).json({ error: "Telemetry not available" });
      return;
    }
    response.json(telemetry);
  });

  router.get("/api/devices/:deviceId/telemetry/history", (request, response) => {
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

  router.get("/api/devices/:deviceId/commands", (request, response) => {
    const limit = queryNumber(request.query.limit);
    response.json({
      deviceId: request.params.deviceId,
      commands: listCommands(request.params.deviceId, limit),
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

    // Firmware chỉ nhận lệnh bơm toàn vườn khi đang ở chế độ manual.
    if (
      (commandRequest.action === "PUMP_ON" || commandRequest.action === "PUMP_OFF") &&
      commandRequest.zoneId === undefined &&
      getLatestTelemetry(deviceId)?.mode === "auto"
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

    try {
      await gateway.publish(command);
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

    trackCommand(commandId, deviceId, command);

    try {
      logCommand(commandId, deviceId, command);
    } catch (error) {
      console.error("Failed to log command:", error instanceof Error ? error.message : error);
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

  return router;
}
