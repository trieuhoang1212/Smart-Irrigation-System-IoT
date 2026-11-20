import type { Router } from "express";
import { gardenConfig } from "../../garden-config.js";
import { getLatestTelemetry } from "../../live.js";
import {
  deleteHistoryBefore,
  getTelemetryHistory,
  getWateringOverview,
} from "../../telemetry-repository.js";
import { isZoneId } from "../../zone-settings-repository.js";
import { queryNumber } from "../query.js";

export function registerTelemetryRoutes(router: Router) {
  router.get("/api/devices/:deviceId/telemetry/latest", (request, response) => {
    const telemetry = getLatestTelemetry(request.params.deviceId);
    if (!telemetry) {
      response.status(404).json({ error: "Telemetry not available" });
      return;
    }
    response.json(telemetry);
  });

  router.get("/api/devices/:deviceId/telemetry/history", async (request, response) => {
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

    const samples = await getTelemetryHistory({
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

  router.get("/api/devices/:deviceId/watering", async (request, response) => {
    const deviceId = request.params.deviceId;
    const now = Date.now();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const from = startOfDay.getTime();

    const overview = await getWateringOverview(deviceId, from);
    const byZone = new Map(overview.map((item) => [item.zoneId, item]));

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

  // Dọn dữ liệu cũ thủ công từ Web; chặn xóa dữ liệu trong ngày hiện tại.
  router.delete("/api/devices/:deviceId/history", async (request, response) => {
    const days = queryNumber(request.query.days);
    if (days === undefined || !Number.isInteger(days) || days < 1 || days > 365) {
      response.status(400).json({ error: "days must be an integer between 1 and 365" });
      return;
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const removed = await deleteHistoryBefore(
      request.params.deviceId,
      cutoff,
    );
    console.log(
      `Deleted history older than ${days} days for ${request.params.deviceId}:`,
      removed,
    );
    response.json({ deviceId: request.params.deviceId, days, cutoff, removed });
  });
}
