import { request } from "./client";

export type CommandStatus = "pending" | "confirmed" | "timeout";

export type CommandRow = {
  commandId: string;
  command: string;
  status: CommandStatus;
  createdAt: number;
};

export type SettingChangeRow = {
  zoneId: string;
  threshold: number;
  updatedAt: number;
  oldThreshold: number | null;
};

export async function getDeviceActivity(
  deviceId: string,
  limit = 50,
): Promise<{ commands: CommandRow[]; changes: SettingChangeRow[] }> {
  const base = `/api/devices/${encodeURIComponent(deviceId)}`;

  const [commands, changes] = await Promise.all([
    request<{ commands?: CommandRow[] }>(`${base}/commands?limit=${limit}`),
    request<{ changes?: SettingChangeRow[] }>(`${base}/config/changes?limit=${limit}`),
  ]);

  return {
    commands: commands.commands ?? [],
    changes: changes.changes ?? [],
  };
}
