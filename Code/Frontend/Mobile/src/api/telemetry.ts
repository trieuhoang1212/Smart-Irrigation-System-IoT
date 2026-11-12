import { request } from "./client";
import { isMissingTelemetry } from "./health";
import type { HistoryResponse, Telemetry } from "./types";

export async function getLatestTelemetry(deviceId: string): Promise<Telemetry | null> {
  try {
    return await request<Telemetry>(
      `/api/devices/${encodeURIComponent(deviceId)}/telemetry/latest`,
    );
  } catch (error) {
    if (isMissingTelemetry(error)) return null;
    throw error;
  }
}

export function getTelemetryHistory(input: {
  deviceId: string;
  zoneId?: string;
  from: number;
  to: number;
  bucketMs: number;
}): Promise<HistoryResponse> {
  const params = new URLSearchParams({
    from: String(input.from),
    to: String(input.to),
    bucketMs: String(input.bucketMs),
  });
  if (input.zoneId) params.set("zoneId", input.zoneId);

  return request<HistoryResponse>(
    `/api/devices/${encodeURIComponent(input.deviceId)}/telemetry/history?${params.toString()}`,
  );
}
