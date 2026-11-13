"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HistorySample } from "../components/HistoryChart";
import type { Zone } from "../garden-data";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const BUCKET_MS = 60 * 1000;
const REFRESH_MS = 2 * 60 * 1000;
const MIN_DRY_PAIRS = 3;
const MIN_WET_PAIRS = 2;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Tốc độ khô khi bơm tắt và tốc độ tăng ẩm khi bơm chạy, đơn vị %/ms.
function computeRates(samples: HistorySample[]) {
  const dry: number[] = [];
  const wet: number[] = [];

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const elapsed = current.recordedAt - previous.recordedAt;
    if (elapsed < 30_000 || elapsed > 30 * 60_000) continue;

    const delta = current.moisture - previous.moisture;
    if (!previous.pump && !current.pump && delta <= -0.2) {
      dry.push(-delta / elapsed);
    }
    if ((previous.pump || current.pump) && delta >= 0.2) {
      wet.push(delta / elapsed);
    }
  }

  return {
    dryPerMs: dry.length >= MIN_DRY_PAIRS ? median(dry) : null,
    wetPerMs: wet.length >= MIN_WET_PAIRS ? median(wet) : null,
  };
}

export type MoistureForecast = {
  dryingEtaMs: number | null;
  wateringMs: number | null;
  computedAt: number;
  loading: boolean;
  hasHistory: boolean;
};

export function useMoistureForecast({
  backendUrl,
  deviceId,
  zone,
}: {
  backendUrl: string;
  deviceId: string | null;
  zone: Zone;
}): MoistureForecast {
  const [samples, setSamples] = useState<HistorySample[]>([]);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!deviceId) {
      setSamples([]);
      setLoading(false);
      return;
    }

    let disposed = false;
    const requestId = ++requestRef.current;

    const load = async () => {
      try {
        const to = Date.now();
        const params = new URLSearchParams({
          from: String(to - WINDOW_MS),
          to: String(to),
          bucketMs: String(BUCKET_MS),
          zoneId: zone.id,
          limit: "2000",
        });
        const response = await fetch(
          `${backendUrl.replace(/\/+$/, "")}/api/devices/${encodeURIComponent(deviceId)}/telemetry/history?${params.toString()}`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as { samples?: HistorySample[] };
        if (disposed || requestId !== requestRef.current) return;
        setSamples(Array.isArray(body.samples) ? body.samples : []);
      } catch {
        if (!disposed && requestId === requestRef.current) setSamples([]);
      } finally {
        if (!disposed && requestId === requestRef.current) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [backendUrl, deviceId, zone.id]);

  const { dryPerMs, wetPerMs } = useMemo(() => computeRates(samples), [samples]);

  const forecast = useMemo(() => {
    const computedAt = Date.now();
    if (!zone.online || zone.moisture === null) {
      return { dryingEtaMs: null, wateringMs: null, computedAt };
    }

    const dryingEtaMs =
      !zone.pump && zone.moisture > zone.threshold && dryPerMs !== null
        ? Math.round((zone.moisture - zone.threshold) / dryPerMs)
        : null;
    const wateringMs =
      zone.moisture < zone.stopThreshold && wetPerMs !== null
        ? Math.round((zone.stopThreshold - zone.moisture) / wetPerMs)
        : null;

    return { dryingEtaMs, wateringMs, computedAt };
  }, [
    zone.online,
    zone.moisture,
    zone.threshold,
    zone.stopThreshold,
    zone.pump,
    dryPerMs,
    wetPerMs,
  ]);

  return { ...forecast, loading, hasHistory: samples.length > 0 };
}
