import { useCallback, useEffect, useRef, useState } from "react";

import { getWatering } from "../api/watering";
import type { ZoneWateringSummary } from "../api/types";

const REFRESH_MS = 30_000;

export function useWatering(deviceId: string) {
  const [byZone, setByZone] = useState<Record<string, ZoneWateringSummary>>({});
  const [refreshToken, setRefreshToken] = useState(0);
  // Kéo để làm mới chờ đúng lượt tải do chính nó kích hoạt.
  const waiters = useRef<(() => void)[]>([]);

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiters.current.push(resolve);
        setRefreshToken((token) => token + 1);
      }),
    [],
  );

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      try {
        const next = await getWatering(deviceId);
        if (!disposed) setByZone(next);
      } catch {
        // Giữ số liệu cũ khi backend tạm lỗi; vòng lặp sau sẽ thử lại.
      } finally {
        if (!disposed) {
          waiters.current.splice(0).forEach((resolve) => resolve());
        }
      }
    };

    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [deviceId, refreshToken]);

  return { byZone, reload };
}
