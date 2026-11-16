"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMqtt } from "./hooks/useMqtt";
import { type ActivityEvent, type ActivityKind, useActivity } from "./hooks/useActivity";
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

type RangeKey = "24h" | "7d" | "30d" | "all";

const RANGES: Array<{ key: RangeKey; label: string; ms: number | null }> = [
  { key: "24h", label: "24 giờ", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "7 ngày", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", label: "30 ngày", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "all", label: "Tất cả", ms: null },
];

const KINDS: Array<{ key: ActivityKind | "all"; label: string }> = [
  { key: "all", label: "Mọi loại" },
  { key: "pump", label: "Bơm" },
  { key: "mode", label: "Chế độ" },
  { key: "threshold", label: "Ngưỡng" },
  { key: "weather", label: "Hoãn mưa" },
];

const STATUS_LABEL: Record<NonNullable<ActivityEvent["status"]>, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  timeout: "Không phản hồi",
};

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadActivityCsv(events: ActivityEvent[]) {
  const header = ["Thời gian", "Khu vực", "Nội dung", "Trạng thái"];
  const lines = events.map((event) =>
    [
      new Date(event.at).toLocaleString("vi-VN", { hour12: false }),
      event.zoneId ?? "Toàn vườn",
      event.text,
      event.status ? STATUS_LABEL[event.status] : "",
    ]
      .map(csvCell)
      .join(","),
  );
  // BOM để Excel nhận đúng tiếng Việt khi mở file CSV.
  const blob = new Blob([`\uFEFF${header.join(",")}\r\n${lines.join("\r\n")}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nhat-ky-hoat-dong-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ActivityApp() {
  const sync = parseSyncParams(useSearchParams());
  const [focusAt, setFocusAt] = useState<number | null>(sync.at);
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<ActivityKind | "all">("all");
  const [range, setRange] = useState<RangeKey>("all");
  const [retentionDays, setRetentionDays] = useState(30);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{
    message: string;
    error: boolean;
  } | null>(null);

  const {
    zones,
    connected,
    mode,
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
    loadedAt,
    refresh: refreshEvents,
  } = useActivity({
    backendUrl: BACKEND_URL,
    deviceId,
    limit: 500,
    visible: 500,
  });

  const filtered = useMemo(() => {
    const rangeMs = RANGES.find((item) => item.key === range)?.ms ?? null;
    // Mốc thời gian lấy từ lần tải gần nhất, tránh gọi Date.now khi render.
    const cutoff = rangeMs === null || loadedAt === null ? null : loadedAt - rangeMs;
    return events.filter((event) => {
      if (focusAt !== null && Math.abs(event.at - focusAt) > FOCUS_WINDOW_MS) return false;
      if (zoneFilter !== "all" && event.zoneId !== zoneFilter) return false;
      if (kindFilter !== "all" && event.kind !== kindFilter) return false;
      if (cutoff !== null && event.at < cutoff) return false;
      return true;
    });
  }, [events, focusAt, zoneFilter, kindFilter, range, loadedAt]);

  const filtersActive =
    focusAt !== null || zoneFilter !== "all" || kindFilter !== "all" || range !== "all";

  const clearFocus = () => {
    setFocusAt(null);
    replaceSyncParams(null, sync.zone);
  };

  const clearFilters = () => {
    setZoneFilter("all");
    setKindFilter("all");
    setRange("all");
    if (focusAt !== null) clearFocus();
  };

  const excludeOldHistory = async () => {
    if (!deviceId || cleaning) return;
    const confirmed = window.confirm(
      `Xóa vĩnh viễn dữ liệu cũ hơn ${retentionDays} ngày?\n\n` +
        "Gồm mẫu cảm biến, lệnh điều khiển, thay đổi ngưỡng và lượt tưới. " +
        "Dữ liệu đã xóa không khôi phục được.",
    );
    if (!confirmed) return;

    setCleaning(true);
    setCleanupResult(null);
    try {
      const response = await fetch(
        `${BACKEND_URL.replace(/\/+$/, "")}/api/devices/${encodeURIComponent(deviceId)}/history?days=${retentionDays}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("HTTP error");
      const body = (await response.json()) as {
        removed?: { samples: number; commands: number; changes: number; runs: number };
      };
      const removed = body.removed;
      setCleanupResult({
        message: removed
          ? `Đã xóa ${removed.samples} mẫu cảm biến, ${removed.commands} lệnh, ` +
            `${removed.changes} thay đổi ngưỡng và ${removed.runs} lượt tưới.`
          : "Đã xóa dữ liệu cũ.",
        error: false,
      });
      await refreshEvents();
    } catch {
      setCleanupResult({
        message: "Không xóa được dữ liệu cũ. Kiểm tra kết nối Backend.",
        error: true,
      });
    } finally {
      setCleaning(false);
    }
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
        activeZone={sync.zone}
      />

      <section className="content">
        <Topbar
          active="activity"
          crumb="Nhật ký hoạt động"
          eyebrow="Điều khiển & cấu hình"
          title="Nhật ký hoạt động"
          connected={connected}
          lastUpdated={lastUpdated}
          mode={mode}
          activeZone={sync.zone}
          zones={zones}
          onSelectZone={(zoneId) => {
            setZoneFilter(zoneId);
            if (focusAt !== null) clearFocus();
          }}
        />

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

        <div className="bento-dashboard">
          <div className="bento-col-main">
            <section className="panel activity-page-card">
              <div className="panel-heading">
                <div>
                  <h2>Dòng hoạt động</h2>
                  <p>
                    {filtered.length} sự kiện
                    {filtersActive ? ` trong ${events.length} sự kiện đã tải` : " gần nhất"}
                  </p>
                </div>
                <div className="activity-heading-actions">
                  <button
                    className="ghost-button"
                    onClick={() => downloadActivityCsv(filtered)}
                    disabled={!filtered.length}
                    title="Tệp CSV mở trực tiếp bằng Excel"
                  >
                    Xuất Excel
                  </button>
                  <button
                    className="link-button"
                    onClick={refreshEvents}
                    disabled={eventsLoading}
                  >
                    {eventsLoading ? "Đang tải..." : "Làm mới"}
                  </button>
                </div>
              </div>

              <div className="activity-filters">
                <label className="activity-filter">
                  <span>Khu vực</span>
                  <select
                    value={zoneFilter}
                    onChange={(event) => setZoneFilter(event.target.value)}
                  >
                    <option value="all">Tất cả khu vực</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.id} · {zone.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="activity-filter">
                  <span>Loại</span>
                  <select
                    value={kindFilter}
                    onChange={(event) =>
                      setKindFilter(event.target.value as ActivityKind | "all")
                    }
                  >
                    {KINDS.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="activity-filter">
                  <span>Thời gian</span>
                  <select
                    value={range}
                    onChange={(event) => setRange(event.target.value as RangeKey)}
                  >
                    {RANGES.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                {filtersActive && (
                  <button type="button" className="link-button" onClick={clearFilters}>
                    Bỏ bộ lọc
                  </button>
                )}
              </div>

              <ActivityFeed
                events={filtered}
                loading={eventsLoading}
                error={eventsError}
                showDate
                showHistoryLink
                highlightAt={focusAt}
                emptyText={
                  filtersActive
                    ? "Không có hoạt động khớp bộ lọc. Bấm “Bỏ bộ lọc” để xem toàn bộ nhật ký."
                    : "Chưa có lệnh hoặc thay đổi ngưỡng nào."
                }
              />
            </section>
          </div>

          <aside className="bento-col-side">
            <section className="panel bento-note-card data-cleanup-card">
              <div className="panel-heading">
                <div>
                  <h2>Dọn dữ liệu cũ</h2>
                  <p>Giữ dữ liệu gần đây, xóa phần quá cũ.</p>
                </div>
              </div>
              <label className="field data-cleanup-field">
                <span>Giữ lại</span>
                <select
                  value={retentionDays}
                  onChange={(event) => setRetentionDays(Number(event.target.value))}
                >
                  <option value={7}>7 ngày gần nhất</option>
                  <option value={30}>30 ngày gần nhất</option>
                  <option value={90}>90 ngày gần nhất</option>
                </select>
              </label>
              <button
                type="button"
                className="ghost-button danger data-cleanup-button"
                onClick={() => void excludeOldHistory()}
                disabled={cleaning}
              >
                {cleaning ? "Đang xóa..." : `Xóa cũ hơn ${retentionDays} ngày`}
              </button>
              <p className="data-cleanup-hint">
                Xóa mẫu cảm biến, lệnh, thay đổi ngưỡng và lượt tưới cũ. Web sẽ hỏi
                xác nhận trước khi xóa.
              </p>
              {cleanupResult && (
                <p className={`data-cleanup-note ${cleanupResult.error ? "error" : ""}`}>
                  {cleanupResult.message}
                </p>
              )}
            </section>

            <section className="panel bento-note-card">
              <div className="panel-heading">
                <div>
                  <h2>Cách đọc nhật ký</h2>
                  <p>Mỗi dòng ứng với một lệnh hoặc thay đổi cấu hình.</p>
                </div>
              </div>
              <p className="bento-note-text">
                Mỗi dòng có nút “Xem biểu đồ” để mở Lịch sử cảm biến đúng thời điểm sự
                kiện xảy ra, tiện đối chiếu với diễn biến độ ẩm. Nút “Xuất Excel” tải
                đúng danh sách đang lọc ra tệp CSV.
              </p>
              <Link className="link-button" href={historyHref(focusAt, sync.zone)}>
                Mở biểu đồ cảm biến
              </Link>
            </section>
          </aside>
        </div>
      </section>

      <BackToTop />
    </main>
  );
}
