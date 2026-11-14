"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ActivityEvent = {
  id: string;
  at: number;
  text: string;
  status?: "pending" | "confirmed" | "timeout";
  zoneId?: string | null;
};

type CommandRow = {
  commandId: string;
  command: string;
  status: "pending" | "confirmed" | "timeout";
  createdAt: number;
};

type SettingChangeRow = {
  zoneId: string;
  threshold: number;
  updatedAt: number;
  oldThreshold: number | null;
};

const LIMIT = 20;
const REFRESH_MS = 15000;
const VISIBLE_EVENTS = 8;

function describeCommand(command: string): { text: string; zoneId: string | null } | null {
  // SET_THRESHOLD cũng sinh bản ghi trong config/changes, tránh trùng 2 dòng.
  if (command.startsWith("SET_THRESHOLD_")) return null;

  const zonePump = command.match(/^PUMP_(ON|OFF)_(T00[1-6])$/);
  if (zonePump) {
    return {
      text: `${zonePump[1] === "ON" ? "Bật" : "Tắt"} bơm ${zonePump[2]}`,
      zoneId: zonePump[2],
    };
  }

  const labels: Record<string, string> = {
    PUMP_ON: "Bật bơm toàn vườn",
    PUMP_OFF: "Tắt bơm toàn vườn",
    MODE_AUTO: "Chuyển chế độ Tự động",
    MODE_MANUAL: "Chuyển chế độ Thủ công",
    WEATHER_GATE_ON: "Bật hoãn tưới khi mưa",
    WEATHER_GATE_OFF: "Tắt hoãn tưới khi mưa",
  };
  return { text: labels[command] ?? command, zoneId: null };
}

export function useActivity({
  backendUrl,
  deviceId,
  refreshToken = 0,
  limit = LIMIT,
  visible = VISIBLE_EVENTS,
}: {
  backendUrl: string;
  deviceId: string | null;
  refreshToken?: number;
  limit?: number;
  visible?: number;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!deviceId) return;

    const requestId = ++requestRef.current;
    try {
      const base = `${backendUrl.replace(/\/+$/, "")}/api/devices/${encodeURIComponent(deviceId)}`;
      const [commandsResponse, changesResponse] = await Promise.all([
        fetch(`${base}/commands?limit=${limit}`),
        fetch(`${base}/config/changes?limit=${limit}`),
      ]);
      if (!commandsResponse.ok || !changesResponse.ok) {
        throw new Error("HTTP error");
      }

      const commandsBody = (await commandsResponse.json()) as { commands?: CommandRow[] };
      const changesBody = (await changesResponse.json()) as { changes?: SettingChangeRow[] };
      if (requestId !== requestRef.current) return;

      const commandEvents = (commandsBody.commands ?? []).flatMap((row) => {
        const described = describeCommand(row.command);
        return described
          ? [{
              id: `command-${row.commandId}`,
              at: row.createdAt,
              text: described.text,
              status: row.status,
              zoneId: described.zoneId,
            }]
          : [];
      });

      const changeEvents = (changesBody.changes ?? []).map((row) => ({
        id: `change-${row.zoneId}-${row.updatedAt}`,
        at: row.updatedAt,
        text:
          row.oldThreshold === null
            ? `Đặt ngưỡng ${row.zoneId} → ${row.threshold}%`
            : `Đổi ngưỡng ${row.zoneId}: ${row.oldThreshold}% → ${row.threshold}%`,
        zoneId: row.zoneId,
      }));

      setEvents(
        [...commandEvents, ...changeEvents]
          .sort((a, b) => b.at - a.at)
          .slice(0, visible),
      );
      setError(null);
    } catch {
      if (requestId === requestRef.current) {
        setError("Không tải được nhật ký từ Backend.");
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [backendUrl, deviceId, limit, visible]);

  useEffect(() => {
    // Trì hoãn một nhịp để tránh setState đồng bộ ngay trong thân effect.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshToken]);

  useEffect(() => {
    if (!deviceId) return;
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load, deviceId]);

  return { events, loading, error, refresh: load };
}
