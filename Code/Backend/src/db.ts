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

// WAL cho phép đọc/ghi song song và bền hơn khi backend ghi liên tục.
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

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
    temperature   REAL NOT NULL,
    humidity      REAL NOT NULL,
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
`);

export function closeDatabase() {
  if (db.open) db.close();
}

export const databaseFile = dbFile;
