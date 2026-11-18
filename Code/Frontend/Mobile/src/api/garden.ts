import { File as ExpoFile, UploadType } from "expo-file-system";

import { API_URL } from "./config";
import { ApiError, request } from "./client";
import type { GardenConfig, ZoneConfigInput, ZoneProfileInput } from "./types";

// Render free tier có thể mất ~50s để thức dậy, nên upload ảnh chờ lâu hơn request thường.
const UPLOAD_TIMEOUT_MS = 60_000;

function photoEndpoint(deviceId: string, zoneId: string): string {
  return `${API_URL}/api/devices/${encodeURIComponent(deviceId)}/config/zones/${encodeURIComponent(zoneId)}/photo`;
}

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

/** Web: gửi thẳng File của trình duyệt. */
export async function uploadZonePhoto(
  deviceId: string,
  zoneId: string,
  body: Blob,
  contentType: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(photoEndpoint(deviceId, zoneId), {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError(`Backend trả về lỗi ${response.status}`, response.status);
    }

    const result = (await response.json()) as { photoUrl: string };
    return result.photoUrl;
  } finally {
    clearTimeout(timer);
  }
}

/** Native: để tầng native đọc tệp và gửi nhị phân, khỏi dựng Blob trong JS. */
export async function uploadZonePhotoFromFile(
  deviceId: string,
  zoneId: string,
  file: ExpoFile,
  contentType: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const result = await file.upload(photoEndpoint(deviceId, zoneId), {
      httpMethod: "POST",
      uploadType: UploadType.BINARY_CONTENT,
      headers: { "Content-Type": contentType },
      mimeType: contentType,
      signal: controller.signal,
    });

    if (result.status < 200 || result.status >= 300) {
      throw new ApiError(`Backend trả về lỗi ${result.status}`, result.status);
    }

    return (JSON.parse(result.body) as { photoUrl: string }).photoUrl;
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
