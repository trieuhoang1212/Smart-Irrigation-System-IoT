export const ZONE_IDS = ["T001", "T002", "T003", "T004", "T005", "T006"] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export const MIN_THRESHOLD = 10;
export const MAX_THRESHOLD = 90;

export const ZONE_PROFILE_LIMITS = {
  pumpSeconds: { min: 10, max: 600 },
  flowLitersPerHour: { min: 1, max: 200 },
  targetLiters: { min: 0.1, max: 20 },
} as const;

// Firmware dừng bơm thủ công tối đa 10 phút/lần, nên mục tiêu dài hơn sẽ không có cảnh báo.
export function targetSecondsFor(
  flowLitersPerHour: number | null | undefined,
  targetLiters: number | null | undefined,
): number {
  if (!flowLitersPerHour || !targetLiters) return 0;
  const seconds = Math.round((targetLiters / flowLitersPerHour) * 3600);
  return seconds >= 10 && seconds <= 600 ? seconds : 0;
}

export type ZoneState = {
  id: ZoneId;
  moisture: number;
  threshold: number;
  stopThreshold: number;
  pump: boolean;
  // Firmware mới gửi thêm mục tiêu thời gian chạy và cờ vượt mục tiêu thủ công.
  targetSeconds?: number;
  over?: boolean;
};

export type TankState = {
  distanceCm: number | null;
  empty: boolean;
};

export type Telemetry = {
  deviceId: string;
  mode: "auto" | "manual";
  temperature: number | null;
  humidity: number | null;
  rain: number;
  // Firmware cũ dùng mốc cố định 80/100 nên chưa gửi ngưỡng.
  rainThreshold?: number;
  raining: boolean;
  weatherGate: boolean;
  pump: boolean;
  servoAngle: number;
  tank: TankState;
  zones: ZoneState[];
  receivedAt: string;
};

export type CommandRequest = {
  action?: string;
  zoneId?: string;
  value?: number;
};

function numberInRange(
  value: unknown, name: string, min: number, max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

// DHT22 đọc lỗi gửi null, không được biến thành 0.
function nullableNumberInRange(
  value: unknown, name: string, min: number, max: number,
): number | null {
  if (value === null) return null;
  return numberInRange(value, name, min, max);
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
      // Payload firmware cũ không có các trường này.
      targetSeconds: zone.targetSeconds === undefined
        ? undefined
        : numberInRange(zone.targetSeconds, `${id}.targetSeconds`, 0, 3600),
      over: zone.over === undefined ? undefined : booleanValue(zone.over, `${id}.over`),
    });
  });

  if (zoneMap.size !== ZONE_IDS.length) throw new Error("Telemetry must include every zone");
  const zones = ZONE_IDS.map((id) => zoneMap.get(id)!);
  if (raw.deviceId !== expectedDeviceId) throw new Error("Invalid device id");
  if (raw.mode !== "auto" && raw.mode !== "manual") throw new Error("Invalid mode");

  const pump = booleanValue(raw.pump, "pump");

  // Firmware cũ không gửi tank: coi như chưa có số đo.
  let tank: TankState = { distanceCm: null, empty: false };
  if (raw.tank !== undefined) {
    if (!raw.tank || typeof raw.tank !== "object") throw new Error("Invalid tank telemetry");
    const rawTank = raw.tank as Record<string, unknown>;
    tank = {
      distanceCm: nullableNumberInRange(rawTank.distanceCm, "tank.distanceCm", 0, 400),
      empty: booleanValue(rawTank.empty, "tank.empty"),
    };
  }

  return {
    deviceId: expectedDeviceId,
    mode: raw.mode,
    temperature: nullableNumberInRange(raw.temperature, "temperature", -40, 125),
    humidity: nullableNumberInRange(raw.humidity, "humidity", 0, 100),
    rain: numberInRange(raw.rain, "rain", 0, 100),
    rainThreshold: raw.rainThreshold === undefined
      ? undefined
      : numberInRange(raw.rainThreshold, "rainThreshold", 0, 100),
    raining: booleanValue(raw.raining, "raining"),
    weatherGate: booleanValue(raw.weatherGate, "weatherGate"),
    pump,
    // Firmware cũ không gửi góc servo: suy ra từ trạng thái bơm.
    servoAngle: raw.servoAngle === undefined
      ? (pump ? 90 : 0)
      : numberInRange(raw.servoAngle, "servoAngle", 0, 180),
    tank,
    zones,
    receivedAt: new Date().toISOString(),
  };
}

export function toMqttCommand({ action, zoneId, value }: CommandRequest): string | null {
  if (typeof action !== "string" || !/^[A-Z_]+$/.test(action)) return null;
  if (
    zoneId !== undefined &&
    (typeof zoneId !== "string" || !ZONE_IDS.includes(zoneId as ZoneId))
  ) {
    return null;
  }

  if (action === "SET_THRESHOLD") {
    if (zoneId === undefined || typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    const threshold = Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, Math.round(value)));
    return `SET_THRESHOLD_${zoneId}_${threshold}`;
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
