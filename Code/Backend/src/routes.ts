import { randomUUID } from "node:crypto";
import { Router, raw } from "express";
import {
  type CommandRequest,
  type Telemetry,
  MAX_RUN_SECONDS,
  MAX_STOP_THRESHOLD,
  MAX_THRESHOLD,
  MIN_RUN_SECONDS,
  MIN_STOP_GAP,
  MIN_THRESHOLD,
  STOP_OFFSET,
  ZONE_PROFILE_LIMITS,
  targetSecondsFor,
  toMqttCommand,
} from "./domain.js";
import { gardenConfig } from "./garden-config.js";
import type { MqttGateway } from "./mqtt-gateway.js";
import { getLatestTelemetry, trackCommand } from "./live.js";
import {
  deleteHistoryBefore,
  getTelemetryHistory,
  getWateringOverview,
  listCommands,
  loadLatestTelemetry,
  logCommand,
} from "./telemetry-repository.js";
import {
  clampStopThreshold,
  clampThreshold,
  deriveStopThreshold,
  getZoneSetting,
  getZoneSettings,
  isZoneId,
  listZoneSettingChanges,
  saveZoneSetting,
  updateZoneIrrigation,
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
  MAX_RAIN_THRESHOLD,
  MIN_RAIN_THRESHOLD,
  RAIN_WARN_OFFSET,
  getGardenRainThreshold,
  getGardenSoil,
  isSoilType,
  saveGardenRainThreshold,
  saveGardenSoil,
} from "./garden-settings-repository.js";
import { buildZoneAdvice, growthFor } from "./zone-advice.js";
import { imageExtension, removeUploadFile, saveZonePhotoFile } from "./uploads.js";
import { isExpoPushToken, sendPushToDevice } from "./push.js";
import {
  deletePushToken,
  isPushPlatform,
  listPushTokens,
  savePushToken,
} from "./push-repository.js";

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
    rainThreshold: getGardenRainThreshold(deviceId),
    limits: {
      thresholdMin: MIN_THRESHOLD,
      thresholdMax: MAX_THRESHOLD,
      stopOffset: STOP_OFFSET,
      minRunSeconds: MIN_RUN_SECONDS,
      maxRunSeconds: MAX_RUN_SECONDS,
      flowMin: ZONE_PROFILE_LIMITS.flowLitersPerHour.min,
      flowMax: ZONE_PROFILE_LIMITS.flowLitersPerHour.max,
      targetMin: ZONE_PROFILE_LIMITS.targetLiters.min,
      targetMax: ZONE_PROFILE_LIMITS.targetLiters.max,
      rainMin: MIN_RAIN_THRESHOLD,
      rainMax: MAX_RAIN_THRESHOLD,
      rainWarnOffset: RAIN_WARN_OFFSET,
    },
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

// Gợi ý chỉ dùng thời tiết còn mới; snapshot quá cũ dễ làm khuyến nghị sai.
const ADVICE_TELEMETRY_MAX_AGE_MS = 30 * 60_000;

function telemetryForAdvice(deviceId: string): Telemetry | null {
  const telemetry = loadLatestTelemetry(deviceId);
  if (!telemetry) return null;
  const age = Date.now() - Date.parse(telemetry.receivedAt);
  return Number.isFinite(age) && age <= ADVICE_TELEMETRY_MAX_AGE_MS ? telemetry : null;
}

function adviceForZone(
  zone: DeviceZone,
  soil: SoilType,
  telemetry: Telemetry | null,
) {
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
    const telemetry = telemetryForAdvice(deviceId);

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
    const telemetry = telemetryForAdvice(deviceId);
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
      ? adviceForZone(zone, config.soil, telemetryForAdvice(deviceId))
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

  router.put("/api/devices/:deviceId/config/rain", async (request, response) => {
    const threshold = (request.body as { threshold?: unknown } | undefined)?.threshold;
    if (typeof threshold !== "number" || !Number.isFinite(threshold)) {
      response.status(400).json({ error: "threshold must be a number" });
      return;
    }

    const saved = saveGardenRainThreshold(request.params.deviceId, threshold);
    let appliedRemotely = false;
    try {
      await gateway.publish(`SET_RAIN_THRESHOLD_${saved.rainThreshold}`);
      appliedRemotely = true;
    } catch (error) {
      console.error(
        "Rain threshold saved but MQTT publish failed:",
        error instanceof Error ? error.message : error,
      );
    }

    response.json({ deviceId: request.params.deviceId, ...saved, appliedRemotely });
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

    const hasStopThreshold = body.stopThreshold !== undefined;
    if (
      hasStopThreshold &&
      (typeof body.stopThreshold !== "number" || !Number.isFinite(body.stopThreshold))
    ) {
      response.status(400).json({ error: "stopThreshold must be a number" });
      return;
    }

    const irrigation: {
      flowLitersPerHour?: number;
      targetLiters?: number;
    } = {};
    for (const field of ["flowLitersPerHour", "targetLiters"] as const) {
      const value = body[field];
      if (value === undefined) continue;
      const limits = ZONE_PROFILE_LIMITS[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < limits.min || value > limits.max) {
        response.status(400).json({ error: `${field} must be between ${limits.min} and ${limits.max}` });
        return;
      }
      // Firmware đọc lưu lượng bằng số nguyên; nhận số lẻ sẽ làm lệch cấu hình.
      if (field === "flowLitersPerHour" && !Number.isInteger(value)) {
        response.status(400).json({ error: "flowLitersPerHour must be an integer" });
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
    if (!hasThreshold && !hasStopThreshold && Object.keys(irrigation).length === 0 && !hasProfile) {
      response.status(400).json({ error: "No configuration fields provided" });
      return;
    }

    const current = getZoneSetting(deviceId, zoneId);
    if (!current) {
      response.status(404).json({ error: "Zone setting not found" });
      return;
    }

    // Kiểm tra mục tiêu trên cấu hình sau khi ghép, trước khi ghi DB.
    let targetSeconds = 0;
    if (Object.keys(irrigation).length > 0) {
      const nextFlow = irrigation.flowLitersPerHour ?? current.flowLitersPerHour;
      const nextTarget = irrigation.targetLiters ?? current.targetLiters;
      targetSeconds = targetSecondsFor(nextFlow, nextTarget);
      if (targetSeconds === 0) {
        response.status(400).json({
          error: `flowLitersPerHour and targetLiters must produce a run time between ${MIN_RUN_SECONDS} and ${MAX_RUN_SECONDS} seconds`,
        });
        return;
      }
    }

    const profile = hasProfile ? saveZoneProfile(deviceId, zoneId, profilePatch) : null;
    if (hasProfile && !profile) {
      response.status(404).json({ error: "Zone profile not found" });
      return;
    }

    const threshold = hasThreshold ? clampThreshold(body.threshold as number) : current.threshold;
    let stopThreshold = current.stopThreshold;
    if (hasStopThreshold) {
      stopThreshold = Math.round(body.stopThreshold as number);
      if (stopThreshold < threshold + MIN_STOP_GAP || stopThreshold > MAX_STOP_THRESHOLD) {
        response.status(400).json({
          error: `stopThreshold must be between ${threshold + MIN_STOP_GAP} and ${MAX_STOP_THRESHOLD} (at least ${MIN_STOP_GAP} points above threshold)`,
        });
        return;
      }
    } else if (hasThreshold) {
      // Vùng còn dùng độ trễ mặc định thì vẫn dừng ở +20; vùng đã chỉnh tay thì giữ số đã chỉnh.
      const isDefaultGap = current.stopThreshold === deriveStopThreshold(current.threshold);
      stopThreshold = isDefaultGap
        ? deriveStopThreshold(threshold)
        : clampStopThreshold(current.stopThreshold, threshold);
    }

    let setting = hasThreshold || hasStopThreshold
      ? saveZoneSetting(deviceId, zoneId, threshold, stopThreshold)
      : current;

    if (Object.keys(irrigation).length > 0) {
      setting = updateZoneIrrigation(deviceId, zoneId, irrigation) ?? setting;
    }

    let appliedRemotely = false;
    if (hasThreshold) {
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

    // Firmware tự suy ra dừng = bật + 20 khi nhận SET_THRESHOLD, nên gửi kèm
    // ngưỡng dừng thực tế để không bị kéo về mặc định.
    let stopSynced = false;
    if (hasThreshold || hasStopThreshold) {
      try {
        await gateway.publish(`SET_STOP_${zoneId}_${stopThreshold}`);
        stopSynced = true;
      } catch (error) {
        console.error(
          "Stop threshold saved but MQTT publish failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    // Lưu lượng quyết định tốc độ ẩm lên trong mô phỏng của firmware.
    let flowSynced = false;
    if (irrigation.flowLitersPerHour !== undefined && setting.flowLitersPerHour !== null) {
      try {
        await gateway.publish(`SET_FLOW_${zoneId}_${setting.flowLitersPerHour}`);
        flowSynced = true;
      } catch (error) {
        console.error(
          "Flow saved but MQTT publish failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    // targetSeconds đã được kiểm tra nên không còn trường hợp gửi 0 ngoài ý muốn.
    let targetSynced = false;
    if (Object.keys(irrigation).length > 0) {
      try {
        await gateway.publish(`SET_TARGET_${zoneId}_${targetSeconds}`);
        targetSynced = true;
      } catch (error) {
        console.error(
          "Target saved but MQTT publish failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    response.json({ ...setting, profile, appliedRemotely, stopSynced, targetSynced, flowSynced });
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

  router.get("/api/devices/:deviceId/push-tokens", (request, response) => {
    const tokens = listPushTokens(request.params.deviceId);
    response.json({
      deviceId: request.params.deviceId,
      count: tokens.length,
      platforms: Array.from(new Set(tokens.map((token) => token.platform))),
    });
  });

  router.post("/api/devices/:deviceId/push-tokens", (request, response) => {
    const body = request.body as { token?: unknown; platform?: unknown } | undefined;
    if (typeof body?.token !== "string" || !isExpoPushToken(body.token)) {
      response.status(400).json({ error: "token must be a valid Expo push token" });
      return;
    }
    if (!isPushPlatform(body.platform)) {
      response.status(400).json({ error: "platform must be ios or android" });
      return;
    }

    const saved = savePushToken(request.params.deviceId, body.token, body.platform);
    response.status(201).json({
      deviceId: request.params.deviceId,
      token: saved.token,
      platform: saved.platform,
      count: listPushTokens(request.params.deviceId).length,
    });
  });

  router.delete("/api/devices/:deviceId/push-tokens", (request, response) => {
    const body = request.body as { token?: unknown } | undefined;
    const token =
      typeof request.query.token === "string"
        ? request.query.token
        : typeof body?.token === "string"
          ? body.token
          : null;

    if (!token) {
      response.status(400).json({ error: "token is required" });
      return;
    }

    response.json({
      deviceId: request.params.deviceId,
      removed: deletePushToken(request.params.deviceId, token),
      count: listPushTokens(request.params.deviceId).length,
    });
  });

  // Gửi thử một thông báo để người dùng kiểm tra quyền và kênh trên máy.
  router.post("/api/devices/:deviceId/notifications/test", async (request, response) => {
    const result = await sendPushToDevice(request.params.deviceId, {
      title: "Greenflow",
      body: "Thông báo thử từ hệ thống tưới thông minh.",
      data: { type: "test", deviceId: request.params.deviceId },
    });

    if (result.targeted === 0) {
      response.status(409).json({ error: "No push tokens registered", ...result });
      return;
    }

    response.json({ deviceId: request.params.deviceId, ...result });
  });

  // Dọn dữ liệu cũ thủ công từ Web; chặn xóa dữ liệu trong ngày hiện tại.
  router.delete("/api/devices/:deviceId/history", (request, response) => {
    const days = queryNumber(request.query.days);
    if (days === undefined || !Number.isInteger(days) || days < 1 || days > 365) {
      response.status(400).json({ error: "days must be an integer between 1 and 365" });
      return;
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const removed = deleteHistoryBefore(request.params.deviceId, cutoff);
    console.log(
      `Deleted history older than ${days} days for ${request.params.deviceId}:`,
      removed,
    );
    response.json({ deviceId: request.params.deviceId, days, cutoff, removed });
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

    // Firmware chỉ nhận lệnh bơm (toàn vườn hoặc từng vùng) khi đang ở chế độ manual.
    if (
      (commandRequest.action === "PUMP_ON" || commandRequest.action === "PUMP_OFF") &&
      getLatestTelemetry(deviceId)?.mode === "auto"
    ) {
      response.status(409).json({ error: "Pump control requires manual mode" });
      return;
    }

    // Lưu ngay ngưỡng mới để cấu hình không mất khi restart, kể cả khi MQTT lỗi.
    let setting: ReturnType<typeof saveZoneSetting> | undefined;
    if (commandRequest.action === "SET_THRESHOLD" && commandRequest.zoneId && isZoneId(commandRequest.zoneId)) {
      const threshold = clampThreshold(Number(commandRequest.value));
      const previous = getZoneSetting(deviceId, commandRequest.zoneId);
      // Vùng đã chỉnh ngưỡng dừng tay thì giữ số đó, chỉ kéo lên nếu sát ngưỡng bật.
      const stopThreshold = previous && previous.stopThreshold !== deriveStopThreshold(previous.threshold)
        ? clampStopThreshold(previous.stopThreshold, threshold)
        : deriveStopThreshold(threshold);
      setting = saveZoneSetting(deviceId, commandRequest.zoneId, threshold, stopThreshold);
    }

    if (commandRequest.action === "SET_STOP" && commandRequest.zoneId && isZoneId(commandRequest.zoneId)) {
      const previous = getZoneSetting(deviceId, commandRequest.zoneId);
      if (previous) {
        setting = saveZoneSetting(
          deviceId,
          commandRequest.zoneId,
          previous.threshold,
          clampStopThreshold(Number(commandRequest.value), previous.threshold),
        );
      }
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
