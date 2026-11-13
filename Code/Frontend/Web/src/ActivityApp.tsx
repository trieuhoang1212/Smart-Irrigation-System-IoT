"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMqtt } from "./hooks/useMqtt";
import { useActivity } from "./hooks/useActivity";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { ActivityFeed } from "./components/ActivityFeed";
import { BackToTop } from "./components/BackToTop";
import { CloseIcon } from "./components/icons";
import { BACKEND_URL } from "./lib/backend";
import {
  formatSyncClock,
  historyHref,
  parseSyncParams,
  replaceSyncParams,
} from "./lib/sync";

const FOCUS_WINDOW_MS = 60 * 60 * 1000;

export function ActivityApp() {
  const sync = parseSyncParams(useSearchParams());
  const [focusAt, setFocusAt] = useState<number | null>(sync.at);

  const {
    connected,
    configLoading,
    configError,
    deviceId,
    lastUpdated,
    deviceOnline,
    brokerConnected,
    reconnect,
  } = useMqtt({ backendUrl: BACKEND_URL });

  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    refresh: refreshEvents,
  } = useActivity({
    backendUrl: BACKEND_URL,
    deviceId,
    limit: 100,
    visible: 100,
  });

  const filtered = useMemo(() => {
    if (focusAt === null) return events;
    return events.filter((event) => Math.abs(event.at - focusAt) <= FOCUS_WINDOW_MS);
  }, [events, focusAt]);

  const clearFocus = () => {
    setFocusAt(null);
    replaceSyncParams(null, sync.zone);
  };

  if (configLoading || configError || !deviceId) {
    return (
      <main className="app-shell">
        <section className="content status-page">
          <div className={`status-card ${configError ? "error" : ""}`}>
            <strong>{configError ? "Không thể tải cấu hình" : "Đang tải cấu hình..."}</strong>
            <p>
              {configError ??
                "Đang lấy danh sách khu vực và device ID từ Backend."}
            </p>
            {configError && <button onClick={reconnect}>Thử lại</button>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell" id="top">
      <Sidebar
        active="activity"
        connected={connected}
        brokerConnected={brokerConnected}
        deviceOnline={deviceOnline}
        lastUpdated={lastUpdated}
        onReconnect={reconnect}
      />

      <section className="content">
        <Topbar
          active="activity"
          crumb="Nhật ký hoạt động"
          eyebrow="Điều khiển & cấu hình"
          title="Nhật ký hoạt động"
          subtitle="Lệnh bơm, chế độ và thay đổi ngưỡng được Backend ghi lại theo thời gian."
          connected={connected}
          lastUpdated={lastUpdated}
        />

        {!connected && (
          <div className="offline-banner">
            <span>!</span>
            <div>
              <strong>Backend chưa kết nối</strong>
              <small>Đang hiển thị nhật ký đã lưu, chưa có cập nhật trực tiếp.</small>
            </div>
            <button onClick={reconnect}>Kết nối lại</button>
          </div>
        )}

        {focusAt !== null && (
          <div className="sync-banner">
            <div>
              <strong>Đang lọc quanh mốc {formatSyncClock(focusAt)}</strong>
              <small>
                Hiển thị hoạt động trong ±60 phút
                {sync.zone ? ` · mốc mở từ biểu đồ ${sync.zone}` : ""}.
              </small>
            </div>
            <div className="sync-banner-actions">
              <Link className="link-button" href={historyHref(focusAt, sync.zone)}>
                Xem biểu đồ quanh mốc
              </Link>
              <button type="button" onClick={clearFocus}>
                <CloseIcon size={14} />
                Bỏ lọc
              </button>
            </div>
          </div>
        )}

        <section className="panel activity-page-card">
          <div className="panel-heading">
            <div>
              <h2>Dòng hoạt động</h2>
              <p>
                {filtered.length} sự kiện
                {focusAt !== null ? " trong khung giờ đang lọc" : " gần nhất"}
              </p>
            </div>
            <button
              className="link-button"
              onClick={refreshEvents}
              disabled={eventsLoading}
            >
              {eventsLoading ? "Đang tải..." : "Làm mới"}
            </button>
          </div>

          <ActivityFeed
            events={filtered}
            loading={eventsLoading}
            error={eventsError}
            showDate
            showHistoryLink
            highlightAt={focusAt}
            scroll={false}
            emptyText={
              focusAt !== null
                ? "Không có hoạt động trong ±60 phút quanh mốc này. Bỏ lọc để xem toàn bộ nhật ký."
                : "Chưa có lệnh hoặc thay đổi ngưỡng nào."
            }
          />
        </section>

        <p className="sync-note">
          Mỗi dòng có nút “Xem biểu đồ” để mở Lịch sử cảm biến đúng thời điểm sự kiện
          xảy ra, tiện đối chiếu với diễn biến độ ẩm.
        </p>
      </section>

      <BackToTop />
    </main>
  );
}
