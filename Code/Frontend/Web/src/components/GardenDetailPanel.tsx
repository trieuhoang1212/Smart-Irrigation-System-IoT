"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SoilType, Zone } from "../garden-data";
import { BACKEND_URL } from "../lib/backend";
import { formatSpan } from "../lib/time";
import { useMoistureForecast } from "../hooks/useMoistureForecast";
import { zoneStatus } from "../lib/zone-status";
import { formatDate, harvestDate } from "../lib/zone-date";
import { DropletIcon, EditIcon } from "./icons";
import { ZonePhoto } from "./ZonePhoto";

export function GardenDetailPanel({
  zone,
  soil,
  deviceId,
  controlsEnabled,
  tankEmpty,
  onToggleIrrigation,
}: {
  zone: Zone;
  soil: SoilType;
  deviceId: string;
  controlsEnabled: boolean;
  tankEmpty: boolean;
  onToggleIrrigation: () => void;
}) {
  const status = zoneStatus(zone);
  const expectedHarvest = harvestDate(zone.plantedAt, zone.harvestDays);
  const blocked = !controlsEnabled || tankEmpty;
  const blockedReason = tankEmpty
    ? "Bồn nước đã cạn nên bơm bị chặn"
    : "ESP32 đang offline nên chưa gửi được lệnh";

  const forecast = useMoistureForecast({ backendUrl: BACKEND_URL, deviceId, zone });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = Math.max(0, now - forecast.computedAt);
  const dryRemaining =
    forecast.dryingEtaMs === null
      ? null
      : Math.max(0, forecast.dryingEtaMs - elapsed);
  const wetRemaining =
    forecast.wateringMs === null
      ? null
      : Math.max(0, forecast.wateringMs - (zone.pump ? elapsed : 0));

  let dryLabel = "--";
  let wetLabel = "--";
  if (zone.online && zone.moisture !== null) {
    if (zone.moisture <= zone.threshold) dryLabel = "Đã tới ngưỡng";
    else if (zone.pump) dryLabel = "Đang tưới";
    else if (dryRemaining !== null) dryLabel = `~${formatSpan(dryRemaining)}`;
    else dryLabel = forecast.loading ? "Đang tính..." : "Chưa đủ dữ liệu";

    if (zone.moisture >= zone.stopThreshold) wetLabel = "Đã đủ ẩm";
    else if (wetRemaining !== null) wetLabel = `~${formatSpan(wetRemaining)}`;
    else wetLabel = forecast.loading ? "Đang tính..." : "Chưa đủ dữ liệu";
  }

  return (
    <aside className="garden-detail" aria-live="polite">
      <ZonePhoto zone={zone} className="garden-detail-photo" />

      <div className="garden-detail-head">
        <span className="zone-tag">{zone.id}</span>
        <span className={`zone-chip ${status.tone}`}>{status.label}</span>
      </div>

      <h3>{zone.name}</h3>
      <p className="garden-detail-sub">
        {zone.group}
        {zone.crop ? ` · ${zone.crop}` : ""}
      </p>

      {zone.growth && (
        <div className="garden-growth">
          <div className="garden-growth-head">
            <span>{zone.growth.label}</span>
            <span>
              Ngày {zone.growth.day}/{zone.growth.totalDays}
            </span>
          </div>
          <div className="progress">
            <i style={{ width: `${zone.growth.progress}%` }} />
          </div>
        </div>
      )}

      <dl className="garden-facts">
        <div>
          <dt>Độ ẩm đất</dt>
          <dd>{zone.online && zone.moisture !== null ? `${zone.moisture}%` : "--"}</dd>
        </div>
        <div>
          <dt>Ngưỡng tưới</dt>
          <dd>{zone.threshold}%</dd>
        </div>
        <div>
          <dt>Còn tới ngưỡng</dt>
          <dd className="forecast-value">{dryLabel}</dd>
        </div>
        <div>
          <dt>Tưới đủ ẩm</dt>
          <dd className="forecast-value">{wetLabel}</dd>
        </div>
        <div>
          <dt>Loại đất</dt>
          <dd>{soil}</dd>
        </div>
        <div>
          <dt>Ngày trồng</dt>
          <dd>{formatDate(zone.plantedAt)}</dd>
        </div>
        <div>
          <dt>Thu hoạch</dt>
          <dd>{expectedHarvest ?? "Chưa đặt"}</dd>
        </div>
      </dl>

      {zone.online && forecast.hasHistory && (
        <p className="garden-facts-note">
          Ước tính từ diễn biến 24 giờ · ngưỡng {zone.threshold}%, đủ ẩm{" "}
          {zone.stopThreshold}%
        </p>
      )}

      {zone.notes && <p className="garden-detail-note">{zone.notes}</p>}

      {tankEmpty && (
        <p className="garden-detail-note">
          Bồn nước đã cạn — châm thêm nước trước khi tưới.
        </p>
      )}

      {!controlsEnabled && (
        <p className="garden-detail-note">
          ESP32 đang offline — nút tưới tạm khoá. Vẫn sửa được hồ sơ cây.
        </p>
      )}

      <div className="garden-detail-actions">
        <button
          className={`water-button ${zone.pump ? "watering" : ""}`}
          onClick={onToggleIrrigation}
          disabled={blocked}
          title={blocked ? blockedReason : "Tưới khu vực đang chọn"}
        >
          <DropletIcon size={15} />
          {zone.pump ? "Đang tưới..." : "Tưới khu vực này"}
        </button>
        <Link className="ghost-button" href={`/garden?zone=${zone.id}`}>
          <EditIcon size={14} />
          Sửa
        </Link>
      </div>
    </aside>
  );
}
