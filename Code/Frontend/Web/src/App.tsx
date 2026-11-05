"use client";

import { useState, useCallback } from "react";
import { useMqtt } from "./hooks/useMqtt";
import { useWateredLiters } from "./hooks/useWateredLiters";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { GardenOverview } from "./components/GardenOverview";
import { ControlPanel } from "./components/ControlPanel";
import { HistoryChart } from "./components/HistoryChart";
import { MetricsOverview } from "./components/MetricsOverview";
import { ActivityAndZones } from "./components/ActivityAndZones";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
const MAX_LOGS = 50;

export default function App() {
  const [logs, setLogs] = useState<string[]>([
    `Backend: ${BACKEND_URL}`,
    "Chờ nhận dữ liệu từ ESP32 Wokwi...",
  ]);
  const [activeZone, setActiveZone] = useState("T002");
  const [view, setView] = useState<"2d" | "map">("2d");
  const [syncing, setSyncing] = useState(false);

  const appendLog = useCallback((message: string) => {
    setLogs((current) => [message, ...current].slice(0, MAX_LOGS));
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
  } = useMqtt({
    backendUrl: BACKEND_URL,
    onLog: appendLog,
  });

  const wateredLitersByZone = useWateredLiters(zones);
  const selectedZone = zones.find((zone) => zone.id === activeZone) ?? zones[0];

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
      appendLog("Mất kết nối thiết bị!");
      return;
    }
    if (mode === "auto") await changeMode("manual");
    togglePump(selectedZone.id);
  };

  const handleToggleIrrigation = () => {
    void handleTogglePump();
  };

  const handleSyncLiveData = () => {
    setSyncing(true);
    const timer = window.setTimeout(() => {
      setSyncing(false);
      appendLog(
        connected
          ? "Đang chờ dữ liệu cảm biến realtime từ ESP32"
          : "Không thể đồng bộ khi mất kết nối MQTT",
      );
    }, 500);
    return () => window.clearTimeout(timer);
  };

  return (
    <main className="app-shell">
      <Sidebar
        connected={connected}
        lastUpdated={lastUpdated}
        onReconnect={reconnect}
      />

      <section className="content">
        <Topbar syncing={syncing} onSync={handleSyncLiveData} />

        {!connected && (
          <div className="offline-banner">
            <span>!</span>
            <div>
              <strong>Backend chưa kết nối</strong>
              <small>
                Hãy chắc chắn Backend đang chạy và kết nối được Mosquitto.
              </small>
            </div>
            <button onClick={reconnect}>Reconnect</button>
          </div>
        )}

        <GardenOverview
          zones={zones}
          activeZone={activeZone}
          view={view}
          connected={connected}
          onSelectZone={setActiveZone}
          onChangeView={setView}
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
        />

        <HistoryChart
          backendUrl={BACKEND_URL}
          deviceId={deviceId}
          zones={zones}
          activeZone={activeZone}
          onSelectZone={setActiveZone}
          connected={connected}
        />

        <MetricsOverview
          temperature={temperature}
          humidity={humidity}
          pumpOn={pumpOn}
          mode={mode}
          selectedZone={selectedZone}
        />

        <ActivityAndZones
          logs={logs}
          visibleZones={zones}
          activeZone={activeZone}
          onClearLogs={() => setLogs([])}
          onSelectZone={setActiveZone}
        />
      </section>
    </main>
  );
}
