import { db } from "./db.js";
import type { Telemetry } from "./domain.js";
import { getZoneSetting } from "./zone-settings-repository.js";

export type CommandStatus = "pending" | "confirmed" | "timeout" | "failed";

export type HistoryRow = {
  recordedAt: number;
  zoneId: string;
  moisture: number;
  threshold: number;
  stopThreshold: number;
  pump: boolean;
  temperature: number | null;
  humidity: number | null;
  rain: number;
  raining: boolean;
  mode: "auto" | "manual";
};

export type CommandLogRow = {
  commandId: string;
  deviceId: string;
  command: string;
  status: CommandStatus;
  createdAt: number;
  resolvedAt: number | null;
};

export type HistoryQuery = {
  deviceId: string;
  zoneId?: string;
  from?: number;
  to?: number;
  limit?: number;
  bucketMs?: number;
};

const DEFAULT_HISTORY_LIMIT = 2000;
const MAX_HISTORY_LIMIT = 10000;

type LatestRow = {
  payload: string;
};

type HistoryDbRow = {
  recorded_at: number;
  zone_id: string;
  moisture: number;
  threshold: number;
  stop_threshold: number;
  pump: number;
  temperature: number | null;
  humidity: number | null;
  rain: number;
  raining: number;
  mode: string;
};

type CommandDbRow = {
  command_id: string;
  device_id: string;
  command: string;
  status: string;
  created_at: number;
  resolved_at: number | null;
};

function recordedAtOf(telemetry: Telemetry): number {
  const parsed = Date.parse(telemetry.receivedAt);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

const upsertLatest = db.prepare(`
  INSERT INTO latest_telemetry (device_id, payload, received_at, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(device_id) DO UPDATE SET
    payload = excluded.payload,
    received_at = excluded.received_at,
    updated_at = excluded.updated_at
`);

const insertSample = db.prepare(`
  INSERT INTO telemetry_samples
    (device_id, mode, temperature, humidity, rain, raining, weather_gate, pump, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertZoneSample = db.prepare(`
  INSERT INTO telemetry_zone_samples
    (sample_id, device_id, zone_id, moisture, threshold, stop_threshold, pump, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Telemetry thật 2–10 giây/lần; mất tín hiệu quá 60 giây coi như lần tưới đã kết thúc.
const LIVE_GAP_MS = 60_000;
// Dữ liệu demo ghi 5 phút/lần nên khi dựng lại lịch sử cần khoảng đệm lớn hơn.
const BACKFILL_GAP_MS = 15 * 60_000;

type OpenWateringRun = {
  id: number;
  started_at: number;
  last_seen_at: number;
};

type WateringDbRow = {
  zone_id: string;
  started_at: number;
  ended_at: number;
  seconds: number;
  liters: number;
};

export type WateringRun = {
  startedAt: number;
  endedAt: number;
  seconds: number;
  liters: number;
};

export type ZoneWateringOverview = {
  zoneId: string;
  lastRun: WateringRun | null;
  todayLiters: number;
  todayRuns: number;
};

const findOpenWateringRun = db.prepare(`
  SELECT id, started_at, last_seen_at FROM watering_runs
  WHERE device_id = ? AND zone_id = ? AND ended_at IS NULL
  ORDER BY id DESC
  LIMIT 1
`);

const insertWateringRun = db.prepare(`
  INSERT INTO watering_runs (device_id, zone_id, started_at, last_seen_at)
  VALUES (?, ?, ?, ?)
`);

const touchWateringRun = db.prepare(
  "UPDATE watering_runs SET last_seen_at = ? WHERE id = ?",
);

const closeWateringRun = db.prepare(`
  UPDATE watering_runs
  SET ended_at = ?, last_seen_at = ?, seconds = ?, liters = ?
  WHERE id = ?
`);

function roundLiters(liters: number): number {
  return Math.round(liters * 100) / 100;
}

function finishWateringRun(
  run: OpenWateringRun,
  endedAt: number,
  deviceId: string,
  zoneId: string,
): void {
  const seconds = Math.max(0, (endedAt - run.started_at) / 1000);
  const flow = getZoneSetting(deviceId, zoneId)?.flowLitersPerHour ?? 0;
  closeWateringRun.run(endedAt, endedAt, seconds, roundLiters((seconds / 3600) * flow), run.id);
}

function trackWateringSample(
  deviceId: string,
  zoneId: string,
  pumpOn: boolean,
  recordedAt: number,
  gapMs: number,
): void {
  const open = findOpenWateringRun.get(deviceId, zoneId) as OpenWateringRun | undefined;

  if (pumpOn) {
    if (open && recordedAt - open.last_seen_at > gapMs) {
      finishWateringRun(open, open.last_seen_at, deviceId, zoneId);
      insertWateringRun.run(deviceId, zoneId, recordedAt, recordedAt);
      return;
    }
    if (open) {
      touchWateringRun.run(recordedAt, open.id);
      return;
    }
    insertWateringRun.run(deviceId, zoneId, recordedAt, recordedAt);
    return;
  }

  if (!open) return;
  const endedAt = recordedAt - open.last_seen_at <= gapMs ? recordedAt : open.last_seen_at;
  finishWateringRun(open, endedAt, deviceId, zoneId);
}

const persistTelemetry = db.transaction((telemetry: Telemetry) => {
  const recordedAt = recordedAtOf(telemetry);
  const payload = JSON.stringify(telemetry);

  upsertLatest.run(telemetry.deviceId, payload, telemetry.receivedAt, recordedAt);

  const sample = insertSample.run(
    telemetry.deviceId,
    telemetry.mode,
    telemetry.temperature,
    telemetry.humidity,
    telemetry.rain,
    telemetry.raining ? 1 : 0,
    telemetry.weatherGate ? 1 : 0,
    telemetry.pump ? 1 : 0,
    recordedAt,
  );
  const sampleId = Number(sample.lastInsertRowid);

  for (const zone of telemetry.zones) {
    insertZoneSample.run(
      sampleId,
      telemetry.deviceId,
      zone.id,
      zone.moisture,
      zone.threshold,
      zone.stopThreshold,
      zone.pump ? 1 : 0,
      recordedAt,
    );
    trackWateringSample(telemetry.deviceId, zone.id, zone.pump, recordedAt, LIVE_GAP_MS);
  }
});

export function saveTelemetry(telemetry: Telemetry): void {
  persistTelemetry(telemetry);
}

type PumpSampleRow = {
  zone_id: string;
  pump: number;
  recorded_at: number;
};

type TodayWateringRow = {
  zone_id: string;
  runs: number;
  liters: number;
};

const selectRecentPumpSamples = db.prepare(`
  SELECT zone_id, pump, recorded_at
  FROM telemetry_zone_samples
  WHERE device_id = ? AND recorded_at >= ?
  ORDER BY recorded_at ASC
`);

const countWateringRuns = db.prepare(
  "SELECT COUNT(*) AS total FROM watering_runs WHERE device_id = ?",
);

const selectLastRuns = db.prepare(`
  SELECT zone_id, started_at, ended_at, seconds, liters FROM (
    SELECT
      zone_id, started_at, ended_at, seconds, liters,
      ROW_NUMBER() OVER (PARTITION BY zone_id ORDER BY ended_at DESC) AS position
    FROM watering_runs
    WHERE device_id = ? AND ended_at IS NOT NULL
  )
  WHERE position = 1
`);

const selectTodayRuns = db.prepare(`
  SELECT zone_id, COUNT(*) AS runs, COALESCE(SUM(liters), 0) AS liters
  FROM watering_runs
  WHERE device_id = ? AND ended_at IS NOT NULL AND ended_at >= ?
  GROUP BY zone_id
`);

const backfillWatering = db.transaction((deviceId: string, since: number) => {
  const rows = selectRecentPumpSamples.all(deviceId, since) as PumpSampleRow[];
  for (const row of rows) {
    trackWateringSample(
      deviceId,
      row.zone_id,
      Boolean(row.pump),
      row.recorded_at,
      BACKFILL_GAP_MS,
    );
  }
  return rows.length;
});

/**
 * Dựng lại lịch sử tưới từ telemetry đã lưu (chỉ chạy một lần cho mỗi thiết bị).
 */
export function backfillWateringRuns(deviceId: string, hours = 24): number {
  const existing = countWateringRuns.get(deviceId) as { total: number };
  if (existing.total > 0) return 0;
  const since = Date.now() - Math.max(1, hours) * 60 * 60 * 1000;
  return backfillWatering(deviceId, since);
}

export function getWateringOverview(
  deviceId: string,
  since: number,
): ZoneWateringOverview[] {
  const overview = new Map<string, ZoneWateringOverview>();

  for (const row of selectLastRuns.all(deviceId) as WateringDbRow[]) {
    overview.set(row.zone_id, {
      zoneId: row.zone_id,
      lastRun: {
        startedAt: row.started_at,
        endedAt: row.ended_at,
        seconds: Math.round(row.seconds),
        liters: roundLiters(row.liters),
      },
      todayLiters: 0,
      todayRuns: 0,
    });
  }

  for (const row of selectTodayRuns.all(deviceId, since) as TodayWateringRow[]) {
    const current = overview.get(row.zone_id) ?? {
      zoneId: row.zone_id,
      lastRun: null,
      todayLiters: 0,
      todayRuns: 0,
    };
    current.todayLiters = roundLiters(row.liters);
    current.todayRuns = row.runs;
    overview.set(row.zone_id, current);
  }

  return [...overview.values()];
}

export function loadLatestTelemetry(deviceId: string): Telemetry | null {
  const row = db
    .prepare("SELECT payload FROM latest_telemetry WHERE device_id = ?")
    .get(deviceId) as LatestRow | undefined;
  return row ? parseTelemetry(row.payload) : null;
}

export function loadAllLatestTelemetry(): Telemetry[] {
  const rows = db.prepare("SELECT payload FROM latest_telemetry").all() as LatestRow[];
  return rows.flatMap((row) => {
    const telemetry = parseTelemetry(row.payload);
    return telemetry ? [telemetry] : [];
  });
}

function parseTelemetry(payload: string): Telemetry | null {
  try {
    return JSON.parse(payload) as Telemetry;
  } catch {
    return null;
  }
}

export function getTelemetryHistory(query: HistoryQuery): HistoryRow[] {
  const from = query.from ?? Date.now() - 24 * 60 * 60 * 1000;
  const to = query.to ?? Date.now();
  const limit = Math.max(
    1,
    Math.min(query.limit ?? DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT),
  );

  const filters = ["z.device_id = :deviceId", "z.recorded_at BETWEEN :from AND :to"];
  const params: Record<string, string | number> = { deviceId: query.deviceId, from, to };

  if (query.zoneId) {
    filters.push("z.zone_id = :zoneId");
    params.zoneId = query.zoneId;
  }

  if (query.bucketMs && query.bucketMs > 0) {
    const rows = db
      .prepare(`
        WITH bucketed AS (
          SELECT
            CAST(z.recorded_at / :bucket AS INTEGER) AS bucket,
            z.recorded_at, z.zone_id, z.moisture, z.threshold, z.stop_threshold, z.pump,
            s.temperature, s.humidity, s.rain, s.raining, s.mode
          FROM telemetry_zone_samples z
          JOIN telemetry_samples s ON s.id = z.sample_id
          WHERE ${filters.join(" AND ")}
        ),
        ranked AS (
          SELECT *,
            ROW_NUMBER() OVER (PARTITION BY bucket, zone_id ORDER BY recorded_at DESC) AS position
          FROM bucketed
        )
        SELECT
          bucket * :bucket AS recorded_at,
          zone_id,
          AVG(moisture) AS moisture,
          AVG(temperature) AS temperature,
          AVG(humidity) AS humidity,
          AVG(rain) AS rain,
          MAX(CASE WHEN position = 1 THEN threshold END) AS threshold,
          MAX(CASE WHEN position = 1 THEN stop_threshold END) AS stop_threshold,
          MAX(CASE WHEN position = 1 THEN pump END) AS pump,
          MAX(CASE WHEN position = 1 THEN raining END) AS raining,
          MAX(CASE WHEN position = 1 THEN mode END) AS mode
        FROM ranked
        GROUP BY bucket, zone_id
        ORDER BY bucket DESC
        LIMIT :limit
      `)
      .all({ ...params, bucket: Math.max(1000, Math.floor(query.bucketMs)), limit }) as HistoryDbRow[];

    return rows.reverse().map(toHistoryRow);
  }

  const rows = db
    .prepare(`
      SELECT
        z.recorded_at, z.zone_id, z.moisture, z.threshold, z.stop_threshold, z.pump,
        s.temperature, s.humidity, s.rain, s.raining, s.mode
      FROM telemetry_zone_samples z
      JOIN telemetry_samples s ON s.id = z.sample_id
      WHERE ${filters.join(" AND ")}
      ORDER BY z.recorded_at DESC
      LIMIT :limit
    `)
    .all({ ...params, limit }) as HistoryDbRow[];

  return rows.reverse().map(toHistoryRow);
}

function toHistoryRow(row: HistoryDbRow): HistoryRow {
  return {
    recordedAt: row.recorded_at,
    zoneId: row.zone_id,
    moisture: row.moisture,
    threshold: row.threshold,
    stopThreshold: row.stop_threshold,
    pump: Boolean(row.pump),
    temperature: row.temperature,
    humidity: row.humidity,
    rain: row.rain,
    raining: Boolean(row.raining),
    mode: row.mode === "manual" ? "manual" : "auto",
  };
}

export function logCommand(commandId: string, deviceId: string, command: string): void {
  db.prepare(`
    INSERT INTO command_log (command_id, device_id, command, status, created_at)
    VALUES (?, ?, ?, 'pending', ?)
  `).run(commandId, deviceId, command, Date.now());
}

export function resolveCommand(commandId: string, status: CommandStatus): void {
  db.prepare(`
    UPDATE command_log
    SET status = ?, resolved_at = ?
    WHERE command_id = ? AND status = 'pending'
  `).run(status, Date.now(), commandId);
}

export function listCommands(deviceId: string, limit = 50): CommandLogRow[] {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const rows = db
    .prepare(`
      SELECT command_id, device_id, command, status, created_at, resolved_at
      FROM command_log
      WHERE device_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(deviceId, safeLimit) as CommandDbRow[];

  return rows.map((row) => ({
    commandId: row.command_id,
    deviceId: row.device_id,
    command: row.command,
    status: row.status as CommandStatus,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }));
}

export function timeoutStaleCommands(): number {
  return db
    .prepare(`
      UPDATE command_log
      SET status = 'timeout', resolved_at = ?
      WHERE status = 'pending'
    `)
    .run(Date.now()).changes;
}

export function pruneHistory(retentionDays: number): number {
  const safeDays = Math.max(1, Math.floor(retentionDays));
  const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;

  const removedSamples = db
    .prepare("DELETE FROM telemetry_samples WHERE recorded_at < ?")
    .run(cutoff);

  db.prepare("DELETE FROM command_log WHERE created_at < ?").run(cutoff);
  db.prepare("DELETE FROM zone_setting_changes WHERE changed_at < ?").run(cutoff);

  return removedSamples.changes;
}
