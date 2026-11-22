import { pool } from "./db.js";

export type CommandStatus = "pending" | "confirmed" | "timeout";

export type CommandLogRow = {
  commandId: string;
  deviceId: string;
  command: string;
  status: CommandStatus;
  createdAt: number;
  resolvedAt: number | null;
};

type CommandDbRow = {
  command_id: string;
  device_id: string;
  command: string;
  status: string;
  created_at: number;
  resolved_at: number | null;
};

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
