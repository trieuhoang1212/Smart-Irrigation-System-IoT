import { pool } from "./db.js";

export const SOIL_TYPES = ["Đất phù sa", "Đất đỏ bazan", "Đất cát"] as const;

export type SoilType = (typeof SOIL_TYPES)[number];

export const DEFAULT_SOIL: SoilType = "Đất phù sa";

// Ngưỡng mưa do người dùng chỉnh từ Web; mốc cảnh báo đi trước 20 điểm.
export const DEFAULT_RAIN_THRESHOLD = 100;
export const MIN_RAIN_THRESHOLD = 40;
export const MAX_RAIN_THRESHOLD = 100;
export const RAIN_WARN_OFFSET = 20;

export function clampRainThreshold(value: number): number {
  return Math.max(
    MIN_RAIN_THRESHOLD,
    Math.min(MAX_RAIN_THRESHOLD, Math.round(value)),
  );
}

export function isSoilType(value: string): value is SoilType {
  return SOIL_TYPES.includes(value as SoilType);
}

export async function getGardenSoil(deviceId: string): Promise<SoilType> {
  const { rows } = await pool.query<{ soil: string }>(
    "SELECT soil FROM garden_settings WHERE device_id = $1",
    [deviceId],
  );
  const row = rows[0];
  return row && isSoilType(row.soil) ? row.soil : DEFAULT_SOIL;
}

export async function saveGardenSoil(
  deviceId: string,
  soil: SoilType,
): Promise<{ soil: SoilType; updatedAt: number }> {
  const updatedAt = Date.now();
  await pool.query(
    `
    INSERT INTO garden_settings (device_id, soil, updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (device_id) DO UPDATE SET
      soil = excluded.soil,
      updated_at = excluded.updated_at
    `,
    [deviceId, soil, updatedAt],
  );
  return { soil, updatedAt };
}

export async function getGardenRainThreshold(deviceId: string): Promise<number> {
  const { rows } = await pool.query<{ rain_threshold: number }>(
    "SELECT rain_threshold FROM garden_settings WHERE device_id = $1",
    [deviceId],
  );
  const row = rows[0];
  return row ? clampRainThreshold(row.rain_threshold) : DEFAULT_RAIN_THRESHOLD;
}

export async function saveGardenRainThreshold(
  deviceId: string,
  threshold: number,
): Promise<{ rainThreshold: number; updatedAt: number }> {
  const rainThreshold = clampRainThreshold(threshold);
  const updatedAt = Date.now();
  await pool.query(
    `
    INSERT INTO garden_settings (device_id, rain_threshold, updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (device_id) DO UPDATE SET
      rain_threshold = excluded.rain_threshold,
      updated_at = excluded.updated_at
    `,
    [deviceId, rainThreshold, updatedAt],
  );
  return { rainThreshold, updatedAt };
}
