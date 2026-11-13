"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisSample } from "../lib/analysis";

export type AnalysisRange = "1h" | "24h" | "7d";

export const ANALYSIS_RANGES: Record<
  AnalysisRange,
  { label: string; durationMs: number; bucketMs: number }
> = {
  "1h": { label: "1 giờ", durationMs: 60 * 60 * 1000, bucketMs: 30 * 1000 },
  "24h": { label: "24 giờ", durationMs: 24 * 60 * 60 * 1000, bucketMs: 5 * 60 * 1000 },
  "7d": { label: "7 ngày", durationMs: 7 * 24 * 60 * 60 * 1000, bucketMs: 30 * 60 * 1000 },
};

const REFRESH_MS = 30_000;

export function useZoneHistory({
  backendUrl,
  deviceId,
  zoneId,
  range,
  connected,
}: {
  backendUrl: string;
  deviceId: string | null;
  zoneId: string | null;
  range: AnalysisRange;
  connected: boolean;
}) {
  const [data, setData] = useState<{ key: string; samples: AnalysisSample[] }>({
    key: "",
    samples: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const queryKey = `${deviceId ?? ""}|${zoneId ?? ""}|${range}`;

  const load = useCallback(async () => {
    if (!deviceId || !zoneId) return;

    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);

    try {
      const to = Date.now();
      const from = to - ANALYSIS_RANGES[range].durationMs;
      const params = new URLSearchParams({
        from: String(from),
        to: String(to),
        bucketMs: String(ANALYSIS_RANGES[range].bucketMs),
        zoneId,
        limit: "500",
      });

      const response = await fetch(
        `${backendUrl.replace(/\/+$/, "")}/api/devices/${encodeURIComponent(deviceId)}/telemetry/history?${params.toString()}`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const body = (await response.json()) as { samples?: AnalysisSample[] };
      if (requestId !== requestRef.current) return;
      setData({
        key: `${deviceId}|${zoneId}|${range}`,
        samples: Array.isArray(body.samples) ? body.samples : [],
      });
    } catch {
      if (requestId !== requestRef.current) return;
      setData({ key: `${deviceId}|${zoneId}|${range}`, samples: [] });
      setError("Không tải được lịch sử từ Backend.");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [backendUrl, deviceId, zoneId, range]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [connected, load]);

  const stale = data.key !== queryKey;
  return { samples: stale ? [] : data.samples, loading: loading || stale, error };
}
