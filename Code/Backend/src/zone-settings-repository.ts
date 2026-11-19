import { db } from "./db.js";
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

/** Ngưỡng dừng phải cách ngưỡng bật tối thiểu 5 điểm để tránh bơm đóng cắt liên tục. */
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

const insertDefault = db.prepare(`
  INSERT INTO zone_settings
    (device_id, zone_id, threshold, stop_threshold, flow_lph, target_liters, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(device_id, zone_id) DO UPDATE SET
    flow_lph = COALESCE(zone_settings.flow_lph, excluded.flow_lph),
    target_liters = COALESCE(zone_settings.target_liters, excluded.target_liters)
`);

type ZoneSeed = {
  id: string;
  threshold: number;
  stopThreshold: number;
  flowLitersPerHour: number;
  targetLiters: number;
};

/** Tạo giá trị mặc định cho zone chưa có trong DB (không ghi đè giá trị đã lưu). */
export function seedZoneSettings(deviceId: string, zones: ZoneSeed[]): void {
  const seed = db.transaction(() => {
    const now = Date.now();
    for (const zone of zones) {
      insertDefault.run(
        deviceId,
        zone.id,
        zone.threshold,
        zone.stopThreshold,
        zone.flowLitersPerHour,
        zone.targetLiters,
        now,
      );
    }
  });
  seed();
}

export function getZoneSettings(deviceId: string): ZoneSetting[] {
  const rows = db
    .prepare(
      `
      SELECT zone_id, threshold, stop_threshold, flow_lph, target_liters, updated_at
      FROM zone_settings
      WHERE device_id = ?
      ORDER BY zone_id
    `,
    )
    .all(deviceId) as ZoneSettingRow[];
  return rows.map(toZoneSetting);
}

export function getZoneSetting(
  deviceId: string,
  zoneId: string,
): ZoneSetting | null {
  const row = db
    .prepare(
      `
      SELECT zone_id, threshold, stop_threshold, flow_lph, target_liters, updated_at
      FROM zone_settings
      WHERE device_id = ? AND zone_id = ?
    `,
    )
    .get(deviceId, zoneId) as ZoneSettingRow | undefined;
  return row ? toZoneSetting(row) : null;
}

const upsertThreshold = db.prepare(`
  INSERT INTO zone_settings (device_id, zone_id, threshold, stop_threshold, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(device_id, zone_id) DO UPDATE SET
    threshold = excluded.threshold,
    stop_threshold = excluded.stop_threshold,
    updated_at = excluded.updated_at
`);

const updateIrrigation = db.prepare(`
  UPDATE zone_settings
  SET flow_lph = ?, target_liters = ?, updated_at = ?
  WHERE device_id = ? AND zone_id = ?
`);

const insertChange = db.prepare(`
  INSERT INTO zone_setting_changes
    (device_id, zone_id, old_threshold, new_threshold, old_stop_threshold, new_stop_threshold, changed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const persistThreshold = db.transaction(
  (
    deviceId: string,
    zoneId: string,
    threshold: number,
    stopThreshold: number,
  ) => {
    const previous = getZoneSetting(deviceId, zoneId);
    const now = Date.now();

    if (
      previous &&
      previous.threshold === threshold &&
      previous.stopThreshold === stopThreshold
    ) {
      return previous;
    }

    upsertThreshold.run(deviceId, zoneId, threshold, stopThreshold, now);
    insertChange.run(
      deviceId,
      zoneId,
      previous?.threshold ?? null,
      threshold,
      previous?.stopThreshold ?? null,
      stopThreshold,
      now,
    );

    return getZoneSetting(deviceId, zoneId)!;
  },
);

export function saveZoneSetting(
  deviceId: string,
  zoneId: ZoneId,
  threshold: number,
  stopThreshold: number,
): ZoneSetting {
  return persistThreshold(deviceId, zoneId, threshold, stopThreshold);
}

/** Cập nhật thông số nước (không ảnh hưởng ngưỡng đang áp xuống thiết bị). */
export function updateZoneIrrigation(
  deviceId: string,
  zoneId: ZoneId,
  patch: ZoneIrrigationPatch,
): ZoneSetting | null {
  const current = getZoneSetting(deviceId, zoneId);
  if (!current) return null;

  updateIrrigation.run(
    patch.flowLitersPerHour ?? current.flowLitersPerHour,
    patch.targetLiters ?? current.targetLiters,
    Date.now(),
    deviceId,
    zoneId,
  );

  return getZoneSetting(deviceId, zoneId);
}

export function listZoneSettingChanges(
  deviceId: string,
  limit = 50,
): ZoneSettingChange[] {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const rows = db
    .prepare(
      `
      SELECT zone_id,
             new_threshold AS threshold,
             new_stop_threshold AS stop_threshold,
             changed_at AS updated_at,
             old_threshold, old_stop_threshold
      FROM zone_setting_changes
      WHERE device_id = ?
      ORDER BY changed_at DESC
      LIMIT ?
    `,
    )
    .all(deviceId, safeLimit) as ZoneSettingChangeRow[];

  return rows.map((row) => ({
    zoneId: row.zone_id as ZoneId,
    threshold: row.threshold,
    stopThreshold: row.stop_threshold,
    oldThreshold: row.old_threshold,
    oldStopThreshold: row.old_stop_threshold,
    updatedAt: row.updated_at,
  }));
}
