import { request } from "./client";
import type { CommandRequest, CommandResponse } from "./types";

export function sendCommand(
  deviceId: string,
  command: CommandRequest,
): Promise<CommandResponse> {
  return request<CommandResponse>(
    `/api/devices/${encodeURIComponent(deviceId)}/commands`,
    {
      method: "POST",
      body: JSON.stringify(command),
    },
    5000,
  );
}