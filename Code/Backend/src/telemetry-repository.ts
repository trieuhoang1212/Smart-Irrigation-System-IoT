import type { PoolClient } from "pg";
import { pool, transaction } from "./db.js";
import type { Telemetry } from "./domain.js";

export type CommandStatus = "pending" | "confirmed" | "timeout";

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

// Telemetry thật 2–10 giây/lần; mất tín hiệu quá 60 giây coi như lần tưới đã kết thúc.
const LIVE_GAP_MS = 60_000;
// Dữ liệu demo ghi 5 phút/lần nên khi dựng lại lịch sử cần khoảng đệm lớn hơn.
const BACKFILL_GAP_MS = 15 * 60_000;

// Chạy quá lâu không có telemetry thì coi như đã dừng, tránh hiện lần tưới ảo.
const OPEN_RUN_STALE_MS = 15 * 60_000;

type OpenWateringRun = {
  id: number;
  started_at: number;
  last_seen_at: number;
  flow_lph: number;
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

const findOpenWateringRunSql = `
  SELECT id, started_at, last_seen_at, flow_lph FROM watering_runs
  WHERE device_id = $1 AND zone_id = $2 AND ended_at IS NULL
  ORDER BY id DESC
  LIMIT 1
`;

const insertWateringRunSql = `
  INSERT INTO watering_runs (device_id, zone_id, started_at, last_seen_at, flow_lph)
  VALUES ($1, $2, $3, $4, $5)
`;

const touchWateringRunSql =
  "UPDATE watering_runs SET last_seen_at = $1 WHERE id = $2";

const closeWateringRunSql = `
  UPDATE watering_runs
  SET ended_at = $1, last_seen_at = $2, seconds = $3, liters = $4
  WHERE id = $5
`;

function roundLiters(liters: number): number {
  return Math.round(liters * 100) / 100;
}

async function zoneFlowOn(
  client: PoolClient,
  deviceId: string,
  zoneId: string,
): Promise<number> {
  const { rows } = await client.query<{ flow_lph: number | null }>(
    "SELECT flow_lph FROM zone_settings WHERE device_id = $1 AND zone_id = $2",
    [deviceId, zoneId],
  );
  return rows[0]?.flow_lph ?? 0;
}

async function finishWateringRun(
  client: PoolClient,
  run: OpenWateringRun,
  endedAt: number,
  deviceId: string,
  zoneId: string,
): Promise<void> {
  const seconds = Math.max(0, (endedAt - run.started_at) / 1000);
  // Run cũ (backfill) chưa lưu lưu lượng thì tạm dùng cấu hình hiện tại.
  const flow =
    run.flow_lph > 0 ? run.flow_lph : await zoneFlowOn(client, deviceId, zoneId);
  await client.query(closeWateringRunSql, [
    endedAt,
    endedAt,
    seconds,
    roundLiters((seconds / 3600) * flow),
    run.id,
  ]);
}

async function trackWateringSample(
  client: PoolClient,
  deviceId: string,
  zoneId: string,
  pumpOn: boolean,
  recordedAt: number,
  gapMs: number,
): Promise<void> {
  const { rows } = await client.query<OpenWateringRun>(
    findOpenWateringRunSql,
    [deviceId, zoneId],
  );
  const open = rows[0];

  if (pumpOn) {
    const flow = await zoneFlowOn(client, deviceId, zoneId);
    if (open && recordedAt - open.last_seen_at > gapMs) {
      await finishWateringRun(client, open, open.last_seen_at, deviceId, zoneId);
      await client.query(insertWateringRunSql, [
        deviceId,
        zoneId,
        recordedAt,
        recordedAt,
        flow,
      ]);
      return;
    }
    if (open) {
      await client.query(touchWateringRunSql, [recordedAt, open.id]);
      return;
    }
    await client.query(insertWateringRunSql, [
      deviceId,
      zoneId,
      recordedAt,
      recordedAt,
      flow,
    ]);
    return;
  }

  if (!open) return;
  // Bơm tắt ở giữa hai mẫu; lấy điểm giữa để không luôn cộng dư một chu kỳ.
  const endedAt =
    recordedAt - open.last_seen_at <= gapMs
      ? Math.round((open.last_seen_at + recordedAt) / 2)
      : open.last_seen_at;
  await finishWateringRun(client, open, endedAt, deviceId, zoneId);
}

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

const selectRecentPumpSamplesSql = `
  SELECT zone_id, pump, recorded_at
  FROM telemetry_zone_samples
  WHERE device_id = $1 AND recorded_at >= $2
  ORDER BY recorded_at ASC
`;

const countWateringRunsSql =
  "SELECT COUNT(*) AS total FROM watering_runs WHERE device_id = $1";

const selectLastRunsSql = `
  SELECT zone_id, started_at, ended_at, seconds, liters FROM (
    SELECT
      zone_id, started_at, ended_at, seconds, liters,
      ROW_NUMBER() OVER (PARTITION BY zone_id ORDER BY ended_at DESC) AS position
    FROM watering_runs
    WHERE device_id = $1 AND ended_at IS NOT NULL
  ) AS ranked
  WHERE position = 1
`;

const selectTodayRunsSql = `
  SELECT zone_id, COUNT(*) AS runs, COALESCE(SUM(liters), 0) AS liters
  FROM watering_runs
  WHERE device_id = $1 AND ended_at IS NOT NULL AND ended_at >= $2
  GROUP BY zone_id
`;

const selectOpenRunsSql = `
  SELECT zone_id, started_at, last_seen_at, flow_lph
  FROM watering_runs
  WHERE device_id = $1 AND ended_at IS NULL
`;

/**
 * Dựng lại lịch sử tưới từ telemetry đã lưu (chỉ chạy một lần cho mỗi thiết bị).
 */
export async function backfillWateringRuns(
  deviceId: string,
  hours = 24,
): Promise<number> {
  const { rows: countRows } = await pool.query<{ total: number }>(
    countWateringRunsSql,
    [deviceId],
  );
  if (countRows[0].total > 0) return 0;

  const since = Date.now() - Math.max(1, hours) * 60 * 60 * 1000;
  return transaction(async (client) => {
    const { rows } = await client.query<PumpSampleRow>(
      selectRecentPumpSamplesSql,
      [deviceId, since],
    );
    for (const row of rows) {
      await trackWateringSample(
        client,
        deviceId,
        row.zone_id,
        Boolean(row.pump),
        row.recorded_at,
        BACKFILL_GAP_MS,
      );
    }
    return rows.length;
  });
}

export async function getWateringOverview(
  deviceId: string,
  since: number,
): Promise<ZoneWateringOverview[]> {
  const overview = new Map<string, ZoneWateringOverview>();

  const lastRuns = await pool.query<WateringDbRow>(selectLastRunsSql, [deviceId]);
  for (const row of lastRuns.rows) {
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

  const todayRuns = await pool.query<TodayWateringRow>(selectTodayRunsSql, [
    deviceId,
    since,
  ]);
  for (const row of todayRuns.rows) {
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

  // Lần tưới đang chạy: hiện số liệu tạm tính để UI không bị 0 L trong lúc bơm.
  const now = Date.now();
  const openRuns = await pool.query<{
    zone_id: string;
    started_at: number;
    last_seen_at: number;
    flow_lph: number;
  }>(selectOpenRunsSql, [deviceId]);

  for (const row of openRuns.rows) {
    if (now - row.last_seen_at > OPEN_RUN_STALE_MS) continue;

    const seconds = Math.max(0, (row.last_seen_at - row.started_at) / 1000);
    const liters = roundLiters((seconds / 3600) * row.flow_lph);
    const current = overview.get(row.zone_id) ?? {
      zoneId: row.zone_id,
      lastRun: null,
      todayLiters: 0,
      todayRuns: 0,
    };
    current.lastRun = {
      startedAt: row.started_at,
      endedAt: row.last_seen_at,
      seconds: Math.round(seconds),
      liters,
    };
    if (row.started_at >= since) {
      current.todayRuns += 1;
      current.todayLiters = roundLiters(current.todayLiters + liters);
    }
    overview.set(row.zone_id, current);
  }

  return [...overview.values()];
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

export async function logCommand(
  commandId: string,
  deviceId: string,
  command: string,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO command_log (command_id, device_id, command, status, created_at)
    VALUES ($1, $2, $3, 'pending', $4)
  `,
    [commandId, deviceId, command, Date.now()],
  );
}

export async function resolveCommand(
  commandId: string,
  status: CommandStatus,
): Promise<void> {
  await pool.query(
    `
    UPDATE command_log
    SET status = $1, resolved_at = $2
    WHERE command_id = $3 AND status = 'pending'
  `,
    [status, Date.now(), commandId],
  );
}

export async function listCommands(
  deviceId: string,
  limit = 50,
): Promise<CommandLogRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const { rows } = await pool.query<CommandDbRow>(
    `
    SELECT command_id, device_id, command, status, created_at, resolved_at
    FROM command_log
    WHERE device_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `,
    [deviceId, safeLimit],
  );

  return rows.map((row) => ({
    commandId: row.command_id,
    deviceId: row.device_id,
    command: row.command,
    status: row.status as CommandStatus,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }));
}

export async function timeoutStaleCommands(): Promise<number> {
  const result = await pool.query(
    `
    UPDATE command_log
    SET status = 'timeout', resolved_at = $1
    WHERE status = 'pending'
  `,
    [Date.now()],
  );
  return result.rowCount ?? 0;
}

export type DeletedHistory = {
  samples: number;
  commands: number;
  changes: number;
  runs: number;
};

/** Xóa dữ liệu cũ của một thiết bị; mẫu vùng tự xóa theo khóa ngoại. */
export async function deleteHistoryBefore(
  deviceId: string,
  cutoff: number,
): Promise<DeletedHistory> {
  return transaction(async (client) => {
    const samples = await client.query(
      "DELETE FROM telemetry_samples WHERE device_id = $1 AND recorded_at < $2",
      [deviceId, cutoff],
    );
    const commands = await client.query(
      "DELETE FROM command_log WHERE device_id = $1 AND created_at < $2",
      [deviceId, cutoff],
    );
    const changes = await client.query(
      "DELETE FROM zone_setting_changes WHERE device_id = $1 AND changed_at < $2",
      [deviceId, cutoff],
    );
    const runs = await client.query(
      "DELETE FROM watering_runs WHERE device_id = $1 AND last_seen_at < $2",
      [deviceId, cutoff],
    );

    return {
      samples: samples.rowCount ?? 0,
      commands: commands.rowCount ?? 0,
      changes: changes.rowCount ?? 0,
      runs: runs.rowCount ?? 0,
    };
  });
}

export async function pruneHistory(retentionDays: number): Promise<number> {
  const safeDays = Math.max(1, Math.floor(retentionDays));
  const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;

  return transaction(async (client) => {
    const removedSamples = await client.query(
      "DELETE FROM telemetry_samples WHERE recorded_at < $1",
      [cutoff],
    );

    await client.query("DELETE FROM command_log WHERE created_at < $1", [
      cutoff,
    ]);
    await client.query(
      "DELETE FROM zone_setting_changes WHERE changed_at < $1",
      [cutoff],
    );
    // last_seen_at cũng đóng vai trò "lần cuối còn hoạt động" cho run đang mở bị bỏ dở.
    await client.query(
      "DELETE FROM watering_runs WHERE last_seen_at < $1",
      [cutoff],
    );

    return removedSamples.rowCount ?? 0;
  });
}
