
import { API_URL, DEVICE_ID } from "./config";

export type ZoneState = {
  id: string;
  moisture: number;
  threshold: number;
  stopThreshold: number;
  pump: boolean;
};

export type Telemetry = {
  deviceId: string;
  mode: "auto" | "manual";
  temperature: number | null;
  humidity: number | null;
  rain: number;
  raining: boolean;
  weatherGate: boolean;
  pump: boolean;
  zones: ZoneState[];
  receivedAt: string;
};

export type ZoneConfig = {
  id: string;
  threshold: number;
  stopThreshold: number;
  [key: string]: unknown;
};

export type DeviceConfig = {
  deviceId: string;
  zones: ZoneConfig[];
  [key: string]: unknown;
};

export type ZoneSettingChange = {
  zoneId: string;
  threshold: number;
  stopThreshold: number;
  updatedAt: number;
  oldThreshold: number | null;
  oldStopThreshold: number | null;
};

export type ConfigChangesResponse = {
  deviceId: string;
  changes: ZoneSettingChange[];
};

export type CommandRequest = {
  action?: string;
  zoneId?: string;
  value?: number;
};

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.error || `Backend error: ${response.status}`
    );
  }

  return response.json() as Promise<T>;
}

export function getLatestTelemetry(): Promise<Telemetry | null> {
  return request(
    `/api/devices/${DEVICE_ID}/telemetry/latest`
  );
}

export function getDeviceConfig(): Promise<DeviceConfig> {
  return request(
    `/api/devices/${DEVICE_ID}/config`
  );
}

export function updateZoneThreshold(
  zoneId: string,
  threshold: number
) {
  if (!Number.isInteger(threshold) || threshold < 10 || threshold > 90) {
    throw new Error("Ngưỡng phải là số nguyên từ 10 đến 90");
  }

  return request<ZoneSettingChange & {
    appliedRemotely: boolean;
  }>(
    `/api/devices/${DEVICE_ID}/config/zones/${zoneId}`,
    {
      method: "PUT",
      body: JSON.stringify({ threshold }),
    }
  );
}

export function getConfigChanges(
  limit = 50
): Promise<ConfigChangesResponse> {
  return request(
    `/api/devices/${DEVICE_ID}/config/changes?limit=${limit}`
  );
}

export function sendCommand(command: CommandRequest) {
  return request(
    `/api/devices/${DEVICE_ID}/commands`,
    {
      method: "POST",
      body: JSON.stringify(command),
    }
  );
}
