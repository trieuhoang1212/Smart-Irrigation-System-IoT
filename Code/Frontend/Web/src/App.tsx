"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useMqtt } from "./hooks/useMqtt";
import { useActivity } from "./hooks/useActivity";
import { useWateredLiters } from "./hooks/useWateredLiters";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { GardenOverview } from "./components/GardenOverview";
import { ControlPanel } from "./components/ControlPanel";
import { HistoryChart } from "./components/HistoryChart";
import { MetricsOverview } from "./components/MetricsOverview";
import { ActivityFeed } from "./components/ActivityFeed";
import { BackToTop } from "./components/BackToTop";
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
  const selectedZone = zones.find((zone) => zone.id === activeZone) ?? zones[0];

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

  const handleTogglePump = async () => {
    if (!connected) {
      notify("Chưa kết nối Backend realtime, chưa gửi được lệnh.", "error");
      return;
    }
    if (mode === "auto") await changeMode("manual");
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

        {!connected && (
          <div className="offline-banner">
            <span>!</span>
            <div>
              <strong>Backend chưa kết nối</strong>
              <small>
                Hãy chắc chắn Backend đang chạy và kết nối được Mosquitto.
              </small>
            </div>
            <button onClick={reconnect}>Kết nối lại</button>
          </div>
        )}

        <GardenOverview
          zones={zones}
          activeZone={activeZone}
          soil={soil}
          connected={connected}
          deviceId={deviceId}
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
          tankDistanceCm={tankDistanceCm}
          tankEmpty={tankEmpty}
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
