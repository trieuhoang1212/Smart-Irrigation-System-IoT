export const ZONE_IDS = ["T001", "T002", "T003", "T004", "T005", "T006"] as const;

export type ZoneId = (typeof ZONE_IDS)[number];
export type Mode = "auto" | "manual";

export type ZoneState = {
  id: string;
  moisture: number;
  threshold: number;
  stopThreshold: number;
  pump: boolean;
};

export type Telemetry = {
  deviceId: string;
  mode: Mode;
  temperature: number | null;
  humidity: number | null;
  rain: number;
  raining: boolean;
  weatherGate: boolean;
  pump: boolean;
  servoAngle: number;
  zones: ZoneState[];
  receivedAt: string;
};

export type GardenZone = {
  id: string;
  name: string;
  crop: string;
  group: string;
  threshold: number;
  stopThreshold: number;
  method: string;
  duration: number;
  pumpSeconds: number;
  flowLitersPerHour: number;
  targetLiters: number;
  color: string;
};

export type GardenConfig = {
  deviceId: string;
  zones: GardenZone[];
};

export type LiveZone = GardenZone & {
  moisture: number | null;
  pump: boolean;
  online: boolean;
};

export type CommandRequest = {
  action: string;
  zoneId?: string;
  value?: number;
};

export type CommandResponse = {
  accepted: boolean;
  commandId?: string;
  command?: string;
  sentAt?: string;
};

export type ZoneConfigInput = {
  threshold?: number;
  duration: number;
  pumpSeconds: number;
  flowLitersPerHour: number;
  targetLiters: number;
};

export type HistorySample = {
  recordedAt: number;
  zoneId: string;
  moisture: number;
  threshold: number;
  stopThreshold: number;
  pump: boolean;
  temperature: number | null;
  humidity: number | null;
  rain: number;
  raining: boolean;
  mode: Mode;
};

export type HistoryResponse = {
  samples: HistorySample[];
  bucketMs: number;
};

export type HealthResponse = {
  ok: boolean;
  mqtt: boolean;
  onlineDevices: number;
};

export type RealtimeMessage =
  | { type: "telemetry"; data: Telemetry; online: boolean }
  | { type: "device-status"; deviceId: string; online: boolean }
  | {
      type: "command-result";
      commandId: string;
      deviceId: string;
      status: "confirmed" | "timeout";
    };
