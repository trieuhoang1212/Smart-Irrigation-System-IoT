import { pool, transaction } from "./db.js";
import type { Telemetry } from "./domain.js";
import { LIVE_GAP_MS, trackWateringSample } from "./watering-repository.js";

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

export type HistoryQuery = {
  deviceId: string;
  zoneId?: string;
  from?: number;
  to?: number;
  limit?: number;
  bucketMs?: number;
};

// Giới hạn số điểm trả về cho mỗi zone, không phải tổng số dòng của mọi zone.
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

function recordedAtOf(telemetry: Telemetry): number {
  const parsed = Date.parse(telemetry.receivedAt);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

const upsertLatestSql = `
  INSERT INTO latest_telemetry (device_id, payload)
  VALUES ($1, $2)
  ON CONFLICT (device_id) DO UPDATE SET payload = excluded.payload
`;

const insertSampleSql = `
  INSERT INTO telemetry_samples
    (device_id, mode, temperature, humidity, rain, raining, recorded_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING id
`;

const insertZoneSampleSql = `
  INSERT INTO telemetry_zone_samples
    (sample_id, device_id, zone_id, moisture, threshold, stop_threshold, pump, recorded_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;

export async function saveTelemetry(telemetry: Telemetry): Promise<void> {
  const recordedAt = recordedAtOf(telemetry);
  const payload = JSON.stringify(telemetry);

  await transaction(async (client) => {
    await client.query(upsertLatestSql, [telemetry.deviceId, payload]);

    const sample = await client.query<{ id: number }>(insertSampleSql, [
      telemetry.deviceId,
      telemetry.mode,
      telemetry.temperature,
      telemetry.humidity,
      telemetry.rain,
      telemetry.raining ? 1 : 0,
      recordedAt,
    ]);
    const sampleId = sample.rows[0].id;

    for (const zone of telemetry.zones) {
      await client.query(insertZoneSampleSql, [
        sampleId,
        telemetry.deviceId,
        zone.id,
        zone.moisture,
        zone.threshold,
        zone.stopThreshold,
        zone.pump ? 1 : 0,
        recordedAt,
      ]);
      await trackWateringSample(
        client,
        telemetry.deviceId,
        zone.id,
        zone.pump,
        recordedAt,
        LIVE_GAP_MS,
      );
    }
  });
}

// Chỉ cập nhật snapshot mới nhất, không ghi mẫu lịch sử.
// Giữ latest_telemetry bám sát telemetry live thay vì trễ tới 10 giây.
export async function saveLatestTelemetry(telemetry: Telemetry): Promise<void> {
  await pool.query(upsertLatestSql, [
    telemetry.deviceId,
    JSON.stringify(telemetry),
  ]);
}

export async function loadLatestTelemetry(
  deviceId: string,
): Promise<Telemetry | null> {
  const { rows } = await pool.query<LatestRow>(
    "SELECT payload FROM latest_telemetry WHERE device_id = $1",
    [deviceId],
  );
  return rows[0] ? parseTelemetry(rows[0].payload) : null;
}

export async function loadAllLatestTelemetry(): Promise<Telemetry[]> {
  const { rows } = await pool.query<LatestRow>(
    "SELECT payload FROM latest_telemetry",
  );
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

export async function getTelemetryHistory(
  query: HistoryQuery,
): Promise<HistoryRow[]> {
  const from = query.from ?? Date.now() - 24 * 60 * 60 * 1000;
  const to = query.to ?? Date.now();
  const limit = Math.max(
    1,
    Math.min(query.limit ?? DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT),
  );

  const params: Array<string | number> = [query.deviceId, from, to];
  const filters = [
    "z.device_id = $1",
    "z.recorded_at BETWEEN $2 AND $3",
  ];

  if (query.zoneId) {
    params.push(query.zoneId);
    filters.push(`z.zone_id = $${params.length}`);
  }

  params.push(limit);
  const limitPlaceholder = `$${params.length}`;
  const where = filters.join(" AND ");

  if (query.bucketMs && query.bucketMs > 0) {
    params.push(Math.max(1000, Math.floor(query.bucketMs)));
    const bucketPlaceholder = `$${params.length}`;

    const { rows } = await pool.query<HistoryDbRow>(
      `
      WITH bucketed AS (
        SELECT
          (z.recorded_at / ${bucketPlaceholder})::bigint AS bucket,
          z.recorded_at, z.zone_id, z.moisture, z.threshold, z.stop_threshold, z.pump,
          s.temperature, s.humidity, s.rain, s.raining, s.mode
        FROM telemetry_zone_samples z
        JOIN telemetry_samples s ON s.id = z.sample_id
        WHERE ${where}
      ),
      ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY bucket, zone_id ORDER BY recorded_at DESC) AS position
        FROM bucketed
      ),
      grouped AS (
        SELECT
          MAX(CASE WHEN position = 1 THEN recorded_at END) AS recorded_at,
          zone_id,
          MAX(CASE WHEN position = 1 THEN moisture END) AS moisture,
          MAX(CASE WHEN position = 1 THEN temperature END) AS temperature,
          MAX(CASE WHEN position = 1 THEN humidity END) AS humidity,
          MAX(CASE WHEN position = 1 THEN rain END) AS rain,
          MAX(CASE WHEN position = 1 THEN threshold END) AS threshold,
          MAX(CASE WHEN position = 1 THEN stop_threshold END) AS stop_threshold,
          MAX(CASE WHEN position = 1 THEN pump END) AS pump,
          MAX(CASE WHEN position = 1 THEN raining END) AS raining,
          MAX(CASE WHEN position = 1 THEN mode END) AS mode
        FROM ranked
        GROUP BY bucket, zone_id
      ),
      numbered AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY zone_id ORDER BY recorded_at DESC) AS zone_position
        FROM grouped
      )
      SELECT recorded_at, zone_id, moisture, temperature, humidity, rain,
             threshold, stop_threshold, pump, raining, mode
      FROM numbered
      WHERE zone_position <= ${limitPlaceholder}
      ORDER BY recorded_at ASC
      `,
      params,
    );

    return rows.map(toHistoryRow);
  }

  const { rows } = await pool.query<HistoryDbRow>(
    `
    WITH ranked AS (
      SELECT
        z.recorded_at, z.zone_id, z.moisture, z.threshold, z.stop_threshold, z.pump,
        s.temperature, s.humidity, s.rain, s.raining, s.mode,
        ROW_NUMBER() OVER (PARTITION BY z.zone_id ORDER BY z.recorded_at DESC) AS zone_position
      FROM telemetry_zone_samples z
      JOIN telemetry_samples s ON s.id = z.sample_id
      WHERE ${where}
    )
    SELECT recorded_at, zone_id, moisture, threshold, stop_threshold, pump,
           temperature, humidity, rain, raining, mode
    FROM ranked
    WHERE zone_position <= ${limitPlaceholder}
    ORDER BY recorded_at ASC
  `,
    params,
  );

  return rows.map(toHistoryRow);
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

