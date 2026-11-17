import { Platform } from "react-native";
import { fetch as expoFetch } from "expo/fetch";

import { API_URL } from "./config";
import { ApiError, request } from "./client";
import type { GardenConfig, ZoneConfigInput, ZoneProfileInput } from "./types";

const UPLOAD_TIMEOUT_MS = 30_000;

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

export function saveZoneProfile(
  deviceId: string,
  zoneId: string,
  input: ZoneProfileInput,
): Promise<unknown> {
  return request(
    `/api/devices/${encodeURIComponent(deviceId)}/config/zones/${encodeURIComponent(zoneId)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
    8000,
  );
}

export async function uploadZonePhoto(
  deviceId: string,
  zoneId: string,
  body: Blob,
  contentType: string,
): Promise<string> {
  const poster: typeof fetch =
    Platform.OS === "web" ? fetch : (expoFetch as unknown as typeof fetch);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await poster(
      `${API_URL}/api/devices/${encodeURIComponent(deviceId)}/config/zones/${encodeURIComponent(zoneId)}/photo`,
      {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new ApiError(`Backend trả về lỗi ${response.status}`, response.status);
    }

    const result = (await response.json()) as { photoUrl: string };
    return result.photoUrl;
  } finally {
    clearTimeout(timer);
  }
}

export async function deleteZonePhoto(
  deviceId: string,
  zoneId: string,
): Promise<void> {
  await request(
    `/api/devices/${encodeURIComponent(deviceId)}/config/zones/${encodeURIComponent(zoneId)}/photo`,
    { method: "DELETE" },
    8000,
  );
}

export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
