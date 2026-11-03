"use client";

import React from "react";
import { type Zone } from "../garden-data";

interface ActivityAndZonesProps {
  logs: string[];
  visibleZones: Zone[];
  activeZone: string;
  onClearLogs: () => void;
  onSelectZone: (zoneId: string) => void;
}

export function ActivityAndZones({
  logs,
  visibleZones,
  onClearLogs,
  onSelectZone,
}: ActivityAndZonesProps) {
  const healthyCount = visibleZones.filter(
    (zone) => zone.online && zone.moisture >= zone.threshold,
  ).length;
  const onlineCount = visibleZones.filter((zone) => zone.online).length;

  return (
    <section className="below-grid">
      <article className="panel activity-card">
        <div className="panel-heading">
          <div>
            <h2>Nhật ký MQTT Events</h2>
            <p>Lịch sử truyền nhận dữ liệu</p>
          </div>
          <button className="link-button" onClick={onClearLogs}>
            Xóa log
          </button>
        </div>
        <div className="activity-list">
          {logs.length ? (
            logs.slice(0, 5).map((log, index) => (
              <div className="activity-item" key={index}>
                <i />
                {log}
              </div>
            ))
          ) : (
            <div className="empty-state">Chưa có sự kiện mới.</div>
          )}
        </div>
      </article>

      <article className="panel zone-summary">
        <div className="panel-heading">
          <div>
            <h2>Tình trạng các khu vực</h2>
            <p>Chỉ số độ ẩm đất toàn vườn</p>
          </div>
          <span className="healthy-count">
            {healthyCount}/{onlineCount} Đạt chuẩn
          </span>
        </div>
        {visibleZones.map((zone) => (
          <button
            className="zone-row"
            key={zone.id}
            onClick={() => onSelectZone(zone.id)}
          >
            <span
              className="zone-color"
              style={{ background: zone.color }}
            />
            <strong>{zone.id}</strong>
            <span>{zone.name}</span>
            <small className={zone.online ? "zone-live" : "zone-offline"}>
              {zone.online ? "LIVE" : "Chưa kết nối"}
            </small>
            <div className="mini-bar">
              <i style={{ width: `${zone.moisture}%` }} />
            </div>
            <b className={zone.moisture < zone.threshold ? "dry" : ""}>
              {zone.online ? `${zone.moisture}%` : "--"}
            </b>
          </button>
        ))}
      </article>
    </section>
  );
}
