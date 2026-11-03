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
  activeZone,
  onClearLogs,
  onSelectZone,
}: ActivityAndZonesProps) {
  const onlineZones = visibleZones.filter((zone) => zone.online);
  const healthyCount = onlineZones.filter(
    (zone) => zone.moisture !== null && zone.moisture >= zone.threshold,
  ).length;
  const onlineCount = onlineZones.length;
  const wateringCount = onlineZones.filter((zone) => zone.pump).length;

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
            <p>
              {onlineCount
                ? `${wateringCount} luống đang tưới`
                : "Chờ dữ liệu từ ESP32..."}
            </p>
          </div>
          <span className="healthy-count">
            {onlineCount ? `${healthyCount}/${onlineCount} Đạt chuẩn` : "Chưa có dữ liệu"}
          </span>
        </div>
        {visibleZones.map((zone) => {
          const isActive = zone.id === activeZone;
          const isDry = zone.online && zone.moisture !== null && zone.moisture < zone.threshold;
          const isPumping = zone.online && zone.pump;

          return (
            <button
              className={`zone-row ${isActive ? "active" : ""} ${isPumping ? "pumping" : ""}`}
              key={zone.id}
              onClick={() => onSelectZone(zone.id)}
              title={
                zone.online
                  ? `Ngưỡng tưới ${zone.threshold}% · Dừng ở ${zone.stopThreshold}%`
                  : "Chưa nhận dữ liệu từ thiết bị"
              }
            >
              <span
                className="zone-color"
                style={{ background: zone.color }}
              />
              <strong>{zone.id}</strong>
              <span>{zone.name}</span>
              <small className={zone.online ? "zone-live" : "zone-offline"}>
                {!zone.online ? "OFFLINE" : isPumping ? "ĐANG TƯỚI" : "LIVE"}
              </small>
              <div className="mini-bar">
                <i
                  style={{
                    width: zone.online ? `${zone.moisture}%` : "0%",
                    background: isDry ? "#e4aa43" : undefined,
                  }}
                />
              </div>
              <b className={isDry ? "dry" : ""}>
                {zone.online ? `${zone.moisture}%` : "--"}
              </b>
            </button>
          );
        })}
      </article>
    </section>
  );
}
