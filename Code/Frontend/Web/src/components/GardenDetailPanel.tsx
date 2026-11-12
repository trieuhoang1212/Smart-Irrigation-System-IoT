"use client";

import Link from "next/link";
import type { Zone } from "../garden-data";
import { zoneStatus } from "../lib/zone-status";
import { formatDate, harvestDate } from "../lib/zone-date";
import { DropletIcon, EditIcon } from "./icons";
import { ZonePhoto } from "./ZonePhoto";

export function GardenDetailPanel({
  zone,
  connected,
  onToggleIrrigation,
}: {
  zone: Zone;
  connected: boolean;
  onToggleIrrigation: () => void;
}) {
  const status = zoneStatus(zone);
  const expectedHarvest = harvestDate(zone.plantedAt, zone.harvestDays);

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
          <dt>Loại đất</dt>
          <dd>{zone.soil}</dd>
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

      {zone.notes && <p className="garden-detail-note">{zone.notes}</p>}

      <div className="garden-detail-actions">
        <button
          className={`water-button ${zone.pump ? "watering" : ""}`}
          onClick={onToggleIrrigation}
          disabled={!connected}
          title={connected ? "Tưới khu vực đang chọn" : "Cần kết nối MQTT"}
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
