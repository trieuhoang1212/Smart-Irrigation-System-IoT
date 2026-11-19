import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./config.js";

const dbFile =
  config.dbPath === ":memory:"
    ? config.dbPath
    : resolve(process.cwd(), config.dbPath);

if (dbFile !== ":memory:") mkdirSync(dirname(dbFile), { recursive: true });

function openDatabase(): Database.Database {
  try {
    return new Database(dbFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot open SQLite database at ${dbFile}: ${message}`);
  }
}

export const db = openDatabase();

db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS latest_telemetry (
    device_id  TEXT PRIMARY KEY,
    payload    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS telemetry_samples (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id     TEXT NOT NULL,
    mode          TEXT NOT NULL,
    temperature   REAL,
    humidity      REAL,
    rain          REAL NOT NULL,
    raining       INTEGER NOT NULL,
    recorded_at   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_telemetry_samples_device_time
    ON telemetry_samples(device_id, recorded_at);
  CREATE INDEX IF NOT EXISTS idx_telemetry_samples_time
    ON telemetry_samples(recorded_at);

  CREATE TABLE IF NOT EXISTS telemetry_zone_samples (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sample_id       INTEGER NOT NULL,
    device_id       TEXT NOT NULL,
    zone_id         TEXT NOT NULL,
    moisture        REAL NOT NULL,
    threshold       REAL NOT NULL,
    stop_threshold  REAL NOT NULL,
    pump            INTEGER NOT NULL,
    recorded_at     INTEGER NOT NULL,
    FOREIGN KEY (sample_id) REFERENCES telemetry_samples(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_zone_samples_device_zone_time
    ON telemetry_zone_samples(device_id, zone_id, recorded_at);
  -- Dùng cho JOIN theo sample_id và FK cascade khi prune xóa telemetry_samples.
  CREATE INDEX IF NOT EXISTS idx_zone_samples_sample
    ON telemetry_zone_samples(sample_id);

  CREATE TABLE IF NOT EXISTS command_log (
    command_id  TEXT PRIMARY KEY,
    device_id   TEXT NOT NULL,
    command     TEXT NOT NULL,
    status      TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    resolved_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_command_log_device_time
    ON command_log(device_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_command_log_status_time
    ON command_log(status, created_at);

  CREATE TABLE IF NOT EXISTS zone_settings (
    device_id       TEXT NOT NULL,
    zone_id         TEXT NOT NULL,
    threshold       REAL NOT NULL,
    stop_threshold  REAL NOT NULL,
    flow_lph        REAL,
    target_liters   REAL,
    updated_at      INTEGER NOT NULL,
    PRIMARY KEY (device_id, zone_id)
  );

  CREATE TABLE IF NOT EXISTS zone_profiles (
    device_id     TEXT NOT NULL,
    zone_id       TEXT NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT NOT NULL,
    crop_group    TEXT NOT NULL,
    planted_at    INTEGER,
    harvest_days  INTEGER,
    notes         TEXT NOT NULL DEFAULT '',
    photo_file    TEXT,
    updated_at    INTEGER NOT NULL,
    PRIMARY KEY (device_id, zone_id)
  );

  CREATE TABLE IF NOT EXISTS garden_settings (
    device_id      TEXT PRIMARY KEY,
    soil           TEXT NOT NULL DEFAULT 'Đất phù sa',
    rain_threshold INTEGER NOT NULL DEFAULT 100,
    updated_at     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS zone_setting_changes (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id          TEXT NOT NULL,
    zone_id            TEXT NOT NULL,
    old_threshold      REAL,
    new_threshold      REAL NOT NULL,
    old_stop_threshold REAL,
    new_stop_threshold REAL NOT NULL,
    changed_at         INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_zone_setting_changes_device_time
    ON zone_setting_changes(device_id, changed_at);

  CREATE TABLE IF NOT EXISTS watering_runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id    TEXT NOT NULL,
    zone_id      TEXT NOT NULL,
    started_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    ended_at     INTEGER,
    seconds      REAL,
    liters       REAL,
    flow_lph     REAL NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_watering_runs_device_zone
    ON watering_runs(device_id, zone_id, started_at);
  CREATE INDEX IF NOT EXISTS idx_watering_runs_device_end
    ON watering_runs(device_id, ended_at);

  CREATE TABLE IF NOT EXISTS push_tokens (
    token      TEXT PRIMARY KEY,
    device_id  TEXT NOT NULL,
    platform   TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_push_tokens_device
    ON push_tokens(device_id);
`);

function tableColumns(table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return new Set(rows.map((row) => row.name));
}

function addColumnIfMissing(table: string, name: string, type: string) {
  if (!tableColumns(table).has(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
}

function dropColumnIfExists(table: string, name: string) {
  if (tableColumns(table).has(name)) {
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${name}`);
  }
}

// DB cũ tạo temperature/humidity NOT NULL, không lưu được lúc DHT22 lỗi.
function migrateSensorNullability() {
  const columns = db
    .prepare("PRAGMA table_info(telemetry_samples)")
    .all() as Array<{
    name: string;
    notnull: number;
  }>;
  if (
    !columns.some(
      (column) =>
        ["temperature", "humidity"].includes(column.name) && column.notnull,
    )
  ) {
    return;
  }

  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE telemetry_samples_new (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id     TEXT NOT NULL,
          mode          TEXT NOT NULL,
          temperature   REAL,
          humidity      REAL,
          rain          REAL NOT NULL,
          raining       INTEGER NOT NULL,
          recorded_at   INTEGER NOT NULL
        );
        INSERT INTO telemetry_samples_new
          (id, device_id, mode, temperature, humidity, rain, raining, recorded_at)
        SELECT id, device_id, mode, temperature, humidity, rain, raining, recorded_at
        FROM telemetry_samples;
        DROP TABLE telemetry_samples;
        ALTER TABLE telemetry_samples_new RENAME TO telemetry_samples;
        CREATE INDEX idx_telemetry_samples_device_time ON telemetry_samples(device_id, recorded_at);
        CREATE INDEX idx_telemetry_samples_time ON telemetry_samples(recorded_at);
      `);
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

migrateSensorNullability();

// DB cũ chưa có thông số nước của từng vùng.
function migrateZoneSettings() {
  addColumnIfMissing("zone_settings", "flow_lph", "REAL");
  addColumnIfMissing("zone_settings", "target_liters", "REAL");
}

migrateZoneSettings();
addColumnIfMissing("watering_runs", "flow_lph", "REAL NOT NULL DEFAULT 0");

// Loại đất chuyển từ hồ sơ từng ô sang cấu hình chung của khu vườn.
function migrateGardenSoil() {
  if (tableColumns("zone_profiles").has("soil")) {
    db.exec("ALTER TABLE zone_profiles DROP COLUMN soil");
  }
}

migrateGardenSoil();

// DB cũ chưa có ngưỡng mưa chỉnh từ Web.
function migrateGardenRainThreshold() {
  if (!tableColumns("garden_settings").has("rain_threshold")) {
    db.exec(
      "ALTER TABLE garden_settings ADD COLUMN rain_threshold INTEGER NOT NULL DEFAULT 100",
    );
  }
}

migrateGardenRainThreshold();

// Các cột không còn dùng sau khi bỏ thời gian bơm cố định và telemetry toàn vườn.
function dropLegacyColumns() {
  dropColumnIfExists("zone_settings", "duration");
  dropColumnIfExists("zone_settings", "pump_seconds");
  dropColumnIfExists("latest_telemetry", "received_at");
  dropColumnIfExists("latest_telemetry", "updated_at");
  dropColumnIfExists("telemetry_samples", "weather_gate");
  dropColumnIfExists("telemetry_samples", "pump");
}

dropLegacyColumns();

export function closeDatabase() {
  if (db.open) db.close();
}

export const databaseFile = dbFile;
