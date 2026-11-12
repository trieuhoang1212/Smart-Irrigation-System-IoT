import { ApiError, request } from "./client";
import type { HealthResponse } from "./types";

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health", undefined, 4000);
}

export function isMissingTelemetry(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
