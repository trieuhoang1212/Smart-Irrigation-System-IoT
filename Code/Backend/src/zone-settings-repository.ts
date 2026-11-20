import type { PoolClient } from "pg";
import { pool, transaction } from "./db.js";
import {
  MAX_STOP_THRESHOLD,
  MAX_THRESHOLD,
  MIN_STOP_GAP,
  MIN_THRESHOLD,
  STOP_OFFSET,
  ZONE_IDS,
  type ZoneId,
} from "./domain.js";

export type ZoneSetting = {
  zoneId: ZoneId;
  threshold: number;
  stopThreshold: number;
  flowLitersPerHour: number | null;
  targetLiters: number | null;
  updatedAt: number;
};

export type ZoneSettingChange = {
  zoneId: ZoneId;
  threshold: number;
  stopThreshold: number;
  oldThreshold: number | null;
  oldStopThreshold: number | null;
  updatedAt: number;
};

export type ZoneIrrigationPatch = {
  flowLitersPerHour?: number;
  targetLiters?: number;
};

type ZoneSettingRow = {
  zone_id: string;
  threshold: number;
  stop_threshold: number;
  flow_lph: number | null;
  target_liters: number | null;
  updated_at: number;
};

type ZoneSettingChangeRow = {
  zone_id: string;
  threshold: number;
  stop_threshold: number;
  old_threshold: number | null;
  old_stop_threshold: number | null;
  updated_at: number;
};

/** Mặc định gợi ý: ngưỡng dừng = ngưỡng bật + 20 (giới hạn 100). */
export function deriveStopThreshold(threshold: number): number {
  return Math.min(MAX_STOP_THRESHOLD, threshold + STOP_OFFSET);
}

export function clampThreshold(value: number): number {
  return Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, Math.round(value)));
}

/** Ngưỡng dừng phải cách ngưỡng bật tối thiểu 10 điểm để tránh bơm đóng cắt liên tục. */
export function clampStopThreshold(value: number, threshold: number): number {
  return Math.max(
    threshold + MIN_STOP_GAP,
    Math.min(MAX_STOP_THRESHOLD, Math.round(value)),
  );
}

export function isZoneId(value: string): value is ZoneId {
  return ZONE_IDS.includes(value as ZoneId);
}

function toZoneSetting(row: ZoneSettingRow): ZoneSetting {
  return {
    zoneId: row.zone_id as ZoneId,
    threshold: row.threshold,
    stopThreshold: row.stop_threshold,
    flowLitersPerHour: row.flow_lph,
    targetLiters: row.target_liters,
    updatedAt: row.updated_at,
  };
}

const ZONE_SETTING_COLUMNS = `
  zone_id, threshold, stop_threshold, flow_lph, target_liters, updated_at
`;

type ZoneSeed = {
  id: string;
  threshold: number;
  stopThreshold: number;
  flowLitersPerHour: number;
  targetLiters: number;
};

/** Tạo giá trị mặc định cho zone chưa có trong DB (không ghi đè giá trị đã lưu). */
export async function seedZoneSettings(
  deviceId: string,
  zones: ZoneSeed[],
): Promise<void> {
  await transaction(async (client) => {
    const now = Date.now();
    for (const zone of zones) {
      await client.query(
        `
        INSERT INTO zone_settings
          (device_id, zone_id, threshold, stop_threshold, flow_lph, target_liters, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (device_id, zone_id) DO UPDATE SET
          flow_lph = COALESCE(zone_settings.flow_lph, excluded.flow_lph),
          target_liters = COALESCE(zone_settings.target_liters, excluded.target_liters)
        `,
        [
          deviceId,
          zone.id,
          zone.threshold,
          zone.stopThreshold,
          zone.flowLitersPerHour,
          zone.targetLiters,
          now,
        ],
      );
    }
  });
}

async function getZoneSettingOn(
  client: PoolClient,
  deviceId: string,
  zoneId: string,
): Promise<ZoneSetting | null> {
  const { rows } = await client.query<ZoneSettingRow>(
    `
    SELECT ${ZONE_SETTING_COLUMNS}
    FROM zone_settings
    WHERE device_id = $1 AND zone_id = $2
    `,
    [deviceId, zoneId],
  );
  return rows[0] ? toZoneSetting(rows[0]) : null;
}

export async function getZoneSettings(deviceId: string): Promise<ZoneSetting[]> {
  const { rows } = await pool.query<ZoneSettingRow>(
    `
    SELECT ${ZONE_SETTING_COLUMNS}
    FROM zone_settings
    WHERE device_id = $1
    ORDER BY zone_id
    `,
    [deviceId],
  );
  return rows.map(toZoneSetting);
}

export async function getZoneSetting(
  deviceId: string,
  zoneId: string,
): Promise<ZoneSetting | null> {
  const { rows } = await pool.query<ZoneSettingRow>(
    `
    SELECT ${ZONE_SETTING_COLUMNS}
    FROM zone_settings
    WHERE device_id = $1 AND zone_id = $2
    `,
    [deviceId, zoneId],
  );
  return rows[0] ? toZoneSetting(rows[0]) : null;
}

export async function saveZoneSetting(
  deviceId: string,
  zoneId: ZoneId,
  threshold: number,
  stopThreshold: number,
): Promise<ZoneSetting> {
  return transaction(async (client) => {
    const previous = await getZoneSettingOn(client, deviceId, zoneId);
    const now = Date.now();

    if (
      previous &&
      previous.threshold === threshold &&
      previous.stopThreshold === stopThreshold
    ) {
      return previous;
    }

    await client.query(
      `
      INSERT INTO zone_settings (device_id, zone_id, threshold, stop_threshold, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (device_id, zone_id) DO UPDATE SET
        threshold = excluded.threshold,
        stop_threshold = excluded.stop_threshold,
        updated_at = excluded.updated_at
      `,
      [deviceId, zoneId, threshold, stopThreshold, now],
    );

    await client.query(
      `
      INSERT INTO zone_setting_changes
        (device_id, zone_id, old_threshold, new_threshold, old_stop_threshold, new_stop_threshold, changed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        deviceId,
        zoneId,
        previous?.threshold ?? null,
        threshold,
        previous?.stopThreshold ?? null,
        stopThreshold,
        now,
      ],
    );

    return (await getZoneSettingOn(client, deviceId, zoneId))!;
  });
}

/** Cập nhật thông số nước (không ảnh hưởng ngưỡng đang áp xuống thiết bị). */
export async function updateZoneIrrigation(
  deviceId: string,
  zoneId: ZoneId,
  patch: ZoneIrrigationPatch,
): Promise<ZoneSetting | null> {
  const current = await getZoneSetting(deviceId, zoneId);
  if (!current) return null;

  const { rows } = await pool.query<ZoneSettingRow>(
    `
    UPDATE zone_settings
    SET flow_lph = $1, target_liters = $2, updated_at = $3
    WHERE device_id = $4 AND zone_id = $5
    RETURNING ${ZONE_SETTING_COLUMNS}
    `,
    [
      patch.flowLitersPerHour ?? current.flowLitersPerHour,
      patch.targetLiters ?? current.targetLiters,
      Date.now(),
      deviceId,
      zoneId,
    ],
  );

  return rows[0] ? toZoneSetting(rows[0]) : null;
}

export async function listZoneSettingChanges(
  deviceId: string,
  limit = 50,
): Promise<ZoneSettingChange[]> {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const { rows } = await pool.query<ZoneSettingChangeRow>(
    `
    SELECT zone_id,
           new_threshold AS threshold,
           new_stop_threshold AS stop_threshold,
           changed_at AS updated_at,
           old_threshold, old_stop_threshold
    FROM zone_setting_changes
    WHERE device_id = $1
    ORDER BY changed_at DESC
    LIMIT $2
    `,
    [deviceId, safeLimit],
  );

  return rows.map((row) => ({
    zoneId: row.zone_id as ZoneId,
    threshold: row.threshold,
    stopThreshold: row.stop_threshold,
    oldThreshold: row.old_threshold,
    oldStopThreshold: row.old_stop_threshold,
    updatedAt: row.updated_at,
  }));
}
