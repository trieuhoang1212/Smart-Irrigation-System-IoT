"use client";

import { useState, useEffect, useCallback } from "react";
import { initialZones, plantGroups } from "./garden-data";
import { useMqtt } from "./hooks/useMqtt";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { GardenOverview } from "./components/GardenOverview";
import { ControlPanel } from "./components/ControlPanel";
import { MetricsOverview } from "./components/MetricsOverview";
import { ActivityAndZones } from "./components/ActivityAndZones";

const TOPIC_STATUS = "smart-irrigation/status";
const TOPIC_CMD = "smart-irrigation/cmd";
const MQTT_URL = process.env.NEXT_PUBLIC_MQTT_URL ?? "ws://localhost:9001";
const MAX_LOGS = 50;

export default function App() {
  const [logs, setLogs] = useState<string[]>([
    "Mosquitto Broker: ws://localhost:9001",
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
    brokerUrl: MQTT_URL,
    statusTopic: TOPIC_STATUS,
    cmdTopic: TOPIC_CMD,
    initialZones,
    onLog: appendLog,
  });

  const selectedZone = zones.find((zone) => zone.id === activeZone) ?? zones[0];

  // Giả lập lưu lượng nước tưới khi bơm bật
  useEffect(() => {
    if (!pumpOn || !selectedZone.online) return;

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
    pumpOn,
    selectedZone.id,
    selectedZone.name,
    selectedZone.online,
    selectedZone.flowLitersPerHour,
    selectedZone.targetLiters,
    sendCommand,
    setPumpOn,
    appendLog,
  ]);

  const handleTogglePump = () => {
    const nextState = togglePump(selectedZone.id);
    if (nextState) setWateredLiters(0);
  };

  const handleToggleIrrigation = () => {
    if (!connected) {
      appendLog("Mất kết nối thiết bị!");
      return;
    }
    changeMode("manual");
    handleTogglePump();
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
              <strong>Mosquitto Broker chưa kết nối</strong>
              <small>
                Hãy chắc chắn Mosquitto đang chạy trên cổng WebSocket 9001.
              </small>
            </div>
            <button onClick={reconnect}>Reconnect</button>
          </div>
        )}

        <GardenOverview
          zones={zones}
          activeZone={activeZone}
          view={view}
          pumpOn={pumpOn}
          connected={connected}
          onSelectZone={setActiveZone}
          onChangeView={setView}
          onToggleIrrigation={handleToggleIrrigation}
        />

        <ControlPanel
          mode={mode}
          pumpOn={pumpOn}
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
