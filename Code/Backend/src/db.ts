import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./config.js";

const dbFile = config.dbPath === ":memory:" ? config.dbPath : resolve(process.cwd(), config.dbPath);

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
    device_id    TEXT PRIMARY KEY,
    payload      TEXT NOT NULL,
    received_at  TEXT NOT NULL,
    updated_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS telemetry_samples (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id     TEXT NOT NULL,
    mode          TEXT NOT NULL,
    temperature   REAL,
    humidity      REAL,
    rain          REAL NOT NULL,
    raining       INTEGER NOT NULL,
    weather_gate  INTEGER NOT NULL,
    pump          INTEGER NOT NULL,
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
    duration        INTEGER,
    pump_seconds    INTEGER,
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
    soil          TEXT NOT NULL DEFAULT 'Đất thịt',
    planted_at    INTEGER,
    harvest_days  INTEGER,
    notes         TEXT NOT NULL DEFAULT '',
    photo_file    TEXT,
    updated_at    INTEGER NOT NULL,
    PRIMARY KEY (device_id, zone_id)
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
`);

// DB cũ tạo temperature/humidity NOT NULL, không lưu được lúc DHT22 lỗi.
function migrateSensorNullability() {
  const columns = db.prepare("PRAGMA table_info(telemetry_samples)").all() as Array<{
    name: string;
    notnull: number;
  }>;
  if (!columns.some((column) => ["temperature", "humidity"].includes(column.name) && column.notnull)) {
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
          weather_gate  INTEGER NOT NULL,
          pump          INTEGER NOT NULL,
          recorded_at   INTEGER NOT NULL
        );
        INSERT INTO telemetry_samples_new
          (id, device_id, mode, temperature, humidity, rain, raining, weather_gate, pump, recorded_at)
        SELECT id, device_id, mode, temperature, humidity, rain, raining, weather_gate, pump, recorded_at
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

// DB cũ chưa có thông số tưới của từng vùng (thời lượng, chu kỳ, lưu lượng, mục tiêu nước).
function migrateZoneProfiles() {
  const columns = db.prepare("PRAGMA table_info(zone_settings)").all() as Array<{
    name: string;
  }>;
  const existing = new Set(columns.map((column) => column.name));
  const additions: Array<[string, string]> = [
    ["duration", "INTEGER"],
    ["pump_seconds", "INTEGER"],
    ["flow_lph", "REAL"],
    ["target_liters", "REAL"],
  ];

  for (const [name, type] of additions) {
    if (!existing.has(name)) db.exec(`ALTER TABLE zone_settings ADD COLUMN ${name} ${type}`);
  }
}

migrateZoneProfiles();

// DB cũ chưa có loại đất trong hồ sơ cây; mặc định đất thịt.
function migrateZoneProfileSoil() {
  const columns = db.prepare("PRAGMA table_info(zone_profiles)").all() as Array<{
    name: string;
  }>;
  if (columns.some((column) => column.name === "soil")) return;
  db.exec("ALTER TABLE zone_profiles ADD COLUMN soil TEXT NOT NULL DEFAULT 'Đất thịt'");
}

migrateZoneProfileSoil();

export function closeDatabase() {
  if (db.open) db.close();
}

export const databaseFile = dbFile;
