import { randomUUID } from "node:crypto";
import { Router, raw } from "express";
import {
  type CommandRequest,
  type Telemetry,
  ZONE_PROFILE_LIMITS,
  toMqttCommand,
} from "./domain.js";
import { gardenConfig } from "./garden-config.js";
import type { MqttGateway } from "./mqtt-gateway.js";
import { getLatestTelemetry, trackCommand } from "./live.js";
import {
  getTelemetryHistory,
  getWateringOverview,
  listCommands,
  loadLatestTelemetry,
  logCommand,
} from "./telemetry-repository.js";
import {
  clampThreshold,
  deriveStopThreshold,
  getZoneSetting,
  getZoneSettings,
  isZoneId,
  listZoneSettingChanges,
  saveZoneSetting,
  updateZoneProfile,
} from "./zone-settings-repository.js";
import {
  type ZoneProfilePatch,
  getZoneProfile,
  getZoneProfiles,
  isCropGroup,
  saveZoneProfile,
  setZonePhoto,
} from "./zone-profile-repository.js";
import {
  type SoilType,
  getGardenSoil,
  isSoilType,
  saveGardenSoil,
} from "./garden-settings-repository.js";
import { buildZoneAdvice, growthFor } from "./zone-advice.js";
import { imageExtension, removeUploadFile, saveZonePhotoFile } from "./uploads.js";

/** gardenConfig gốc + ngưỡng trong DB + hồ sơ cây do người dùng chỉnh. */
function buildDeviceConfig(deviceId: string) {
  const settings = new Map(
    getZoneSettings(deviceId).map((setting) => [setting.zoneId as string, setting]),
  );
  const profiles = new Map(
    getZoneProfiles(deviceId).map((profile) => [profile.zoneId as string, profile]),
  );

  return {
    ...gardenConfig,
    soil: getGardenSoil(deviceId),
    zones: gardenConfig.zones.map((zone) => {
      const setting = settings.get(zone.id);
      const profile = profiles.get(zone.id);
      const growth = growthFor(
        profile?.group ?? zone.group,
        profile?.plantedAt ?? null,
        profile?.harvestDays ?? null,
      );
      return {
        ...zone,
        ...(profile
          ? {
              name: profile.name,
              crop: profile.description,
              group: profile.group,
              plantedAt: profile.plantedAt,
              harvestDays: profile.harvestDays,
              notes: profile.notes,
            }
          : {}),
        photoUrl: profile?.photoFile ? `/uploads/${profile.photoFile}` : null,
        growth,
        ...(setting
          ? {
              threshold: setting.threshold,
              stopThreshold: setting.stopThreshold,
              pumpSeconds: setting.pumpSeconds ?? zone.pumpSeconds,
              flowLitersPerHour: setting.flowLitersPerHour ?? zone.flowLitersPerHour,
              targetLiters: setting.targetLiters ?? zone.targetLiters,
            }
          : {}),
      };
    }),
  };
}

function queryNumber(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

type DeviceZone = ReturnType<typeof buildDeviceConfig>["zones"][number];

function adviceForZone(
  zone: DeviceZone,
  soil: SoilType,
  telemetry: Telemetry | null,
) {
  const baseZone = gardenConfig.zones.find((item) => item.id === zone.id);
  if (!baseZone) return null;

  const growth = growthFor(zone.group, zone.plantedAt ?? null, zone.harvestDays ?? null);
  return {
    zoneId: zone.id,
    name: zone.name,
    growth,
    advice: buildZoneAdvice(
      {
        group: zone.group,
        soil,
        threshold: zone.threshold,
        baseThreshold: baseZone.threshold,
      },
      growth,
      telemetry,
    ),
  };
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

  router.get("/api/devices/:deviceId/config/advice", (request, response) => {
    const { deviceId } = request.params;
    const config = buildDeviceConfig(deviceId);
    const telemetry = loadLatestTelemetry(deviceId);

    response.json({
      deviceId,
      soil: config.soil,
      zones: config.zones
        .map((zone) => adviceForZone(zone, config.soil, telemetry))
        .filter((item) => item !== null),
    });
  });

  router.post("/api/devices/:deviceId/config/advice/apply", async (request, response) => {
    const { deviceId } = request.params;
    const config = buildDeviceConfig(deviceId);
    const telemetry = loadLatestTelemetry(deviceId);
    const applied: Array<{
      zoneId: string;
      threshold: number;
      appliedRemotely: boolean;
    }> = [];

    for (const zone of config.zones) {
      if (!isZoneId(zone.id)) continue;
      const item = adviceForZone(zone, config.soil, telemetry);
      if (!item) continue;

      const { advice } = item;
      saveZoneSetting(
        deviceId,
        zone.id,
        advice.suggestedThreshold,
        deriveStopThreshold(advice.suggestedThreshold),
      );

      let appliedRemotely = false;
      try {
        await gateway.publish(`SET_THRESHOLD_${zone.id}_${advice.suggestedThreshold}`);
        appliedRemotely = true;
      } catch (error) {
        console.error(
          "Threshold saved but MQTT publish failed:",
          error instanceof Error ? error.message : error,
        );
      }

      applied.push({
        zoneId: zone.id,
        threshold: advice.suggestedThreshold,
        appliedRemotely,
      });
    }

    response.json({ applied });
  });

  router.get("/api/devices/:deviceId/config/zones/:zoneId/advice", (request, response) => {
    const { deviceId, zoneId } = request.params;
    if (!isZoneId(zoneId)) {
      response.status(404).json({ error: "Zone not found" });
      return;
    }

    const config = buildDeviceConfig(deviceId);
    const zone = config.zones.find((item) => item.id === zoneId);
    const payload = zone
      ? adviceForZone(zone, config.soil, loadLatestTelemetry(deviceId))
      : null;
    if (!payload) {
      response.status(404).json({ error: "Zone not found" });
      return;
    }

    response.json(payload);
  });

  router.put("/api/devices/:deviceId/config/soil", (request, response) => {
    const soil = (request.body as { soil?: unknown } | undefined)?.soil;
    if (typeof soil !== "string" || !isSoilType(soil)) {
      response.status(400).json({ error: "soil is not supported" });
      return;
    }
    response.json({ deviceId: request.params.deviceId, ...saveGardenSoil(request.params.deviceId, soil) });
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

    const irrigation: {
      pumpSeconds?: number;
      flowLitersPerHour?: number;
      targetLiters?: number;
    } = {};
    for (const field of ["pumpSeconds", "flowLitersPerHour", "targetLiters"] as const) {
      const value = body[field];
      if (value === undefined) continue;
      const limits = ZONE_PROFILE_LIMITS[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < limits.min || value > limits.max) {
        response.status(400).json({ error: `${field} must be between ${limits.min} and ${limits.max}` });
        return;
      }
      irrigation[field] = value;
    }

    const profilePatch: ZoneProfilePatch = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 1 || name.length > 60) {
        response.status(400).json({ error: "name must be 1-60 characters" });
        return;
      }
      profilePatch.name = name;
    }

    if (body.crop !== undefined) {
      const description = typeof body.crop === "string" ? body.crop.trim() : null;
      if (description === null || description.length > 160) {
        response.status(400).json({ error: "crop must be at most 160 characters" });
        return;
      }
      profilePatch.description = description;
    }

    if (body.group !== undefined) {
      if (typeof body.group !== "string" || !isCropGroup(body.group)) {
        response.status(400).json({ error: "group is not supported" });
        return;
      }
      profilePatch.group = body.group;
    }

    if (body.plantedAt !== undefined) {
      const plantedAt = body.plantedAt;
      if (plantedAt !== null && (typeof plantedAt !== "number" || !Number.isFinite(plantedAt) || plantedAt < 0)) {
        response.status(400).json({ error: "plantedAt must be a timestamp or null" });
        return;
      }
      profilePatch.plantedAt = plantedAt as number | null;
    }

    if (body.harvestDays !== undefined) {
      const harvestDays = body.harvestDays;
      if (
        harvestDays !== null &&
        (typeof harvestDays !== "number" ||
          !Number.isInteger(harvestDays) ||
          harvestDays < 1 ||
          harvestDays > 365)
      ) {
        response.status(400).json({ error: "harvestDays must be an integer from 1 to 365" });
        return;
      }
      profilePatch.harvestDays = harvestDays as number | null;
    }

    if (body.notes !== undefined) {
      const notes = typeof body.notes === "string" ? body.notes.trim() : null;
      if (notes === null || notes.length > 500) {
        response.status(400).json({ error: "notes must be at most 500 characters" });
        return;
      }
      profilePatch.notes = notes;
    }

    const hasProfile = Object.keys(profilePatch).length > 0;
    if (!hasThreshold && Object.keys(irrigation).length === 0 && !hasProfile) {
      response.status(400).json({ error: "No configuration fields provided" });
      return;
    }

    const threshold = hasThreshold ? clampThreshold(body.threshold as number) : null;
    let setting = threshold !== null
      ? saveZoneSetting(deviceId, zoneId, threshold, deriveStopThreshold(threshold))
      : getZoneSetting(deviceId, zoneId);

    if (Object.keys(irrigation).length > 0) {
      setting = updateZoneProfile(deviceId, zoneId, irrigation) ?? setting;
    }

    const profile = hasProfile ? saveZoneProfile(deviceId, zoneId, profilePatch) : null;
    if (!setting || (hasProfile && !profile)) {
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

    response.json({ ...setting, profile, appliedRemotely });
  });

  const photoParser = raw({
    type: ["image/jpeg", "image/png", "image/webp"],
    limit: "4mb",
  });

  router.post(
    "/api/devices/:deviceId/config/zones/:zoneId/photo",
    photoParser,
    (request, response) => {
      const { deviceId, zoneId } = request.params;
      if (!isZoneId(zoneId) || !gardenConfig.zones.some((zone) => zone.id === zoneId)) {
        response.status(404).json({ error: "Zone not found" });
        return;
      }

      const extension = imageExtension(request.headers["content-type"]);
      if (!extension || !Buffer.isBuffer(request.body) || request.body.length === 0) {
        response.status(400).json({ error: "Photo must be a JPEG, PNG or WebP image" });
        return;
      }

      const previous = getZoneProfile(deviceId, zoneId);
      const photoFile = saveZonePhotoFile(deviceId, zoneId, extension, request.body);
      setZonePhoto(deviceId, zoneId, photoFile);
      removeUploadFile(previous?.photoFile ?? null);

      response.json({ photoUrl: `/uploads/${photoFile}` });
    },
  );

  router.delete("/api/devices/:deviceId/config/zones/:zoneId/photo", (request, response) => {
    const { deviceId, zoneId } = request.params;
    if (!isZoneId(zoneId) || !gardenConfig.zones.some((zone) => zone.id === zoneId)) {
      response.status(404).json({ error: "Zone not found" });
      return;
    }

    const previous = getZoneProfile(deviceId, zoneId);
    setZonePhoto(deviceId, zoneId, null);
    removeUploadFile(previous?.photoFile ?? null);

    response.json({ photoUrl: null });
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

  router.get("/api/devices/:deviceId/watering", (request, response) => {
    const deviceId = request.params.deviceId;
    const now = Date.now();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const from = startOfDay.getTime();

    const byZone = new Map(
      getWateringOverview(deviceId, from).map((item) => [item.zoneId, item]),
    );

    response.json({
      deviceId,
      from,
      to: now,
      zones: gardenConfig.zones.map(
        (zone) =>
          byZone.get(zone.id) ?? {
            zoneId: zone.id,
            lastRun: null,
            todayLiters: 0,
            todayRuns: 0,
          },
      ),
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
