import { request } from "./client";

export type PushTokenSummary = {
  deviceId: string;
  count: number;
  platforms: string[];
};

export type PushTestResult = {
  deviceId: string;
  targeted: number;
  sent: number;
  invalid: string[];
};

export function getPushTokenSummary(deviceId: string): Promise<PushTokenSummary> {
  return request(
    `/api/devices/${encodeURIComponent(deviceId)}/push-tokens`,
    undefined,
    5000,
  );
}

export function registerPushToken(
  deviceId: string,
  token: string,
  platform: "ios" | "android",
): Promise<{ count: number }> {
  return request(
    `/api/devices/${encodeURIComponent(deviceId)}/push-tokens`,
    {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    },
    8000,
  );
}

export function sendTestPush(deviceId: string): Promise<PushTestResult> {
  return request(
    `/api/devices/${encodeURIComponent(deviceId)}/notifications/test`,
    { method: "POST" },
    15_000,
  );
}
