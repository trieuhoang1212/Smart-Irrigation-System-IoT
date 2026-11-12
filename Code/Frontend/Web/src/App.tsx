"use client";

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
import { ActivityAndZones } from "./components/ActivityAndZones";
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
    refresh: refreshEvents,
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

  if (configLoading || configError || !selectedZone) {
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
          connected={connected}
          onSelectZone={setActiveZone}
          onToggleIrrigation={handleToggleIrrigation}
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
          onChangeMode={changeMode}
          onTogglePump={handleTogglePump}
          onChangeThreshold={(val) => setZoneThreshold(activeZone, val)}
          onToggleWeatherGate={toggleWeatherGate}
          onSaveZoneConfig={(input) => saveZoneConfig(selectedZone.id, input)}
        />

        <HistoryChart
          backendUrl={BACKEND_URL}
          deviceId={deviceId}
          zones={zones}
          activeZone={activeZone}
          onSelectZone={setActiveZone}
          connected={connected}
          liveSample={liveSample}
        />

        <MetricsOverview
          temperature={temperature}
          humidity={humidity}
          pumpOn={pumpOn}
          servoAngle={servoAngle}
          mode={mode}
          selectedZone={selectedZone}
        />

        <ActivityAndZones
          events={events}
          eventsLoading={eventsLoading}
          eventsError={eventsError}
          onRefreshEvents={refreshEvents}
        />
      </section>
    </main>
  );
}
