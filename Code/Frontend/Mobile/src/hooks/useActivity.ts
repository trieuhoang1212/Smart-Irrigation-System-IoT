import { useCallback, useEffect, useState } from "react";

import {
  getDeviceActivity,
  type CommandRow,
  type CommandStatus,
} from "../api/activity";

export type ActivityKind = "pump" | "mode" | "threshold" | "weather" | "other";

export type ActivityEvent = {
  id: string;
  at: number;
  text: string;
  kind: ActivityKind;
  zoneId: string | null;
  status?: CommandStatus;
};

const REFRESH_MS = 15_000;

function describeCommand(
  command: string,
): { text: string; kind: ActivityKind; zoneId: string | null } | null {
  // SET_THRESHOLD cũng sinh bản ghi trong config/changes, tránh trùng 2 dòng.
  if (command.startsWith("SET_THRESHOLD_")) return null;

  const zonePump = command.match(/^PUMP_(ON|OFF)_(T\d{3})$/);
  if (zonePump) {
    return {
      text: `${zonePump[1] === "ON" ? "Bật" : "Tắt"} bơm khu ${zonePump[2]}`,
      kind: "pump",
      zoneId: zonePump[2],
    };
  }

  const labels: Record<string, { text: string; kind: ActivityKind }> = {
    PUMP_ON: { text: "Bật bơm toàn vườn", kind: "pump" },
    PUMP_OFF: { text: "Tắt bơm toàn vườn", kind: "pump" },
    MODE_AUTO: { text: "Chuyển sang chế độ Tự động", kind: "mode" },
    MODE_MANUAL: { text: "Chuyển sang chế độ Thủ công", kind: "mode" },
    WEATHER_GATE_ON: { text: "Bật chặn tưới khi mưa", kind: "weather" },
    WEATHER_GATE_OFF: { text: "Tắt chặn tưới khi mưa", kind: "weather" },
  };

  const known = labels[command];
  return {
    text: known?.text ?? command,
    kind: known?.kind ?? "other",
    zoneId: null,
  };
}

function toCommandEvent(row: CommandRow): ActivityEvent | null {
  const described = describeCommand(row.command);
  if (!described) return null;

  return {
    id: `command-${row.commandId}`,
    at: row.createdAt,
    text: described.text,
    kind: described.kind,
    zoneId: described.zoneId,
    status: row.status,
  };
}

export function useActivity(deviceId: string, limit = 60) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const reload = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      setLoading(true);
      try {
        const { commands, changes } = await getDeviceActivity(deviceId, limit);
        if (disposed) return;

        const commandEvents = commands
          .map(toCommandEvent)
          .filter((event): event is ActivityEvent => event !== null);

        const changeEvents: ActivityEvent[] = changes.map((row) => ({
          id: `change-${row.zoneId}-${row.updatedAt}`,
          at: row.updatedAt,
          kind: "threshold",
          zoneId: row.zoneId,
          text:
            row.oldThreshold === null
              ? `Đặt ngưỡng tưới khu ${row.zoneId} thành ${row.threshold}%`
              : `Đổi ngưỡng khu ${row.zoneId}: ${row.oldThreshold}% → ${row.threshold}%`,
        }));

        setEvents(
          [...commandEvents, ...changeEvents]
            .sort((a, b) => b.at - a.at)
            .slice(0, limit),
        );
        setError(null);
      } catch {
        if (!disposed) setError("Không tải được nhật ký từ Backend.");
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [deviceId, limit, refreshToken]);

  return { events, loading, error, reload };
}
