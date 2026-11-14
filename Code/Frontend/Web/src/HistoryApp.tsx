"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useMqtt } from "./hooks/useMqtt";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { HistoryChart } from "./components/HistoryChart";
import { BackToTop } from "./components/BackToTop";
import { DeviceStatusBanner } from "./components/DeviceStatusBanner";
import { CloseIcon } from "./components/icons";
import { BACKEND_URL } from "./lib/backend";
import {
  activityHref,
  formatSyncClock,
  parseSyncParams,
  replaceSyncParams,
} from "./lib/sync";

export function HistoryApp() {
  const router = useRouter();
  const sync = parseSyncParams(useSearchParams());
  const [activeZone, setActiveZone] = useState(sync.zone ?? "T002");
  const [focusAt, setFocusAt] = useState<number | null>(sync.at);

  const {
    zones,
    connected,
    configLoading,
    configError,
    deviceId,
    mode,
    temperature,
    humidity,
    rainPercent,
    raining,
    lastUpdated,
    lastTelemetryAt,
    deviceOnline,
    brokerConnected,
    reconnect,
  } = useMqtt({ backendUrl: BACKEND_URL });

  const selectedZone = zones.find((zone) => zone.id === activeZone) ?? zones[0];

  const handleSelectZone = useCallback(
    (zoneId: string) => {
      setActiveZone(zoneId);
      replaceSyncParams(focusAt, zoneId);
    },
    [focusAt],
  );

  const clearFocus = () => {
    setFocusAt(null);
    replaceSyncParams(null, activeZone);
  };

  if (configLoading || configError || !selectedZone || !deviceId) {
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

  const liveSample =
    selectedZone.online && selectedZone.moisture !== null && lastTelemetryAt !== null
      ? {
          recordedAt: lastTelemetryAt,
          zoneId: selectedZone.id,
          moisture: selectedZone.moisture,
          threshold: selectedZone.threshold,
          stopThreshold: selectedZone.stopThreshold,
          pump: selectedZone.pump,
          temperature,
          humidity,
          rain: rainPercent ?? 0,
          raining,
          mode,
        }
      : null;

  return (
    <main className="app-shell" id="top">
      <Sidebar
        active="history"
        connected={connected}
        brokerConnected={brokerConnected}
        deviceOnline={deviceOnline}
        lastUpdated={lastUpdated}
        onReconnect={reconnect}
      />

      <section className="content">
        <Topbar
          active="history"
          crumb="Lịch sử cảm biến"
          eyebrow="Dữ liệu cảm biến"
          title="Lịch sử cảm biến"
          subtitle="Theo dõi độ ẩm, nhiệt độ và cảm biến mưa; chạm lên biểu đồ để mở nhật ký quanh mốc đó."
          connected={connected}
          lastUpdated={lastUpdated}
        />

        <DeviceStatusBanner
          connected={connected}
          brokerConnected={brokerConnected}
          deviceOnline={deviceOnline}
          lastTelemetryAt={lastTelemetryAt}
          onReconnect={reconnect}
        />

        {focusAt !== null && (
          <div className="sync-banner">
            <div>
              <strong>Đang đánh dấu mốc {formatSyncClock(focusAt)}</strong>
              <small>
                Mốc này mở từ Nhật ký hoạt động — đường nét đứt trên biểu đồ.
              </small>
            </div>
            <div className="sync-banner-actions">
              <Link className="link-button" href={activityHref(focusAt, activeZone)}>
                Xem nhật ký quanh mốc
              </Link>
              <button type="button" onClick={clearFocus}>
                <CloseIcon size={14} />
                Bỏ đánh dấu
              </button>
            </div>
          </div>
        )}

        <HistoryChart
          backendUrl={BACKEND_URL}
          deviceId={deviceId}
          zones={zones}
          activeZone={activeZone}
          connected={connected}
          onSelectZone={handleSelectZone}
          liveSample={liveSample}
          focusAt={focusAt}
          onPointSelect={(sample) =>
            router.push(activityHref(sample.recordedAt, activeZone))
          }
        />

        <p className="sync-note">
          Nhật ký ghi lại lệnh điều khiển và thay đổi ngưỡng; biểu đồ chỉ có dữ liệu
          cảm biến. Chạm lên biểu đồ để đối chiếu hai nguồn theo cùng một mốc thời gian.
        </p>
      </section>

      <BackToTop />
    </main>
  );
}
