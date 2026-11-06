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

function numberInRange(value: unknown, name: string, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new Error(`Invalid ${name}`);
  }
  return numeric;
}

function booleanValue(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Invalid ${name}`);
  return value;
}

export function normalizeTelemetry(raw: Record<string, unknown>, expectedDeviceId: string): Telemetry {
  if (!Array.isArray(raw.zones)) throw new Error("Telemetry zones are required");

  const zoneMap = new Map<ZoneId, ZoneState>();
  raw.zones.forEach((value) => {
    if (!value || typeof value !== "object") throw new Error("Invalid zone telemetry");
    const zone = value as Record<string, unknown>;
    if (!ZONE_IDS.includes(zone.id as ZoneId)) throw new Error("Invalid zone id");
    const id = zone.id as ZoneId;
    if (zoneMap.has(id)) throw new Error("Duplicate zone telemetry");
    zoneMap.set(id, {
      id,
      moisture: numberInRange(zone.moisture, `${id}.moisture`, 0, 100),
      threshold: numberInRange(zone.threshold, `${id}.threshold`, 0, 100),
      stopThreshold: numberInRange(zone.stopThreshold, `${id}.stopThreshold`, 0, 100),
      pump: booleanValue(zone.pump, `${id}.pump`),
    });
  });

  if (zoneMap.size !== ZONE_IDS.length) throw new Error("Telemetry must include every zone");
  const zones = ZONE_IDS.map((id) => zoneMap.get(id)!);
  if (raw.deviceId !== expectedDeviceId) throw new Error("Invalid device id");
  if (raw.mode !== "auto" && raw.mode !== "manual") throw new Error("Invalid mode");

  return {
    deviceId: expectedDeviceId,
    mode: raw.mode,
    temperature: numberInRange(raw.temperature, "temperature", -40, 125),
    humidity: numberInRange(raw.humidity, "humidity", 0, 100),
    rain: numberInRange(raw.rain, "rain", 0, 100),
    raining: booleanValue(raw.raining, "raining"),
    weatherGate: booleanValue(raw.weatherGate, "weatherGate"),
    pump: booleanValue(raw.pump, "pump"),
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
    return `SET_THRESHOLD_${zoneId}_${Math.max(10, Math.min(90, Math.round(numeric)))}`;
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
