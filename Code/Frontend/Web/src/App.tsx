"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useMqtt } from "./hooks/useMqtt";
import { useActivity } from "./hooks/useActivity";
import { useWateredLiters } from "./hooks/useWateredLiters";
import { useWatering } from "./hooks/useWatering";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { GardenOverview } from "./components/GardenOverview";
import { ControlPanel } from "./components/ControlPanel";
import { HistoryChart } from "./components/HistoryChart";
import { MetricsOverview } from "./components/MetricsOverview";
import { ActivityFeed } from "./components/ActivityFeed";
import { BackToTop } from "./components/BackToTop";
import { DeviceStatusBanner } from "./components/DeviceStatusBanner";
import { ToastStack } from "./components/ToastStack";
import { BACKEND_URL } from "./lib/backend";
import { type ToastMessage, type ToastTone } from "./notifications";

export default function App() {
  const [activeZone, setActiveZone] = useState("T002");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);

  const notify = useCallback((message: string, tone: ToastTone) => {
    const id = ++toastIdRef.current;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const {
    zones,
    soil,
    connected,
    mode,
    pumpOn,
    temperature,
    humidity,
    rainPercent,
    raining,
    rainBlock,
    lastUpdated,
    togglePump,
    changeMode,
    toggleWeatherGate,
    reconnect,
    setZoneThreshold,
    configLoading,
    configError,
    deviceId,
    deviceOnline,
    brokerConnected,
    commandVersion,
    servoAngle,
    tankDistanceCm,
    tankEmpty,
    lastTelemetryAt,
    saveZoneConfig,
  } = useMqtt({
    backendUrl: BACKEND_URL,
    onNotify: notify,
  });

  const {
    events,
    loading: eventsLoading,
    error: eventsError,
  } = useActivity({
    backendUrl: BACKEND_URL,
    deviceId,
    refreshToken: commandVersion,
  });

  const wateredLitersByZone = useWateredLiters(zones);
  const wateringByZone = useWatering(deviceId, commandVersion);
  const selectedZone = zones.find((zone) => zone.id === activeZone) ?? zones[0];
  const selectedWatering = selectedZone ? wateringByZone[selectedZone.id] : undefined;

  const liveSample =
    selectedZone &&
    selectedZone.online &&
    selectedZone.moisture !== null &&
    lastTelemetryAt !== null
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

  const controlsEnabled = connected && deviceOnline;

  const handleTogglePump = async () => {
    if (!controlsEnabled) {
      notify("ESP32 đang offline — chưa gửi được lệnh tưới.", "error");
      return;
    }
    if (tankEmpty) {
      notify("Bồn nước đã cạn — châm thêm nước trước khi bật bơm.", "error");
      return;
    }
    if (mode === "auto") {
      const switched = await changeMode("manual");
      if (!switched) {
        notify("Không chuyển được sang Thủ công nên chưa gửi lệnh tưới.", "error");
        return;
      }
      notify("Đã chuyển cả vườn sang Thủ công; tưới tự động tạm dừng.", "info");
    }
    togglePump(selectedZone.id);
  };

  const handleToggleIrrigation = () => {
    void handleTogglePump();
  };

  return (
    <main className="app-shell" id="top">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <Sidebar
        connected={connected}
        brokerConnected={brokerConnected}
        deviceOnline={deviceOnline}
        lastUpdated={lastUpdated}
        onReconnect={reconnect}
      />

      <section className="content">
        <Topbar connected={connected} lastUpdated={lastUpdated} />

        <DeviceStatusBanner
          connected={connected}
          brokerConnected={brokerConnected}
          deviceOnline={deviceOnline}
          lastTelemetryAt={lastTelemetryAt}
          onReconnect={reconnect}
        />

        <GardenOverview
          zones={zones}
          activeZone={activeZone}
          soil={soil}
          controlsEnabled={controlsEnabled}
          deviceId={deviceId}
          tankEmpty={tankEmpty}
          onSelectZone={setActiveZone}
          onToggleIrrigation={handleToggleIrrigation}
          onApplyAdvice={(input) => saveZoneConfig(selectedZone.id, input)}
        />

        <ControlPanel
          mode={mode}
          selectedZone={selectedZone}
          temperature={temperature}
          humidity={humidity}
          raining={raining}
          rainPercent={rainPercent}
          rainBlock={rainBlock}
          wateredLiters={wateredLitersByZone[activeZone] ?? 0}
          lastRun={selectedWatering?.lastRun ?? null}
          todayLiters={selectedWatering?.todayLiters ?? 0}
          todayRuns={selectedWatering?.todayRuns ?? 0}
          wateringLoaded={selectedWatering !== undefined}
          tankDistanceCm={tankDistanceCm}
          tankEmpty={tankEmpty}
          controlsEnabled={controlsEnabled}
          onChangeMode={changeMode}
          onTogglePump={handleTogglePump}
          onChangeThreshold={(val) => setZoneThreshold(activeZone, val)}
          onToggleWeatherGate={toggleWeatherGate}
          onSaveZoneConfig={(input) => saveZoneConfig(selectedZone.id, input)}
        />

        <section className="panel overview-panel">
          <div className="panel-heading overview-panel-head">
            <div>
              <h2>Diễn biến 6 giờ</h2>
              <p>
                {selectedZone.id} · {selectedZone.name} · độ ẩm đất
              </p>
            </div>
            <Link className="link-button" href={`/history?zone=${activeZone}`}>
              Xem lịch sử
            </Link>
          </div>
          <HistoryChart
            compact
            backendUrl={BACKEND_URL}
            deviceId={deviceId}
            zones={zones}
            activeZone={activeZone}
            connected={connected}
            onSelectZone={setActiveZone}
            liveSample={liveSample}
          />
        </section>

        <MetricsOverview
          temperature={temperature}
          humidity={humidity}
          pumpOn={pumpOn}
          servoAngle={servoAngle}
          mode={mode}
          selectedZone={selectedZone}
        />

        <section className="panel overview-panel">
          <div className="panel-heading overview-panel-head">
            <div>
              <h2>Hoạt động gần đây</h2>
              <p>3 lệnh hoặc thay đổi ngưỡng mới nhất</p>
            </div>
            <Link className="link-button" href="/activity">
              Xem tất cả
            </Link>
          </div>
          <ActivityFeed
            events={events.slice(0, 3)}
            loading={eventsLoading}
            error={eventsError}
            scroll={false}
          />
        </section>
      </section>

      <BackToTop />
    </main>
  );
}
