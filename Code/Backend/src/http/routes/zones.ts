import { raw, type Router } from "express";
import {
  MAX_RUN_SECONDS,
  MAX_STOP_THRESHOLD,
  MIN_RUN_SECONDS,
  MIN_STOP_GAP,
  ZONE_PROFILE_LIMITS,
  targetSecondsFor,
} from "../../domain.js";
import { gardenConfig } from "../../garden-config.js";
import type { MqttGateway } from "../../mqtt-gateway.js";
import {
  imageExtension,
  removeCloudinaryZonePhoto,
  removeUploadFile,
  saveZonePhotoFile,
} from "../../uploads.js";
import {
  type ZoneProfilePatch,
  getZoneProfile,
  isCropGroup,
  saveZoneProfile,
  setZonePhoto,
} from "../../zone-profile-repository.js";
import {
  clampStopThreshold,
  clampThreshold,
  getZoneSetting,
  isZoneId,
  saveZoneSetting,
  updateZoneIrrigation,
} from "../../zone-settings-repository.js";

export function registerZoneRoutes(router: Router, gateway: MqttGateway) {
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

    const current = await getZoneSetting(deviceId, zoneId);
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

    const profile = hasProfile
      ? await saveZoneProfile(deviceId, zoneId, profilePatch)
      : null;
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
      // Ngưỡng dừng độc lập: giữ số đang dùng, chỉ nâng khi ngưỡng bật vượt qua khoảng cách 10.
      stopThreshold = clampStopThreshold(current.stopThreshold, threshold);
    }

    let setting =
      hasThreshold || hasStopThreshold
        ? await saveZoneSetting(deviceId, zoneId, threshold, stopThreshold)
        : current;

    if (Object.keys(irrigation).length > 0) {
      setting =
        (await updateZoneIrrigation(deviceId, zoneId, irrigation)) ?? setting;
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

    // Gửi kèm ngưỡng dừng hiện tại để DB và thiết bị khớp nhau sau khi đổi ngưỡng bật.
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
    async (request, response) => {
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

      const previous = await getZoneProfile(deviceId, zoneId);
      const photoFile = await saveZonePhotoFile(deviceId, zoneId, extension, request.body);
      await setZonePhoto(deviceId, zoneId, photoFile);
      await removeUploadFile(previous?.photoFile ?? null);

      response.json({
        photoUrl: photoFile.startsWith("http") ? photoFile : `/uploads/${photoFile}`,
      });
    },
  );

  router.delete("/api/devices/:deviceId/config/zones/:zoneId/photo", async (request, response) => {
    const { deviceId, zoneId } = request.params;
    if (!isZoneId(zoneId) || !gardenConfig.zones.some((zone) => zone.id === zoneId)) {
      response.status(404).json({ error: "Zone not found" });
      return;
    }

    const previous = await getZoneProfile(deviceId, zoneId);
    await setZonePhoto(deviceId, zoneId, null);
    await removeUploadFile(previous?.photoFile ?? null);
    await removeCloudinaryZonePhoto(deviceId, zoneId, previous?.photoFile ?? null);

    response.json({ photoUrl: null });
  });
}
