export const ZONE_IDS = ["T001", "T002", "T003", "T004", "T005", "T006"] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export type ZoneState = {
  id: ZoneId;
  moisture: number;
  threshold: number;
  stopThreshold: number;
  pump: boolean;
};

export type Telemetry = {
  deviceId: string;
  mode: "auto" | "manual";
  temperature: number;
  humidity: number;
  rain: number;
  raining: boolean;
  weatherGate: boolean;
  pump: boolean;
  zones: ZoneState[];
  receivedAt: string;
};

export type CommandRequest = {
  action?: string;
  zoneId?: string;
  value?: number;
};

const clamp = (value: unknown, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));

export function normalizeTelemetry(raw: Record<string, unknown>, fallbackDeviceId: string): Telemetry {
  const zones = Array.isArray(raw.zones)
    ? raw.zones
        .filter((zone): zone is Record<string, unknown> => Boolean(zone) && typeof zone === "object")
        .filter((zone) => ZONE_IDS.includes(zone.id as ZoneId))
        .map((zone) => ({
          id: zone.id as ZoneId,
          moisture: clamp(zone.moisture, 0, 100),
          threshold: clamp(zone.threshold, 0, 100),
          stopThreshold: clamp(zone.stopThreshold, 0, 100),
          pump: Boolean(zone.pump),
        }))
    : [];

  return {
    deviceId: typeof raw.deviceId === "string" ? raw.deviceId : fallbackDeviceId,
    mode: raw.mode === "manual" ? "manual" : "auto",
    temperature: Number.isFinite(Number(raw.temperature)) ? Number(raw.temperature) : 0,
    humidity: clamp(raw.humidity, 0, 100),
    rain: clamp(raw.rain, 0, 100),
    raining: Boolean(raw.raining),
    weatherGate: Boolean(raw.weatherGate),
    pump: Boolean(raw.pump),
    zones,
    receivedAt: new Date().toISOString(),
  };
}

export function toMqttCommand({ action, zoneId, value }: CommandRequest): string | null {
  if (!action || !/^[A-Z_]+$/.test(action)) return null;
  if (zoneId !== undefined && !ZONE_IDS.includes(zoneId as ZoneId)) return null;

  if (action === "SET_THRESHOLD") {
    if (zoneId === undefined) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return `SET_THRESHOLD_${zoneId}_${Math.max(0, Math.min(100, Math.round(numeric)))}`;
  }

  if (zoneId !== undefined) {
    return ["PUMP_ON", "PUMP_OFF"].includes(action) ? `${action}_${zoneId}` : null;
  }

  return [
    "MODE_AUTO",
    "MODE_MANUAL",
    "WEATHER_GATE_ON",
    "WEATHER_GATE_OFF",
    "PUMP_ON",
    "PUMP_OFF",
  ].includes(action)
    ? action
    : null;
}
