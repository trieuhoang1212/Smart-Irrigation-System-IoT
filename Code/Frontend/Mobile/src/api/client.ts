
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
    throw new Error(`Backend error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getLatestTelemetry(): Promise<Telemetry | null> {
  return request(
    `/api/devices/${DEVICE_ID}/telemetry/latest`
  );
}

export function sendCommand(
  command: CommandRequest
) {
  return request(
    `/api/devices/${DEVICE_ID}/commands`,
    {
      method: "POST",
      body: JSON.stringify(command),
    }
  );
}
