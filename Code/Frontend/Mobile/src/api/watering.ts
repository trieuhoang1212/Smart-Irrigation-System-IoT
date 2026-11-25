import { request } from "./client";
import type { WateringResponse, ZoneWateringSummary } from "./types";

export async function getWatering(
  deviceId: string,
): Promise<Record<string, ZoneWateringSummary>> {
  const body = await request<WateringResponse>(
    `/api/devices/${encodeURIComponent(deviceId)}/watering`,
  );
  return Object.fromEntries(body.zones.map((zone) => [zone.zoneId, zone]));
}
