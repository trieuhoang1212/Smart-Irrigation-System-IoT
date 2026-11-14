"use client";

import Link from "next/link";
import { useMemo } from "react";
import { type ActivityEvent } from "../hooks/useActivity";
import { historyHref } from "../lib/sync";

const STATUS_LABEL: Record<NonNullable<ActivityEvent["status"]>, string> = {
  pending: "chờ xác nhận",
  confirmed: "đã xác nhận",
  timeout: "không phản hồi",
};

function formatEventTime(at: number, showDate: boolean) {
  const date = new Date(at);
  if (!showDate) {
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  return `${date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} · ${date.toLocaleTimeString(
    "vi-VN",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

export function ActivityFeed({
  events,
  loading,
  error,
  showDate = false,
  showHistoryLink = false,
  highlightAt = null,
  emptyText = "Chưa có lệnh hoặc thay đổi ngưỡng nào.",
  scroll = true,
}: {
  events: ActivityEvent[];
  loading: boolean;
  error: string | null;
  showDate?: boolean;
  showHistoryLink?: boolean;
  highlightAt?: number | null;
  emptyText?: string;
  scroll?: boolean;
}) {
  const highlightedId = useMemo(() => {
    if (highlightAt === null || events.length === 0) return null;
    let best = events[0];
    for (const event of events) {
      if (Math.abs(event.at - highlightAt) < Math.abs(best.at - highlightAt)) {
        best = event;
      }
    }
    return best.id;
  }, [events, highlightAt]);

  const list = (
    <div className={`activity-list ${scroll ? "" : "expanded"}`}>
      {error ? (
        <div className="empty-state error">{error}</div>
      ) : events.length ? (
        events.map((event) => (
          <div
            className={`activity-item ${event.status ?? ""} ${event.id === highlightedId ? "selected" : ""}`}
            key={event.id}
          >
            <i />
            <time>{formatEventTime(event.at, showDate)}</time>
            <span>{event.text}</span>
            {event.status && (
              <small className="activity-status">{STATUS_LABEL[event.status]}</small>
            )}
            {showHistoryLink && (
              <Link
                className="activity-link"
                href={historyHref(event.at, event.zoneId ?? null)}
              >
                Xem biểu đồ
              </Link>
            )}
          </div>
        ))
      ) : (
        <div className="empty-state">
          {loading ? "Đang tải nhật ký..." : emptyText}
        </div>
      )}
    </div>
  );

  return list;
}
