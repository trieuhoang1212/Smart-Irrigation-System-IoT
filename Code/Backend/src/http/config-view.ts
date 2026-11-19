import {
  MAX_RUN_SECONDS,
  MAX_THRESHOLD,
  MIN_RUN_SECONDS,
  MIN_THRESHOLD,
  STOP_OFFSET,
  ZONE_PROFILE_LIMITS,
  type Telemetry,
} from "../domain.js";
import { gardenConfig } from "../garden-config.js";
import {
  MAX_RAIN_THRESHOLD,
  MIN_RAIN_THRESHOLD,
  RAIN_WARN_OFFSET,
  getGardenRainThreshold,
  getGardenSoil,
  type SoilType,
} from "../garden-settings-repository.js";
import { loadLatestTelemetry } from "../telemetry-repository.js";
import { buildZoneAdvice, growthFor } from "../zone-advice.js";
import { getZoneProfiles } from "../zone-profile-repository.js";
import { getZoneSettings } from "../zone-settings-repository.js";

/** gardenConfig gốc + ngưỡng trong DB + hồ sơ cây do người dùng chỉnh. */
export function buildDeviceConfig(deviceId: string) {
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
        photoUrl: profile?.photoFile
          ? profile.photoFile.startsWith("http") ? profile.photoFile : `/uploads/${profile.photoFile}`
          : null,
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

export type DeviceZone = ReturnType<typeof buildDeviceConfig>["zones"][number];

// Gợi ý chỉ dùng thời tiết còn mới; snapshot quá cũ dễ làm khuyến nghị sai.
const ADVICE_TELEMETRY_MAX_AGE_MS = 30 * 60_000;

export function telemetryForAdvice(deviceId: string): Telemetry | null {
  const telemetry = loadLatestTelemetry(deviceId);
  if (!telemetry) return null;
  const age = Date.now() - Date.parse(telemetry.receivedAt);
  return Number.isFinite(age) && age <= ADVICE_TELEMETRY_MAX_AGE_MS ? telemetry : null;
}

export function adviceForZone(
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
