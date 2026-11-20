import { pool, transaction } from "./db.js";
import { ZONE_IDS, type ZoneId } from "./domain.js";

export const CROP_GROUPS = [
  "Rau ăn lá",
  "Rau ăn quả",
  "Cây lấy củ",
  "Cây gia vị",
  "Cây hoa cảnh",
  "Cây ăn quả / thân gỗ",
  "Sen đá / Xương rồng",
  "Cây trong nhà",
  "Hoa lan",
  "Khác",
] as const;

export type CropGroup = (typeof CROP_GROUPS)[number];

export type ZoneProfile = {
  zoneId: ZoneId;
  name: string;
  description: string;
  group: CropGroup;
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
  plantedAt?: number | null;
  harvestDays?: number | null;
  notes?: string;
};

type ZoneProfileRow = {
  zone_id: string;
  name: string;
  description: string;
  crop_group: string;
  planted_at: number | null;
  harvest_days: number | null;
  notes: string;
  photo_file: string | null;
  updated_at: number;
};

export function isCropGroup(value: string): value is CropGroup {
  return CROP_GROUPS.includes(value as CropGroup);
}

function toProfile(row: ZoneProfileRow): ZoneProfile {
  return {
    zoneId: row.zone_id as ZoneId,
    name: row.name,
    description: row.description,
    group: isCropGroup(row.crop_group) ? row.crop_group : "Khác",
    plantedAt: row.planted_at,
    harvestDays: row.harvest_days,
    notes: row.notes,
    photoFile: row.photo_file,
    updatedAt: row.updated_at,
  };
}

const PROFILE_COLUMNS = `
  zone_id, name, description, crop_group, planted_at, harvest_days,
  notes, photo_file, updated_at
`;

/** Chỉ tạo hồ sơ cho zone chưa có, không ghi đè dữ liệu người dùng đã sửa. */
export async function seedZoneProfiles(
  deviceId: string,
  zones: ZoneProfileSeed[],
): Promise<void> {
  await transaction(async (client) => {
    const now = Date.now();
    for (const zone of zones) {
      await client.query(
        `
        INSERT INTO zone_profiles
          (device_id, zone_id, name, description, crop_group, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (device_id, zone_id) DO NOTHING
        `,
        [
          deviceId,
          zone.id,
          zone.name,
          zone.crop,
          isCropGroup(zone.group) ? zone.group : "Khác",
          now,
        ],
      );
    }
  });
}

export async function getZoneProfiles(deviceId: string): Promise<ZoneProfile[]> {
  const { rows } = await pool.query<ZoneProfileRow>(
    `
    SELECT ${PROFILE_COLUMNS}
    FROM zone_profiles
    WHERE device_id = $1
    ORDER BY zone_id
    `,
    [deviceId],
  );
  return rows.map(toProfile);
}

export async function getZoneProfile(
  deviceId: string,
  zoneId: string,
): Promise<ZoneProfile | null> {
  const { rows } = await pool.query<ZoneProfileRow>(
    `
    SELECT ${PROFILE_COLUMNS}
    FROM zone_profiles
    WHERE device_id = $1 AND zone_id = $2
    `,
    [deviceId, zoneId],
  );
  return rows[0] ? toProfile(rows[0]) : null;
}

export async function saveZoneProfile(
  deviceId: string,
  zoneId: ZoneId,
  patch: ZoneProfilePatch,
): Promise<ZoneProfile | null> {
  const current = await getZoneProfile(deviceId, zoneId);
  if (!current) return null;

  const { rows } = await pool.query<ZoneProfileRow>(
    `
    UPDATE zone_profiles
    SET name = $1, description = $2, crop_group = $3, planted_at = $4,
        harvest_days = $5, notes = $6, updated_at = $7
    WHERE device_id = $8 AND zone_id = $9
    RETURNING ${PROFILE_COLUMNS}
    `,
    [
      patch.name ?? current.name,
      patch.description ?? current.description,
      patch.group ?? current.group,
      patch.plantedAt === undefined ? current.plantedAt : patch.plantedAt,
      patch.harvestDays === undefined ? current.harvestDays : patch.harvestDays,
      patch.notes ?? current.notes,
      Date.now(),
      deviceId,
      zoneId,
    ],
  );

  return rows[0] ? toProfile(rows[0]) : null;
}

export async function setZonePhoto(
  deviceId: string,
  zoneId: ZoneId,
  photoFile: string | null,
): Promise<ZoneProfile | null> {
  if (!ZONE_IDS.includes(zoneId)) return null;
  const { rows } = await pool.query<ZoneProfileRow>(
    `
    UPDATE zone_profiles SET photo_file = $1, updated_at = $2
    WHERE device_id = $3 AND zone_id = $4
    RETURNING ${PROFILE_COLUMNS}
    `,
    [photoFile, Date.now(), deviceId, zoneId],
  );
  return rows[0] ? toProfile(rows[0]) : null;
}
