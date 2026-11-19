import type { Router } from "express";
import type { MqttGateway } from "../../mqtt-gateway.js";
import {
  deriveStopThreshold,
  isZoneId,
  listZoneSettingChanges,
  saveZoneSetting,
} from "../../zone-settings-repository.js";
import {
  isSoilType,
  saveGardenRainThreshold,
  saveGardenSoil,
} from "../../garden-settings-repository.js";
import { gardenConfig } from "../../garden-config.js";
import { adviceForZone, buildDeviceConfig, telemetryForAdvice } from "../config-view.js";
import { queryNumber } from "../query.js";

export function registerConfigRoutes(router: Router, gateway: MqttGateway) {
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
}
