"use client";

import React from "react";
import { type Zone } from "../garden-data";
import { type ActivityEvent } from "../hooks/useActivity";

const STATUS_LABEL: Record<NonNullable<ActivityEvent["status"]>, string> = {
  pending: "chờ xác nhận",
  confirmed: "đã xác nhận",
  timeout: "không phản hồi",
};

interface ActivityAndZonesProps {
  events: ActivityEvent[];
  eventsLoading: boolean;
  eventsError: string | null;
  onRefreshEvents: () => void;
  visibleZones: Zone[];
  activeZone: string;
  onSelectZone: (zoneId: string) => void;
}

export function ActivityAndZones({
  events,
  eventsLoading,
  eventsError,
  onRefreshEvents,
  visibleZones,
  activeZone,
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
      <article className="panel activity-card" id="activity">
        <div className="panel-heading">
          <div>
            <h2>Nhật ký hoạt động</h2>
            <p>Lệnh điều khiển & thay đổi ngưỡng lưu trên Backend</p>
          </div>
          <button className="link-button" onClick={onRefreshEvents} disabled={eventsLoading}>
            {eventsLoading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>
        <div className="activity-list">
          {eventsError ? (
            <div className="empty-state error">{eventsError}</div>
          ) : events.length ? (
            events.map((event) => (
              <div className={`activity-item ${event.status ?? ""}`} key={event.id}>
                <i />
                <time>{new Date(event.at).toLocaleTimeString("vi-VN")}</time>
                <span>{event.text}</span>
                {event.status && (
                  <small className="activity-status">{STATUS_LABEL[event.status]}</small>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state">
              {eventsLoading ? "Đang tải nhật ký..." : "Chưa có lệnh hoặc thay đổi ngưỡng nào."}
            </div>
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
