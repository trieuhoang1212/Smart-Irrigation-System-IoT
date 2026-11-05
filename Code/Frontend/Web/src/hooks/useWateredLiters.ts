"use client";

import { useEffect, useRef, useState } from "react";
import type { Zone } from "../garden-data";

type Cycle = {
  pumping: boolean;
  startedAt: number;
  accumulated: number;
};

const TICK_MS = 1000;

/**
 * Ước tính lượng nước đã tưới trong chu kỳ hiện tại dựa trên thời gian bơm
 * thực tế và lưu lượng cấu hình của từng zone (lít/giờ).
 */
export function useWateredLiters(zones: Zone[]): Record<string, number> {
  const [liters, setLiters] = useState<Record<string, number>>({});
  const zonesRef = useRef(zones);
  const cyclesRef = useRef<Record<string, Cycle>>({});

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const next: Record<string, number> = {};

      for (const zone of zonesRef.current) {
        const litersPerMs = zone.flowLitersPerHour / 3_600_000;
        let cycle = cyclesRef.current[zone.id];

        if (!cycle) {
          cycle = { pumping: false, startedAt: now, accumulated: 0 };
          cyclesRef.current[zone.id] = cycle;
        }

        if (zone.pump) {
          if (!cycle.pumping) {
            cycle.pumping = true;
            cycle.startedAt = now;
            cycle.accumulated = 0;
          }
          next[zone.id] = cycle.accumulated + (now - cycle.startedAt) * litersPerMs;
        } else {
          if (cycle.pumping) {
            cycle.pumping = false;
            cycle.accumulated += (now - cycle.startedAt) * litersPerMs;
          }
          next[zone.id] = cycle.accumulated;
        }
      }

      setLiters(next);
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, []);

  return liters;
}
