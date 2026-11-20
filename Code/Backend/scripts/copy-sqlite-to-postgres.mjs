// Script tạm: copy dữ liệu SQLite cũ sang PostgreSQL. Không xóa dữ liệu nguồn.
import "dotenv/config";
import Database from "better-sqlite3";
import { Pool } from "pg";

const sourcePath =
  process.env.DB_PATH ?? "C:/Users/Admin/iot-data/smart-irrigation.db";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

const TABLES = [
  "latest_telemetry",
  "telemetry_samples",
  "telemetry_zone_samples",
  "command_log",
  "zone_settings",
  "zone_profiles",
  "garden_settings",
  "zone_setting_changes",
  "watering_runs",
  "push_tokens",
];

const CHUNK_PARAMS = 50_000;

function chunkRows(rows, columns, size) {
  const rowsPerChunk = Math.max(1, Math.floor(size / columns.length));
  const chunks = [];
  for (let i = 0; i < rows.length; i += rowsPerChunk) {
    chunks.push(rows.slice(i, i + rowsPerChunk));
  }
  return chunks;
}

const sqlite = new Database(sourcePath, { readonly: true });
const sourceTables = new Set(
  sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all()
    .map((row) => row.name),
);

const { rows: targetColumnRows } = await pool.query(
  "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'",
);
const targetColumns = new Map();
for (const row of targetColumnRows) {
  const list = targetColumns.get(row.table_name) ?? [];
  list.push(row.column_name);
  targetColumns.set(row.table_name, list);
}

const plan = [];
for (const table of TABLES) {
  if (!sourceTables.has(table)) {
    console.log(`- ${table}: không có trong SQLite, bỏ qua`);
    continue;
  }
  if (!targetColumns.has(table)) {
    throw new Error(`Bảng ${table} chưa có trong PostgreSQL`);
  }
  const sourceCols = sqlite
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => row.name);
  const targetCols = new Set(targetColumns.get(table));
  const columns = sourceCols.filter((name) => targetCols.has(name));
  if (columns.length === 0) {
    console.log(`- ${table}: không có cột chung, bỏ qua`);
    continue;
  }
  const rows = sqlite.prepare(`SELECT ${columns.join(", ")} FROM ${table}`).all();
  plan.push({ table, columns, rows });
}

// Bảng có khóa tự nhiên (device_id, zone_id...) được merge bằng ON CONFLICT.
// Bảng khóa tự tăng (id) phải trống để giữ nguyên id tham chiếu.
const primaryKeys = new Map();
for (const { table } of plan) {
  const { rows } = await pool.query(
    `SELECT a.attname AS column
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = $1::regclass AND i.indisprimary`,
    [table],
  );
  primaryKeys.set(
    table,
    rows.map((row) => row.column),
  );
}

function isMergeable(table) {
  const pk = primaryKeys.get(table) ?? [];
  return pk.length > 0 && !pk.includes("id");
}

const blockers = [];
for (const { table } of plan) {
  if (isMergeable(table)) continue;
  const { rows } = await pool.query(
    `SELECT COUNT(*)::bigint AS total FROM ${table}`,
  );
  if (Number(rows[0].total) > 0) blockers.push(table);
}
if (blockers.length > 0) {
  throw new Error(
    `Bảng Postgres đã có dòng và không thể merge an toàn (${blockers.join(", ")}); dừng để tránh trùng dữ liệu.`,
  );
}

for (const { table, columns, rows } of plan) {
  if (rows.length === 0) {
    console.log(`- ${table}: 0 dòng`);
    continue;
  }

  const pk = primaryKeys.get(table) ?? [];
  const mergeable = isMergeable(table);
  const updateColumns = columns.filter((column) => !pk.includes(column));
  const conflictClause =
    mergeable && updateColumns.length > 0
      ? ` ON CONFLICT (${pk.join(", ")}) DO UPDATE SET ${updateColumns
          .map((column) => `${column} = EXCLUDED.${column}`)
          .join(", ")}`
      : "";

  for (const chunk of chunkRows(rows, columns, CHUNK_PARAMS)) {
    const placeholders = chunk
      .map(
        (_row, rowIndex) =>
          `(${columns
            .map((_column, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`)
            .join(", ")})`,
      )
      .join(", ");
    const values = chunk.flatMap((row) =>
      columns.map((column) => row[column] ?? null),
    );
    await pool.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${placeholders}${conflictClause}`,
      values,
    );
  }

  console.log(
    `- ${table}: ${mergeable ? "merge" : "copy"} ${rows.length} dòng`,
  );
}

for (const { table } of plan) {
  if (!targetColumns.get(table).includes("id")) continue;
  const { rows } = await pool.query(`SELECT MAX(id) AS max FROM ${table}`);
  const max = rows[0].max === null ? null : Number(rows[0].max);
  await pool.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2, $3)", [
    table,
    max ?? 1,
    max !== null,
  ]);
  console.log(`- ${table}: sequence -> ${max ?? "(rỗng)"}`);
}

console.log("\nKiểm tra số dòng:");
for (const { table, rows } of plan) {
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::bigint AS total FROM ${table}`,
  );
  console.log(
    `- ${table}: SQLite ${rows.length} / PostgreSQL ${countRows[0].total}`,
  );
}

sqlite.close();
await pool.end();
