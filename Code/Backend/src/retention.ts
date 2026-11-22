import { transaction } from "./db.js";

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
