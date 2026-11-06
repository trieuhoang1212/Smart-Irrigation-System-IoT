import { db } from "./db.js";
import { ZONE_IDS, type ZoneId } from "./domain.js";

export type ZoneSetting = {
  zoneId: ZoneId;
  threshold: number;
  stopThreshold: number;
  updatedAt: number;
};

export type ZoneSettingChange = ZoneSetting & {
  oldThreshold: number | null;
  oldStopThreshold: number | null;
};

type ZoneSettingRow = {
  zone_id: string;
  threshold: number;
  stop_threshold: number;
  updated_at: number;
};

type ZoneSettingChangeRow = ZoneSettingRow & {
  old_threshold: number | null;
  old_stop_threshold: number | null;
};

const MIN_THRESHOLD = 10;
const MAX_THRESHOLD = 90;
const STOP_OFFSET = 20;

/** Firmware đặt ngưỡng dừng = ngưỡng bật + 20 (giới hạn 100). */
export function deriveStopThreshold(threshold: number): number {
  return Math.min(100, threshold + STOP_OFFSET);
}

export function clampThreshold(value: number): number {
  return Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, Math.round(value)));
}

export function isZoneId(value: string): value is ZoneId {
  return ZONE_IDS.includes(value as ZoneId);
}

function toZoneSetting(row: ZoneSettingRow): ZoneSetting {
  return {
    zoneId: row.zone_id as ZoneId,
    threshold: row.threshold,
    stopThreshold: row.stop_threshold,
    updatedAt: row.updated_at,
  };
}

const insertDefault = db.prepare(`
  INSERT INTO zone_settings (device_id, zone_id, threshold, stop_threshold, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(device_id, zone_id) DO NOTHING
`);

/** Tạo giá trị mặc định cho zone chưa có trong DB (không ghi đè giá trị đã lưu). */
export function seedZoneSettings(
  deviceId: string,
  zones: Array<{ id: string; threshold: number; stopThreshold: number }>,
): void {
  const seed = db.transaction(() => {
    const now = Date.now();
    for (const zone of zones) {
      insertDefault.run(deviceId, zone.id, zone.threshold, zone.stopThreshold, now);
    }
  });
  seed();
}

export function getZoneSettings(deviceId: string): ZoneSetting[] {
  const rows = db
    .prepare(`
      SELECT zone_id, threshold, stop_threshold, updated_at
      FROM zone_settings
      WHERE device_id = ?
      ORDER BY zone_id
    `)
    .all(deviceId) as ZoneSettingRow[];
  return rows.map(toZoneSetting);
}

export function getZoneSetting(deviceId: string, zoneId: string): ZoneSetting | null {
  const row = db
    .prepare(`
      SELECT zone_id, threshold, stop_threshold, updated_at
      FROM zone_settings
      WHERE device_id = ? AND zone_id = ?
    `)
    .get(deviceId, zoneId) as ZoneSettingRow | undefined;
  return row ? toZoneSetting(row) : null;
}

const upsertSetting = db.prepare(`
  INSERT INTO zone_settings (device_id, zone_id, threshold, stop_threshold, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(device_id, zone_id) DO UPDATE SET
    threshold = excluded.threshold,
    stop_threshold = excluded.stop_threshold,
    updated_at = excluded.updated_at
`);

const insertChange = db.prepare(`
  INSERT INTO zone_setting_changes
    (device_id, zone_id, old_threshold, new_threshold, old_stop_threshold, new_stop_threshold, changed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const persistSetting = db.transaction(
  (deviceId: string, zoneId: string, threshold: number, stopThreshold: number) => {
    const previous = getZoneSetting(deviceId, zoneId);
    const now = Date.now();

    if (previous && previous.threshold === threshold && previous.stopThreshold === stopThreshold) {
      return previous;
    }

    upsertSetting.run(deviceId, zoneId, threshold, stopThreshold, now);
    insertChange.run(
      deviceId,
      zoneId,
      previous?.threshold ?? null,
      threshold,
      previous?.stopThreshold ?? null,
      stopThreshold,
      now,
    );

    return { zoneId: zoneId as ZoneId, threshold, stopThreshold, updatedAt: now };
  },
);

export function saveZoneSetting(
  deviceId: string,
  zoneId: ZoneId,
  threshold: number,
  stopThreshold: number,
): ZoneSetting {
  return persistSetting(deviceId, zoneId, threshold, stopThreshold);
}

export function listZoneSettingChanges(deviceId: string, limit = 50): ZoneSettingChange[] {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const rows = db
    .prepare(`
      SELECT zone_id,
             new_threshold AS threshold,
             new_stop_threshold AS stop_threshold,
             changed_at AS updated_at,
             old_threshold, old_stop_threshold
      FROM zone_setting_changes
      WHERE device_id = ?
      ORDER BY changed_at DESC
      LIMIT ?
    `)
    .all(deviceId, safeLimit) as ZoneSettingChangeRow[];

  return rows.map((row) => ({
    ...toZoneSetting(row),
    oldThreshold: row.old_threshold,
    oldStopThreshold: row.old_stop_threshold,
  }));
}
