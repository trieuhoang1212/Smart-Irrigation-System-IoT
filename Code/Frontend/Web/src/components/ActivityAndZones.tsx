"use client";

import React from "react";
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
}

export function ActivityAndZones({
  events,
  eventsLoading,
  eventsError,
  onRefreshEvents,
}: ActivityAndZonesProps) {
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
    </section>
  );
}
