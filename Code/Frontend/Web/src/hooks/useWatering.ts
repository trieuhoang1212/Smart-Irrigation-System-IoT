"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWatering, type ZoneWateringSummary } from "../lib/garden-api";

const REFRESH_MS = 15000;

export function useWatering(deviceId: string | null, refreshToken = 0) {
  const [zones, setZones] = useState<Record<string, ZoneWateringSummary>>({});
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!deviceId) return;

    const requestId = ++requestRef.current;
    try {
      const next = await fetchWatering(deviceId);
      if (requestId === requestRef.current) setZones(next);
    } catch {
      // Giữ số liệu cũ khi backend tạm lỗi; vòng lặp sau sẽ thử lại.
    }
  }, [deviceId]);

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

  return zones;
}
