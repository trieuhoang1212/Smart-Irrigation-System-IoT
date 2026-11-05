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
  temperature: number;
  humidity: number;
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
  /** Gộp nhiều mẫu vào một điểm (mili-giây) để chart dài ngày nhẹ hơn. */
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
  temperature: number;
  humidity: number;
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

  const filters = ["z.device_id = ?", "z.recorded_at BETWEEN ? AND ?"];
  const params: Array<string | number> = [query.deviceId, from, to];

  if (query.zoneId) {
    filters.push("z.zone_id = ?");
    params.push(query.zoneId);
  }

  if (query.bucketMs && query.bucketMs > 0) {
    const bucket = Math.max(1000, Math.floor(query.bucketMs));
    const rows = db
      .prepare(`
        SELECT
          CAST(z.recorded_at / ? AS INTEGER) * ? AS recorded_at,
          z.zone_id,
          AVG(z.moisture) AS moisture,
          AVG(z.threshold) AS threshold,
          AVG(z.stop_threshold) AS stop_threshold,
          MAX(z.pump) AS pump,
          AVG(s.temperature) AS temperature,
          AVG(s.humidity) AS humidity,
          AVG(s.rain) AS rain,
          MAX(s.raining) AS raining,
          MAX(s.mode) AS mode
        FROM telemetry_zone_samples z
        JOIN telemetry_samples s ON s.id = z.sample_id
        WHERE ${filters.join(" AND ")}
        GROUP BY 1, 2
        ORDER BY 1 ASC
        LIMIT ?
      `)
      .all(bucket, bucket, ...params, limit) as HistoryDbRow[];

    return rows.map(toHistoryRow);
  }

  // Lấy mẫu mới nhất trước rồi đảo lại để trả về theo thứ tự thời gian tăng dần.
  const rows = db
    .prepare(`
      SELECT
        z.recorded_at, z.zone_id, z.moisture, z.threshold, z.stop_threshold, z.pump,
        s.temperature, s.humidity, s.rain, s.raining, s.mode
      FROM telemetry_zone_samples z
      JOIN telemetry_samples s ON s.id = z.sample_id
      WHERE ${filters.join(" AND ")}
      ORDER BY z.recorded_at DESC
      LIMIT ?
    `)
    .all(...params, limit) as HistoryDbRow[];

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

export function pruneHistory(retentionDays: number): number {
  const safeDays = Math.max(1, Math.floor(retentionDays));
  const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;

  const removedSamples = db
    .prepare("DELETE FROM telemetry_samples WHERE recorded_at < ?")
    .run(cutoff);

  db.prepare("DELETE FROM command_log WHERE created_at < ?").run(cutoff);

  return removedSamples.changes;
}
