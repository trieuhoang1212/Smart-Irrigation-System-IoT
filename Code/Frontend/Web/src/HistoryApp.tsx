"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useMqtt } from "./hooks/useMqtt";
import { useWatering } from "./hooks/useWatering";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { HistoryChart } from "./components/HistoryChart";
import { EnvironmentHistory } from "./components/EnvironmentHistory";
import { WaterDonut } from "./components/WaterDonut";
import { BackToTop } from "./components/BackToTop";
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
  const [activeZone, setActiveZone] = useState(sync.zone ?? "");
  const [focusAt, setFocusAt] = useState<number | null>(sync.at);
  const [range, setRange] = useState<"1h" | "24h" | "7d">("24h");

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

  const wateringByZone = useWatering(deviceId, 0);

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
    replaceSyncParams(null, selectedZone?.id ?? null);
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

  const envZoneId = zones[0]?.id ?? selectedZone.id;

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
        activeZone={selectedZone.id}
      />

      <section className="content">
        <div className="history-page">
          <Topbar
            active="history"
            crumb="Lịch sử cảm biến"
            eyebrow="Dữ liệu cảm biến"
            title="Lịch sử cảm biến"
            connected={connected}
            lastUpdated={lastUpdated}
            mode={mode}
            activeZone={selectedZone.id}
            zones={zones}
            onSelectZone={handleSelectZone}
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
                <Link className="link-button" href={activityHref(focusAt, selectedZone.id)}>
                  Xem nhật ký quanh mốc
                </Link>
                <button type="button" onClick={clearFocus}>
                  <CloseIcon size={14} />
                  Bỏ đánh dấu
                </button>
              </div>
            </div>
          )}

          <div className="bento-dashboard">
            <div className="bento-col-main">
              <HistoryChart
                backendUrl={BACKEND_URL}
                deviceId={deviceId}
                zones={zones}
                activeZone={selectedZone.id}
                connected={connected}
                onSelectZone={handleSelectZone}
                liveSample={liveSample}
                focusAt={focusAt}
                allowedMetrics={["moisture"]}
                range={range}
                onRangeChange={setRange}
                fill
                onPointSelect={(sample) =>
                  router.push(activityHref(sample.recordedAt, selectedZone.id))
                }
              />

              <EnvironmentHistory
                backendUrl={BACKEND_URL}
                deviceId={deviceId}
                zoneId={envZoneId}
                range={range}
                connected={connected}
              />
            </div>

            <aside className="bento-col-side">
              <WaterDonut zones={zones} byZone={wateringByZone} />

              <section className="panel bento-note-card">
                <div className="panel-heading">
                  <div>
                    <h2>Cách đọc biểu đồ</h2>
                    <p>Đối chiếu cảm biến với nhật ký điều khiển.</p>
                  </div>
                </div>
                <p className="bento-note-text">
                  Biểu đồ độ ẩm đất đổi theo khu đang chọn; nhiệt độ, độ ẩm không
                  khí và cảm biến mưa dùng chung cho cả vườn. Chạm lên biểu đồ độ
                  ẩm để mở nhật ký quanh mốc đó.
                </p>
                <Link className="link-button" href={activityHref(focusAt, selectedZone.id)}>
                  Mở nhật ký hoạt động
                </Link>
              </section>
            </aside>
          </div>
        </div>
      </section>

      <BackToTop />
    </main>
  );
}
