import { db } from "./db.js";
import { ZONE_IDS, type ZoneId } from "./domain.js";

export const CROP_GROUPS = [
  "Rau ăn lá",
  "Rau ăn quả",
  "Cây lấy củ",
  "Cây gia vị",
  "Khác",
] as const;

export type CropGroup = (typeof CROP_GROUPS)[number];

export const SOIL_TYPES = ["Đất thịt", "Đất cát pha", "Đất sét", "Giá thể"] as const;

export type SoilType = (typeof SOIL_TYPES)[number];

export const DEFAULT_SOIL: SoilType = "Đất thịt";

export type ZoneProfile = {
  zoneId: ZoneId;
  name: string;
  description: string;
  group: CropGroup;
  soil: SoilType;
  plantedAt: number | null;
  harvestDays: number | null;
  notes: string;
  photoFile: string | null;
  updatedAt: number;
};

export type ZoneProfileSeed = {
  id: string;
  name: string;
  crop: string;
  group: string;
};

export type ZoneProfilePatch = {
  name?: string;
  description?: string;
  group?: CropGroup;
  soil?: SoilType;
  plantedAt?: number | null;
  harvestDays?: number | null;
  notes?: string;
};

type ZoneProfileRow = {
  zone_id: string;
  name: string;
  description: string;
  crop_group: string;
  soil: string;
  planted_at: number | null;
  harvest_days: number | null;
  notes: string;
  photo_file: string | null;
  updated_at: number;
};

export function isCropGroup(value: string): value is CropGroup {
  return CROP_GROUPS.includes(value as CropGroup);
}

export function isSoilType(value: string): value is SoilType {
  return SOIL_TYPES.includes(value as SoilType);
}

function toProfile(row: ZoneProfileRow): ZoneProfile {
  return {
    zoneId: row.zone_id as ZoneId,
    name: row.name,
    description: row.description,
    group: isCropGroup(row.crop_group) ? row.crop_group : "Khác",
    soil: isSoilType(row.soil) ? row.soil : DEFAULT_SOIL,
    plantedAt: row.planted_at,
    harvestDays: row.harvest_days,
    notes: row.notes,
    photoFile: row.photo_file,
    updatedAt: row.updated_at,
  };
}

const insertSeed = db.prepare(`
  INSERT INTO zone_profiles
    (device_id, zone_id, name, description, crop_group, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(device_id, zone_id) DO NOTHING
`);

/** Chỉ tạo hồ sơ cho zone chưa có, không ghi đè dữ liệu người dùng đã sửa. */
export function seedZoneProfiles(deviceId: string, zones: ZoneProfileSeed[]): void {
  const seed = db.transaction(() => {
    const now = Date.now();
    for (const zone of zones) {
      insertSeed.run(
        deviceId,
        zone.id,
        zone.name,
        zone.crop,
        isCropGroup(zone.group) ? zone.group : "Khác",
        now,
      );
    }
  });
  seed();
}

export function getZoneProfiles(deviceId: string): ZoneProfile[] {
  const rows = db
    .prepare(`
      SELECT zone_id, name, description, crop_group, soil, planted_at, harvest_days,
             notes, photo_file, updated_at
      FROM zone_profiles
      WHERE device_id = ?
      ORDER BY zone_id
    `)
    .all(deviceId) as ZoneProfileRow[];
  return rows.map(toProfile);
}

export function getZoneProfile(deviceId: string, zoneId: string): ZoneProfile | null {
  const row = db
    .prepare(`
      SELECT zone_id, name, description, crop_group, soil, planted_at, harvest_days,
             notes, photo_file, updated_at
      FROM zone_profiles
      WHERE device_id = ? AND zone_id = ?
    `)
    .get(deviceId, zoneId) as ZoneProfileRow | undefined;
  return row ? toProfile(row) : null;
}

const updateProfile = db.prepare(`
  UPDATE zone_profiles
  SET name = ?, description = ?, crop_group = ?, soil = ?, planted_at = ?,
      harvest_days = ?, notes = ?, updated_at = ?
  WHERE device_id = ? AND zone_id = ?
`);

export function saveZoneProfile(
  deviceId: string,
  zoneId: ZoneId,
  patch: ZoneProfilePatch,
): ZoneProfile | null {
  const current = getZoneProfile(deviceId, zoneId);
  if (!current) return null;

  updateProfile.run(
    patch.name ?? current.name,
    patch.description ?? current.description,
    patch.group ?? current.group,
    patch.soil ?? current.soil,
    patch.plantedAt === undefined ? current.plantedAt : patch.plantedAt,
    patch.harvestDays === undefined ? current.harvestDays : patch.harvestDays,
    patch.notes ?? current.notes,
    Date.now(),
    deviceId,
    zoneId,
  );

  return getZoneProfile(deviceId, zoneId);
}

const updatePhoto = db.prepare(`
  UPDATE zone_profiles SET photo_file = ?, updated_at = ?
  WHERE device_id = ? AND zone_id = ?
`);

export function setZonePhoto(
  deviceId: string,
  zoneId: ZoneId,
  photoFile: string | null,
): ZoneProfile | null {
  if (!ZONE_IDS.includes(zoneId)) return null;
  updatePhoto.run(photoFile, Date.now(), deviceId, zoneId);
  return getZoneProfile(deviceId, zoneId);
}
