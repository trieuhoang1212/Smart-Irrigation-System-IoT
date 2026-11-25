import type { Telemetry } from "../domain.js";

export const latestByDevice = new Map<string, Telemetry>();
export const onlineByDevice = new Map<string, boolean>();
export const lastLiveAtByDevice = new Map<string, number>();
export const lastHistoryWriteByDevice = new Map<string, number>();

export function getLatestTelemetry(deviceId: string): Telemetry | undefined {
  return latestByDevice.get(deviceId);
}

export function getLiveStats() {
  return {
    devices: latestByDevice.size,
    onlineDevices: Array.from(onlineByDevice.values()).filter(Boolean).length,
  };
}
