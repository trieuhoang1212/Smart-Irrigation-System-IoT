import { request } from "./client";
import type { GardenConfig, ZoneConfigInput } from "./types";

export function getGardenConfig(): Promise<GardenConfig> {
  return request<GardenConfig>("/api/config");
}

export function saveZoneConfig(
  deviceId: string,
  zoneId: string,
  input: ZoneConfigInput,
): Promise<unknown> {
  return request(
    `/api/devices/${encodeURIComponent(deviceId)}/config/zones/${encodeURIComponent(zoneId)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
    6000,
  );
}
