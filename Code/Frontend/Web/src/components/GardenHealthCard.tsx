"use client";

import type { Zone } from "../garden-data";
import { Tooltip } from "./Tooltip";

interface GardenHealthCardProps {
  zones: Zone[];
  mode: "auto" | "manual";
  deviceOnline: boolean;
  raining: boolean;
  rainPercent: number | null;
}

function zoneLabels(list: Zone[]): string {
  const names = list.slice(0, 2).map((zone) => zone.id).join(", ");
  return list.length > 2 ? `${names} +${list.length - 2}` : names;
}

export function GardenHealthCard({
  zones,
  mode,
  deviceOnline,
  raining,
  rainPercent,
}: GardenHealthCardProps) {
  const total = zones.length;
  const totalForBar = total || 1;
  const online = zones.filter((zone) => zone.online && zone.moisture !== null);
  const wateringZones = online.filter((zone) => zone.pump);
  const dryZones = online.filter(
    (zone) =>
      !zone.pump && zone.moisture !== null && zone.moisture < zone.threshold,
  );
  const wetZones = online.filter(
    (zone) =>
      !zone.pump &&
      zone.moisture !== null &&
      zone.moisture > zone.stopThreshold,
  );
  const wateringCount = wateringZones.length;
  const dryCount = dryZones.length;
  const wetCount = wetZones.length;
  const goodCount = deviceOnline
    ? Math.max(0, online.length - wateringCount - dryCount - wetCount)
    : 0;

  let overallLabel = "Đang phát triển tốt";
  let overallTone = "active";
  if (!deviceOnline) {
    overallLabel = "Không có dữ liệu";
    overallTone = "danger";
  } else if (wateringCount > 0) {
    overallLabel = `Đang tưới ${wateringCount} ô`;
  } else if (dryCount > 0) {
    overallLabel = `${dryCount} ô cần tưới`;
    overallTone = "danger";
  } else if (wetCount > 0) {
    overallLabel = `${wetCount} ô quá ẩm`;
    overallTone = "warn";
  }

  let tip: string;
  if (!deviceOnline) {
    tip = "Chưa nhận telemetry — kiểm tra ESP32 và Backend.";
  } else if (raining) {
    tip = `Cảm biến mưa báo ${rainPercent ?? 0}% — hệ thống tạm hoãn tưới.`;
  } else if (dryCount > 0) {
    tip = `Ưu tiên tưới ${zoneLabels(dryZones)} — độ ẩm dưới ngưỡng tưới.`;
  } else if (wetCount > 0) {
    tip = `${zoneLabels(wetZones)} vượt ngưỡng dừng — tạm ngưng tưới để tránh úng rễ.`;
  } else if (wateringCount > 0) {
    tip = "Bơm đang chạy — chờ độ ẩm đạt ngưỡng dừng rồi kiểm tra lại.";
  } else {
    tip = "Độ ẩm ổn định — duy trì ngưỡng hiện tại và tưới vào sáng sớm.";
  }

  return (
    <article className="panel garden-health-card">
      <div className="panel-heading">
        <h2>
          Sức khỏe khu vườn
          <Tooltip text="Tính từ độ ẩm so với ngưỡng tưới và ngưỡng dừng của từng ô, cộng trạng thái kết nối ESP32." />
        </h2>
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
          {wetCount > 0 && (
            <span
              className="health-bar-seg wet"
              style={{ width: `${(wetCount / totalForBar) * 100}%` }}
              title={`${wetCount} ô quá ẩm`}
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
          {wetCount > 0 && (
            <span>
              <b className="dot wet" /> {wetCount} quá ẩm
            </span>
          )}
        </div>
      )}

      <p className="health-tip">{tip}</p>

      <div className="health-footer">
        <span>Chế độ: <strong>{mode === "auto" ? "Tự động" : "Thủ công"}</strong></span>
      </div>
    </article>
  );
}
