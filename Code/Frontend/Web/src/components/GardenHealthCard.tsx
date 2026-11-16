"use client";

import type { Zone } from "../garden-data";

interface GardenHealthCardProps {
  zones: Zone[];
  mode: "auto" | "manual";
  deviceOnline: boolean;
}

export function GardenHealthCard({ zones, mode, deviceOnline }: GardenHealthCardProps) {
  const total = zones.length;
  const totalForBar = total || 1;
  const wateringCount = zones.filter((z) => z.pump).length;
  const dryCount = zones.filter(
    (z) => z.online && z.moisture !== null && z.moisture < z.threshold && !z.pump,
  ).length;
  const goodCount = deviceOnline ? Math.max(0, total - wateringCount - dryCount) : 0;

  let overallLabel = "Đang phát triển tốt";
  let overallTone = "active";
  if (!deviceOnline) {
    overallLabel = "Không có dữ liệu";
    overallTone = "danger";
  } else if (wateringCount > 0) {
    overallLabel = `Đang tưới ${wateringCount} ô`;
    overallTone = "active";
  } else if (dryCount > 0) {
    overallLabel = `${dryCount} ô cần tưới`;
    overallTone = "danger";
  }

  return (
    <article className="panel garden-health-card">
      <div className="panel-heading">
        <h2>Sức khỏe khu vườn</h2>
      </div>

      <div className="health-headline">
        <div className="health-reading">
          <strong>{total}</strong>
          <small>ô trồng</small>
        </div>
        <span className={`live-badge ${overallTone}`}>
          <i />
          {overallLabel}
        </span>
      </div>

      <div className="health-breakdown">
        <div className="health-bar-track">
          {goodCount > 0 && (
            <span
              className="health-bar-seg good"
              style={{ width: `${(goodCount / totalForBar) * 100}%` }}
              title={`${goodCount} ô đủ ẩm`}
            />
          )}
          {wateringCount > 0 && (
            <span
              className="health-bar-seg watering"
              style={{ width: `${(wateringCount / totalForBar) * 100}%` }}
              title={`${wateringCount} ô đang tưới`}
            />
          )}
          {dryCount > 0 && (
            <span
              className="health-bar-seg dry"
              style={{ width: `${(dryCount / totalForBar) * 100}%` }}
              title={`${dryCount} ô cần tưới`}
            />
          )}
        </div>
      </div>

      {deviceOnline && (
        <div className="health-chips-row">
          <span>
            <b className="dot good" /> {goodCount} ô đủ ẩm
          </span>
          {wateringCount > 0 && (
            <span>
              <b className="dot watering" /> {wateringCount} đang tưới
            </span>
          )}
          {dryCount > 0 && (
            <span>
              <b className="dot dry" /> {dryCount} cần tưới
            </span>
          )}
        </div>
      )}

      <div className="health-footer">
        <span>Chế độ: <strong>{mode === "auto" ? "Tự động" : "Thủ công"}</strong></span>
      </div>
    </article>
  );
}
