import { pool } from "./db.js";

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

export async function listPushTokens(
  deviceId: string,
): Promise<PushTokenRecord[]> {
  const { rows } = await pool.query<PushTokenRow>(
    "SELECT token, device_id, platform, created_at, updated_at FROM push_tokens WHERE device_id = $1 ORDER BY updated_at DESC",
    [deviceId],
  );
  return rows.map(mapRow);
}

export async function savePushToken(
  deviceId: string,
  token: string,
  platform: PushPlatform,
): Promise<PushTokenRecord> {
  const now = Date.now();
  // Cùng token có thể đổi máy hoặc thiết bị; luôn gắn lại về device hiện tại.
  await pool.query(
    `
    INSERT INTO push_tokens (token, device_id, platform, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (token) DO UPDATE SET
      device_id = excluded.device_id,
      platform = excluded.platform,
      updated_at = excluded.updated_at
    `,
    [token, deviceId, platform, now, now],
  );

  return { token, deviceId, platform, createdAt: now, updatedAt: now };
}

export async function deletePushToken(
  deviceId: string,
  token: string,
): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM push_tokens WHERE device_id = $1 AND token = $2",
    [deviceId, token],
  );
  return (result.rowCount ?? 0) > 0;
}

// Expo báo DeviceNotRegistered khi app bị gỡ; token đó không dùng lại được nữa.
export async function deletePushTokens(tokens: string[]): Promise<number> {
  if (tokens.length === 0) return 0;
  const placeholders = tokens.map((_, index) => `$${index + 1}`).join(", ");
  const result = await pool.query(
    `DELETE FROM push_tokens WHERE token IN (${placeholders})`,
    tokens,
  );
  return result.rowCount ?? 0;
}
