import { db } from "./db.js";
import type { Telemetry } from "./domain.js";

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
  }
});

export function saveTelemetry(telemetry: Telemetry): void {
  persistTelemetry(telemetry);
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
