"use client";

import { useEffect, useState } from "react";
import type { SoilType, Zone, ZoneAdvice } from "../garden-data";
import { fetchZoneAdvice } from "../lib/garden-api";

export function ZoneAdvicePanel({
  deviceId,
  zone,
  soil,
  onApply,
}: {
  deviceId: string;
  zone: Zone;
  soil: SoilType;
  onApply: (input: { threshold: number }) => Promise<boolean>;
}) {
  const [data, setData] = useState<ZoneAdvice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      fetchZoneAdvice(deviceId, zone.id)
        .then((next) => {
          if (cancelled) return;
          setData(next);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          setError(cause instanceof Error ? cause.message : "Không tải được khuyến nghị.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    run();
    const timer = window.setInterval(run, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [deviceId, zone.id, reloadKey]);

  const handleApply = async () => {
    if (!data) return;
    setApplying(true);
    const applied = await onApply({
      threshold: data.advice.suggestedThreshold,
    });
    setApplying(false);
    if (applied) setReloadKey((current) => current + 1);
  };

  if (loading && !data) {
    return (
      <section className="advice-panel">
        <div className="panel-heading">
          <div>
            <h2>Khuyến nghị cho {zone.id}</h2>
            <p>Đang tính từ hồ sơ cây, loại đất và cảm biến thời tiết...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="advice-panel">
        <div className="panel-heading">
          <div>
            <h2>Khuyến nghị cho {zone.id}</h2>
            <p>{error}</p>
          </div>
          <button
            className="ghost-button"
            onClick={() => {
              setError(null);
              setReloadKey((current) => current + 1);
            }}
          >
            Thử lại
          </button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  const { advice, growth } = data;
  const hasChange = advice.suggestedThreshold !== advice.currentThreshold;
  const raining = advice.weather.raining;

  return (
    <section className="advice-panel" aria-live="polite">
      <div className="panel-heading">
        <div>
          <h2>Khuyến nghị cho {zone.id}</h2>
          <p>
            {zone.name} · {soil}
            {growth ? ` · ${growth.label} ngày ${growth.day}/${growth.totalDays}` : ""}
          </p>
        </div>
        <span className={`advice-tag ${advice.weather.raining ? "rain" : ""}`}>
          {advice.weather.raining ? "Đang mưa" : advice.weather.season}
        </span>
      </div>

      <p className="advice-summary">{advice.summary}</p>

      <div className="advice-metrics">
        <div>
          <span>Ngưỡng tưới</span>
          <strong>
            {advice.currentThreshold}% <em>→</em> {advice.suggestedThreshold}%
          </strong>
        </div>
        <div>
          <span>Khung giờ gợi ý</span>
          <strong>
            {advice.window
              ? `${advice.window.start}–${advice.window.end}`
              : "Tạm hoãn khi còn mưa"}
          </strong>
        </div>
      </div>

      <div className="advice-weather">
        Mưa {advice.weather.rain}% · {advice.weather.temperature ?? "--"}°C · độ ẩm{" "}
        {advice.weather.humidity ?? "--"}% · {advice.weather.season}
      </div>

      <ul className="advice-reasons">
        {advice.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      <div className="advice-footer">
        <p className="manager-hint">
          {advice.windowNote} Hệ thống không tự đổi cấu hình.
        </p>
        <button
          className="primary-button"
          onClick={() => void handleApply()}
          disabled={applying || !hasChange || raining}
        >
          {applying
            ? "Đang áp dụng..."
            : raining
              ? "Tạm hoãn khi còn mưa"
              : hasChange
                ? "Áp dụng ngưỡng tưới"
                : "Đang dùng đúng gợi ý"}
        </button>
      </div>
    </section>
  );
}
