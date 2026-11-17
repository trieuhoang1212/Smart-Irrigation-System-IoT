import { db } from "./db.js";

export const PUSH_PLATFORMS = ["ios", "android"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export type PushTokenRecord = {
  token: string;
  deviceId: string;
  platform: PushPlatform;
  createdAt: number;
  updatedAt: number;
};

type PushTokenRow = {
  token: string;
  device_id: string;
  platform: string;
  created_at: number;
  updated_at: number;
};

export function isPushPlatform(value: unknown): value is PushPlatform {
  return value === "ios" || value === "android";
}

function mapRow(row: PushTokenRow): PushTokenRecord {
  return {
    token: row.token,
    deviceId: row.device_id,
    platform: isPushPlatform(row.platform) ? row.platform : "android",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listPushTokens(deviceId: string): PushTokenRecord[] {
  const rows = db
    .prepare(
      "SELECT token, device_id, platform, created_at, updated_at FROM push_tokens WHERE device_id = ? ORDER BY updated_at DESC",
    )
    .all(deviceId) as PushTokenRow[];
  return rows.map(mapRow);
}

export function savePushToken(
  deviceId: string,
  token: string,
  platform: PushPlatform,
): PushTokenRecord {
  const now = Date.now();
  // Cùng token có thể đổi máy hoặc thiết bị; luôn gắn lại về device hiện tại.
  db.prepare(`
    INSERT INTO push_tokens (token, device_id, platform, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET
      device_id = excluded.device_id,
      platform = excluded.platform,
      updated_at = excluded.updated_at
  `).run(token, deviceId, platform, now, now);

  return { token, deviceId, platform, createdAt: now, updatedAt: now };
}

export function deletePushToken(deviceId: string, token: string): boolean {
  const result = db
    .prepare("DELETE FROM push_tokens WHERE device_id = ? AND token = ?")
    .run(deviceId, token);
  return result.changes > 0;
}

// Expo báo DeviceNotRegistered khi app bị gỡ; token đó không dùng lại được nữa.
export function deletePushTokens(tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const placeholders = tokens.map(() => "?").join(", ");
  const result = db
    .prepare(`DELETE FROM push_tokens WHERE token IN (${placeholders})`)
    .run(...tokens);
  return result.changes;
}
