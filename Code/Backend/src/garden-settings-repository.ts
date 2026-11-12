import { db } from "./db.js";

export const SOIL_TYPES = ["Đất phù sa", "Đất đỏ bazan", "Đất cát"] as const;

export type SoilType = (typeof SOIL_TYPES)[number];

export const DEFAULT_SOIL: SoilType = "Đất phù sa";

export function isSoilType(value: string): value is SoilType {
  return SOIL_TYPES.includes(value as SoilType);
}

export function getGardenSoil(deviceId: string): SoilType {
  const row = db
    .prepare("SELECT soil FROM garden_settings WHERE device_id = ?")
    .get(deviceId) as { soil: string } | undefined;
  return row && isSoilType(row.soil) ? row.soil : DEFAULT_SOIL;
}

export function saveGardenSoil(
  deviceId: string,
  soil: SoilType,
): { soil: SoilType; updatedAt: number } {
  const updatedAt = Date.now();
  db.prepare(`
    INSERT INTO garden_settings (device_id, soil, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET soil = excluded.soil, updated_at = excluded.updated_at
  `).run(deviceId, soil, updatedAt);
  return { soil, updatedAt };
}
