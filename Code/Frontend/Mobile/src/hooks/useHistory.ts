import { useCallback, useEffect, useState } from "react";

import { getTelemetryHistory } from "../api/telemetry";
import type { HistorySample } from "../api/types";

export type RangeKey = "1h" | "24h" | "7d";

export const HISTORY_RANGES: Record<
  RangeKey,
  { label: string; durationMs: number; bucketMs: number }
> = {
  "1h": { label: "1 giờ", durationMs: 60 * 60 * 1000, bucketMs: 30 * 1000 },
  "24h": { label: "24 giờ", durationMs: 24 * 60 * 60 * 1000, bucketMs: 5 * 60 * 1000 },
  "7d": { label: "7 ngày", durationMs: 7 * 24 * 60 * 60 * 1000, bucketMs: 30 * 60 * 1000 },
};

const REFRESH_MS = 30_000;

export function useHistory({
  deviceId,
  zoneId,
  range,
}: {
  deviceId: string;
  zoneId: string;
  range: RangeKey;
}) {
  const [samples, setSamples] = useState<HistorySample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const reload = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      const to = Date.now();
      const from = to - HISTORY_RANGES[range].durationMs;
      setLoading(true);
      setError(null);

      try {
        const response = await getTelemetryHistory({
          deviceId,
          zoneId,
          from,
          to,
          bucketMs: HISTORY_RANGES[range].bucketMs,
        });
        if (!disposed) setSamples(response.samples ?? []);
      } catch {
        if (!disposed) setError("Không tải được dữ liệu lịch sử.");
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
  }, [deviceId, zoneId, range, refreshToken]);

  return { samples, loading, error, reload };
}
