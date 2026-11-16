"use client";

import Link from "next/link";
import type { SoilType, Zone } from "../garden-data";
import { zoneHref } from "../lib/zone-link";
import { zoneStatus } from "../lib/zone-status";
import { harvestDate } from "../lib/zone-date";
import { ChartIcon, EditIcon, GaugeIcon, LeafIcon } from "./icons";
import { ZonePhoto } from "./ZonePhoto";

export function ZoneSpotlightCard({ zone, soil }: { zone: Zone; soil: SoilType }) {
  const status = zoneStatus(zone);
  const moisture = zone.online ? zone.moisture : null;
  const fill = moisture === null ? 0 : Math.max(0, Math.min(100, moisture));
  const threshold = Math.max(0, Math.min(100, zone.threshold));
  const dry = status.tone === "dry";
  const expectedHarvest = harvestDate(zone.plantedAt, zone.harvestDays);

  return (
    <article className="panel zone-spotlight">
      <div className="spot-head">
        <ZonePhoto zone={zone} className="spot-photo" />
        <div className="spot-id">
          <span className="spot-eyebrow">{zone.id} · Ô đang chọn</span>
          <h2>{zone.name}</h2>
          <span className={`zone-chip ${status.tone}`}>{status.label}</span>
        </div>
        <Link
          className="spot-edit"
          href={zoneHref("/garden", zone.id)}
          aria-label="Sửa hồ sơ ô trồng"
          title="Sửa hồ sơ ô trồng"
        >
          <EditIcon size={15} />
        </Link>
      </div>

      <div className="spot-reading">
        <div className={`spot-value ${moisture === null ? "no-data" : ""}`}>
          <strong>{moisture === null ? "Không có dữ liệu" : moisture}</strong>
          {moisture !== null && <small>%</small>}
          {moisture !== null && <span>độ ẩm đất</span>}
        </div>
        <div className="spot-threshold">
          <span>Tự tưới khi dưới</span>
          <strong>{zone.threshold}%</strong>
        </div>
      </div>

      <div
        className={`spot-bar ${dry ? "dry" : ""}`}
        role="img"
        aria-label={`Độ ẩm đất ${moisture === null ? "chưa có dữ liệu" : `${moisture}%`}, ngưỡng tưới ${zone.threshold}%`}
      >
        <span className="spot-bar-fill" style={{ width: `${fill}%` }} />
        <span className="spot-bar-tick" style={{ left: `${threshold}%` }} />
      </div>
      <div className="spot-scale">
        <span>Khô</span>
        <span>Đủ ẩm</span>
      </div>

      <div className="spot-meta">
        <span>
          <LeafIcon size={12} />
          {soil}
        </span>
        <span>{expectedHarvest ? `Thu hoạch ${expectedHarvest}` : "Chưa đặt ngày thu hoạch"}</span>
      </div>

      <div className="spot-links">
        <Link href={zoneHref("/garden", zone.id)}>
          <EditIcon size={13} />
          Hồ sơ ô
        </Link>
        <Link href={zoneHref("/history", zone.id)}>
          <ChartIcon size={13} />
          Lịch sử
        </Link>
        <Link href={zoneHref("/analysis", zone.id)}>
          <GaugeIcon size={13} />
          Phân tích
        </Link>
      </div>
    </article>
  );
}
