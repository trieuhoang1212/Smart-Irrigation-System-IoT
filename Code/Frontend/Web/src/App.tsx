"use client";

import { useState, useEffect, useCallback } from "react";
import { initialZones } from "./garden-data";
import { useMqtt } from "./hooks/useMqtt";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { GardenOverview } from "./components/GardenOverview";
import { ControlPanel } from "./components/ControlPanel";
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
  const [wateredLiters, setWateredLiters] = useState(0);

  const appendLog = useCallback((message: string) => {
    setLogs((current) => [message, ...current].slice(0, MAX_LOGS));
  }, []);

  const {
    zones,
    connected,
    mode,
    pumpOn,
    setPumpOn,
    temperature,
    humidity,
    rainPercent,
    raining,
    rainBlock,
    lastUpdated,
    sendCommand,
    togglePump,
    changeMode,
    toggleWeatherGate,
    reconnect,
    setZoneThreshold,
  } = useMqtt({
    backendUrl: BACKEND_URL,
    initialZones,
    onLog: appendLog,
  });

  const selectedZone = zones.find((zone) => zone.id === activeZone) ?? zones[0];

  // Giả lập lưu lượng nước tưới khi bơm bật
  useEffect(() => {
    if (!selectedZone.pump || !selectedZone.online) return;

    const timer = window.setInterval(() => {
      setWateredLiters((current) => {
        const next = Math.min(
          current + selectedZone.flowLitersPerHour / 3600,
          selectedZone.targetLiters,
        );
        if (next >= selectedZone.targetLiters && connected) {
          sendCommand(`PUMP_OFF_${selectedZone.id}`);
          setPumpOn(false);
          appendLog(
            `Đã đủ ${selectedZone.targetLiters.toFixed(2)} L cho ${selectedZone.name}`,
          );
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    connected,
    selectedZone.pump,
    selectedZone.id,
    selectedZone.name,
    selectedZone.online,
    selectedZone.flowLitersPerHour,
    selectedZone.targetLiters,
    sendCommand,
    setPumpOn,
    appendLog,
  ]);

  const handleTogglePump = async () => {
    if (!connected) {
      appendLog("Mất kết nối thiết bị!");
      return;
    }
    if (mode === "auto") await changeMode("manual");
    const nextState = togglePump(selectedZone.id);
    if (nextState) setWateredLiters(0);
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

  const leafyZone = zones.find((z) => z.id === "T002");

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
          wateredLiters={wateredLiters}
          onChangeMode={changeMode}
          onTogglePump={handleTogglePump}
          onChangeThreshold={(val) => setZoneThreshold(activeZone, val)}
          onToggleWeatherGate={toggleWeatherGate}
        />

        <MetricsOverview
          temperature={temperature}
          humidity={humidity}
          pumpOn={pumpOn}
          mode={mode}
          leafyMoisture={leafyZone?.moisture ?? 0}
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
