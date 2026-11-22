import type { PoolClient } from "pg";
import { pool, transaction } from "./db.js";

// Telemetry thật 2–10 giây/lần; mất tín hiệu quá 60 giây coi như lần tưới đã kết thúc.
export const LIVE_GAP_MS = 60_000;
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

export async function trackWateringSample(
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
