"use client";

import { useEffect, useState } from "react";
import { SOIL_TYPES, type GardenAdviceResponse, type SoilType } from "../garden-data";
import { applyGardenAdvice, fetchGardenAdvice, saveGardenSoil } from "../lib/garden-api";

export function GardenSoilPlan({
  deviceId,
  initialSoil,
}: {
  deviceId: string;
  initialSoil: SoilType;
}) {
  const [soil, setSoil] = useState<SoilType>(initialSoil);
  const [data, setData] = useState<GardenAdviceResponse | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchGardenAdvice(deviceId)
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Không tải được gợi ý tưới.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId, reloadKey]);

  const handleSoilChange = (next: SoilType) => {
    if (next === soil) return;
    const previous = soil;
    setSoil(next);
    setSaving(true);
    setError(null);
    setNotice(null);
    saveGardenSoil(deviceId, next)
      .then(() => {
        setNotice(`Đã lưu ${next} cho cả khu vườn.`);
        setLoading(true);
        setReloadKey((current) => current + 1);
      })
      .catch((cause: unknown) => {
        setSoil(previous);
        setError(cause instanceof Error ? cause.message : "Không lưu được loại đất.");
      })
      .finally(() => setSaving(false));
  };

  const handleApply = () => {
    setApplying(true);
    setError(null);
    setNotice(null);
    applyGardenAdvice(deviceId)
      .then(() => {
        setNotice("Đã áp dụng ngưỡng tưới cho cả vườn.");
        setLoading(true);
        setReloadKey((current) => current + 1);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Không áp dụng được gợi ý.");
      })
      .finally(() => setApplying(false));
  };

  const zones = data?.zones ?? [];
  const sample = zones[0]?.advice;
  const raining = zones.some((item) => item.advice.weather.raining);
  const hasChange = zones.some((item) => item.advice.thresholdDelta !== 0);
  const soilReason = sample?.reasons.find((reason) => reason.startsWith("Đất "));

  return (
    <section className="panel manager-card soil-plan">
      <div className="manager-card-head">
        <div>
          <p className="eyebrow">Điều kiện tưới</p>
          <h2>Loại đất của khu vườn</h2>
        </div>
        <p className="manager-card-hint">
          Đổi loại đất chỉ cập nhật gợi ý. Ngưỡng tưới chỉ đổi khi bấm áp dụng.
        </p>
      </div>

      <div className="soil-plan-toolbar">
        <label className="field">
          <span>Loại đất</span>
          <select
            value={soil}
            disabled={saving || applying}
            onChange={(event) => handleSoilChange(event.target.value as SoilType)}
          >
            {SOIL_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="soil-plan-context">
          {soilReason && <p>{soilReason}</p>}
          {sample && (
            <p className="manager-hint">
              Mưa {sample.weather.rain}% · {sample.weather.temperature ?? "--"}°C · độ ẩm{" "}
              {sample.weather.humidity ?? "--"}% · {sample.weather.season}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <p className="manager-hint">Đang tính gợi ý cho 6 ô trồng...</p>
      ) : (
        <div className="soil-plan-table-wrap">
          <table className="soil-plan-table">
            <thead>
              <tr>
                <th>Ô trồng</th>
                <th>Ngưỡng tưới</th>
                <th>Khung giờ</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((item) => {
                const advice = item.advice;
                const changed = advice.thresholdDelta !== 0;
                return (
                  <tr key={item.zoneId} className={changed ? "changed" : ""}>
                    <td>
                      <strong>{item.zoneId}</strong>
                      <span>{item.name}</span>
                    </td>
                    <td>
                      {advice.currentThreshold}% <em>→</em> {advice.suggestedThreshold}%
                    </td>
                    <td>
                      {advice.window ? `${advice.window.start}–${advice.window.end}` : "Tạm hoãn"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      {notice && <p className="form-success">{notice}</p>}

      <div className="soil-plan-footer">
        <span className="manager-hint">
          {raining
            ? "Đang mưa: tạm hoãn áp dụng ngưỡng."
            : hasChange
              ? "Áp dụng sẽ lưu ngưỡng tưới cho cả 6 ô."
              : "Cả vườn đang dùng đúng gợi ý."}
        </span>
        <button
          className="primary-button"
          onClick={handleApply}
          disabled={applying || raining || !hasChange || loading}
        >
          {applying ? "Đang áp dụng..." : "Áp dụng cho cả vườn"}
        </button>
      </div>
    </section>
  );
}
