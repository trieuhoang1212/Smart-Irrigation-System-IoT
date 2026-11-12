import { BACKEND_URL, backendUrl } from "./backend";
import type { CropGroup, GardenConfigResponse, SoilType, Zone, ZoneAdvice } from "../garden-data";

export type ZoneProfileInput = {
  name: string;
  crop: string;
  group: CropGroup;
  soil: SoilType;
  plantedAt: number | null;
  harvestDays: number | null;
  notes: string;
};

function configUrl(deviceId: string): string {
  return backendUrl(`/api/devices/${encodeURIComponent(deviceId)}/config`);
}

export async function fetchGardenConfig(): Promise<GardenConfigResponse> {
  const response = await fetch(backendUrl("/api/config"));
  if (!response.ok) throw new Error(`Không tải được cấu hình (${response.status})`);
  return (await response.json()) as GardenConfigResponse;
}

export async function saveZoneProfile(
  deviceId: string,
  zoneId: string,
  input: ZoneProfileInput,
): Promise<void> {
  const response = await fetch(`${configUrl(deviceId)}/zones/${zoneId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Không lưu được hồ sơ cây (${response.status})`);
}

export async function fetchZoneAdvice(
  deviceId: string,
  zoneId: string,
): Promise<ZoneAdvice> {
  const response = await fetch(`${configUrl(deviceId)}/zones/${zoneId}/advice`);
  if (!response.ok) throw new Error(`Không tải được khuyến nghị (${response.status})`);
  return (await response.json()) as ZoneAdvice;
}

export async function uploadZonePhoto(
  deviceId: string,
  zoneId: string,
  file: Blob,
): Promise<string> {
  const response = await fetch(`${configUrl(deviceId)}/zones/${zoneId}/photo`, {
    method: "POST",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!response.ok) throw new Error(`Không tải ảnh lên được (${response.status})`);
  const body = (await response.json()) as { photoUrl: string };
  return body.photoUrl;
}

export async function deleteZonePhoto(deviceId: string, zoneId: string): Promise<void> {
  const response = await fetch(`${configUrl(deviceId)}/zones/${zoneId}/photo`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`Không xoá được ảnh (${response.status})`);
}

export function zoneInitial(zone: Zone): string {
  return zone.name.trim().charAt(0).toUpperCase();
}

export { BACKEND_URL };
