"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import mqtt from "mqtt";
import { GardenMap } from "./components/GardenMap";
import {
  initialZones,
  plantGroups,
} from "./garden-data";

const TOPIC_STATUS = "smart-irrigation/status";
const TOPIC_CMD = "smart-irrigation/cmd";
const MQTT_URL = process.env.NEXT_PUBLIC_MQTT_URL ?? "ws://localhost:9001";
const MAX_LOGS = 50;

function Icon({ children }: { children: string }) {
  return (
    <span className="icon" aria-hidden="true">
      {children}
    </span>
  );
}

function App() {
  const [zones, setZones] = useState(initialZones);
  const [activeZone, setActiveZone] = useState("T002"); // T002 (cải xanh) đại diện zone ESP32
  const [activeGroup, setActiveGroup] = useState<(typeof plantGroups)[number]>(
    "Rau ăn lá",
  );
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [pumpOn, setPumpOn] = useState(false);
  const [temperature, setTemperature] = useState(25.0);
  const [humidity, setHumidity] = useState(65.0);
  const [rainPercent, setRainPercent] = useState(0);
  const [raining, setRaining] = useState(false);
  const [rainBlock, setRainBlock] = useState(true);
  const [view, setView] = useState<"2d" | "map">("2d");
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("Chưa kết nối");
  const [logs, setLogs] = useState<string[]>([
    "Mosquitto Broker: ws://localhost:9001",
    "Chờ nhận dữ liệu từ ESP32 Wokwi...",
  ]);
  const [wateredLiters, setWateredLiters] = useState(0);

  const clientRef = useRef<ReturnType<typeof mqtt.connect> | null>(null);
  const selectedZone = zones.find((zone) => zone.id === activeZone) ?? zones[0];
  const visibleZones = zones.filter((zone) => zone.group === activeGroup);
  const appendLog = useCallback((message: string) => {
    setLogs((current) => [message, ...current].slice(0, MAX_LOGS));
  }, []);

  // ================= KẾT NỐI MQTT MOSQUITTO =================
  useEffect(() => {
    let disposed = false;

    // Kết nối Mosquitto qua WebSockets cổng 9001
    const client = mqtt.connect(MQTT_URL, {
      reconnectPeriod: 2000,
    });
    clientRef.current = client;

    client.on("connect", () => {
      if (disposed || clientRef.current !== client) return;

      setConnected(true);
      setZones((current) =>
        current.map((zone) =>
          zone.id === "T002" ? { ...zone, online: true } : zone,
        ),
      );
      setLastUpdated("Vừa kết nối");
      appendLog("Web đã kết nối Mosquitto Broker thành công!");
      client.subscribe(TOPIC_STATUS);
    });

    client.on("message", (topic, message) => {
      if (topic === TOPIC_STATUS) {
        try {
          const data = JSON.parse(message.toString());
          // data format: { moisture, temperature, humidity, pump, mode }
          if (data.moisture !== undefined && Number.isFinite(Number(data.moisture))) {
            setZones((current) =>
              current.map((z) =>
                z.id === "T002"
                  ? {
                      ...z,
                      moisture: Math.max(0, Math.min(100, Number(data.moisture))),
                      online: true,
                    }
                  : z,
              ),
            );
          }
          if (Array.isArray(data.zones)) {
            const liveZoneIds: Record<string, string> = {
              leafy: "T002",
              fruiting: "T007",
              root: "T013",
              ornamental: "T019",
            };
            setZones((current) =>
              current.map((zone) => {
                const live = data.zones.find(
                  (item: { id?: string }) => liveZoneIds[item.id ?? ""] === zone.id,
                );
                return live
                  ? {
                      ...zone,
                      moisture: Math.max(
                        0,
                        Math.min(100, Number(live.moisture)),
                      ),
                      online: true,
                    }
                  : zone;
              }),
            );
          }
          if (data.temperature !== undefined && Number.isFinite(Number(data.temperature)))
            setTemperature(Number(data.temperature));
          if (data.humidity !== undefined && Number.isFinite(Number(data.humidity)))
            setHumidity(Math.max(0, Math.min(100, Number(data.humidity))));
          if (data.rain !== undefined && Number.isFinite(Number(data.rain)))
            setRainPercent(Math.max(0, Math.min(100, Number(data.rain))));
          if (data.raining !== undefined) setRaining(Boolean(data.raining));
          if (data.weatherGate !== undefined)
            setRainBlock(Boolean(data.weatherGate));
          if (data.pump !== undefined) setPumpOn(Boolean(data.pump));
          if (data.mode !== undefined)
            setMode(data.mode === "auto" ? "auto" : "manual");

          const time = new Date().toLocaleTimeString();
          setLastUpdated(time);
        } catch (e) {
          console.error("Lỗi phân tích JSON từ MQTT:", e);
        }
      }
    });

    client.on("close", () => {
      setConnected(false);
      setZones((current) =>
        current.map((zone) =>
          zone.id === "T002" ? { ...zone, online: false } : zone,
        ),
      );
    });

    client.on("error", (err) => {
      console.error("Mosquitto error:", err);
      setConnected(false);
    });

    return () => {
      disposed = true;
      if (clientRef.current === client) {
        clientRef.current = null;
      }
      client.end();
    };
  }, [appendLog]);

  useEffect(() => {
    if (!pumpOn || !selectedZone.online) return;

    const timer = window.setInterval(() => {
      setWateredLiters((current) => {
        const next = Math.min(
          current + selectedZone.flowLitersPerHour / 3600,
          selectedZone.targetLiters,
        );
        if (
          next >= selectedZone.targetLiters &&
          clientRef.current &&
          connected
        ) {
          clientRef.current.publish(TOPIC_CMD, "PUMP_OFF");
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
    appendLog,
  ]);

  // ================= ĐIỀU KHIỂN BƠM =================
  const togglePump = () => {
    if (!connected || !clientRef.current) {
      appendLog("Không thể điều khiển khi mất kết nối MQTT");
      return;
    }
    const nextState = !pumpOn;
    setPumpOn(nextState);
    if (nextState) setWateredLiters(0);
    const cmd = nextState ? "PUMP_ON" : "PUMP_OFF";
    clientRef.current.publish(TOPIC_CMD, cmd);
    appendLog(
      `Gửi lệnh: ${cmd} (${mode === "manual" ? "Thủ công" : "Bảng điều khiển"})`,
    );
  };

  // ================= ĐỔI CHẾ ĐỘ =================
  const changeMode = (newMode: "auto" | "manual") => {
    setMode(newMode);
    if (clientRef.current && connected) {
      const cmd = newMode === "auto" ? "MODE_AUTO" : "MODE_MANUAL";
      clientRef.current.publish(TOPIC_CMD, cmd);
      appendLog(`Chuyển sang chế độ: ${newMode.toUpperCase()}`);
    }
  };

  const toggleWeatherGate = (enabled: boolean) => {
    setRainBlock(enabled);
    if (!connected || !clientRef.current) {
      appendLog(
        "Đã đổi giao diện nhưng chưa gửi được weather gate vì mất kết nối MQTT",
      );
      return;
    }

    const command = enabled ? "WEATHER_GATE_ON" : "WEATHER_GATE_OFF";
    clientRef.current.publish(TOPIC_CMD, command);
    appendLog(`${enabled ? "Bật" : "Tắt"} bảo vệ khi mưa`);
  };

  const toggleIrrigation = () => {
    if (!connected || !clientRef.current) {
      appendLog("Mất kết nối thiết bị!");
      return;
    }
    changeMode("manual");
    togglePump();
  };

  const syncLiveData = () => {
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

  const reconnectMqtt = () => {
    clientRef.current?.reconnect();
    appendLog("Đang yêu cầu kết nối lại Mosquitto...");
  };

  const changeThreshold = (value: number) => {
    setZones((current) =>
      current.map((zone) =>
        zone.id === activeZone ? { ...zone, threshold: value } : zone,
      ),
    );
    appendLog(`Đổi ngưỡng tưới ${activeZone} thành ${value}%`);
  };

  const selectGroup = (group: (typeof plantGroups)[number]) => {
    setActiveGroup(group);
    const firstZone = zones.find((zone) => zone.group === group);
    if (firstZone) setActiveZone(firstZone.id);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <span>
            Green<span>flow</span>
          </span>
        </div>
        <nav>
          <p className="nav-label">WORKSPACE</p>
          <button className="nav-item active">
            <Icon>⌂</Icon>Overview
          </button>
          <button className="nav-item">
            <Icon>▦</Icon>Garden layout
          </button>
          <button className="nav-item">
            <Icon>⌁</Icon>Live sensors
          </button>
          <button className="nav-item">
            <Icon>◴</Icon>Automation
          </button>
          <p className="nav-label second">SYSTEM</p>
          <button className="nav-item" onClick={reconnectMqtt}>
            <Icon>◉</Icon>Mosquitto MQTT{" "}
            <span className={`nav-status ${connected ? "" : "offline"}`} />
          </button>
          <button className="nav-item">
            <Icon>⚙</Icon>Settings
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card">
            <div className="connection-title">
              <span className={`pulse ${connected ? "" : "off"}`} />{" "}
              {connected ? "Mosquitto Connected" : "Mosquitto Offline"}
            </div>
            <small>ESP32 · Cập nhật: {lastUpdated}</small>
            <button onClick={reconnectMqtt}>
              {connected ? "Connected" : "Reconnect"}
            </button>
          </div>
          <div className="profile">
            <div className="avatar">AT</div>
            <div>
              <strong>Anna Tran</strong>
              <small>Garden owner</small>
            </div>
            <span>•••</span>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">✦</span> Greenflow
          </div>
          <div className="top-actions">
            <button className="icon-button">⌕</button>
            <button className="icon-button notification">
              ♢<i />
            </button>
            <div className="mini-avatar">AT</div>
          </div>
        </header>
        <div className="page-heading">
          <div>
            <p className="eyebrow">HỆ THỐNG TƯỚI TỰ ĐỘNG THÔNG MINH</p>
            <h1>
              Dashboard Giám Sát Realtime <span>✦</span>
            </h1>
            <p className="subtitle">
              Kết nối trực tiếp ESP32 Wokwi qua Mosquitto MQTT Broker.
            </p>
          </div>
          <button
            className="sync-button"
            onClick={syncLiveData}
            disabled={syncing}
          >
            <span>↻</span> {syncing ? "Syncing..." : "Sync live data"}
          </button>
        </div>
        {!connected && (
          <div className="offline-banner">
            <span>!</span>
            <div>
              <strong>Mosquitto Broker chưa kết nối</strong>
              <small>
                Hãy chắc chắn Mosquitto đang chạy trên cổng WebSocket 9001.
              </small>
            </div>
            <button onClick={reconnectMqtt}>Reconnect</button>
          </div>
        )}

        <section className="garden-panel panel">
          <div className="panel-heading">
            <div>
              <h2>Garden overview</h2>
              <p>
                Vùng <strong>T002</strong> được liên kết trực tiếp với cảm biến
                ESP32
              </p>
            </div>
            <div className="view-switch">
              <button
                className={view === "2d" ? "selected" : ""}
                onClick={() => setView("2d")}
              >
                2D view
              </button>
              <button
                className={view === "map" ? "selected" : ""}
                onClick={() => setView("map")}
              >
                Map
              </button>
            </div>
          </div>
          <div className="garden-tabs" role="tablist" aria-label="Nhóm cây trồng">
            {plantGroups.map((group) => (
              <button
                key={group}
                className={activeGroup === group ? "selected" : ""}
                onClick={() => selectGroup(group)}
                role="tab"
                aria-selected={activeGroup === group}
              >
                {group}
                <small>
                  {zones.filter((zone) => zone.group === group).length} loại
                </small>
              </button>
            ))}
          </div>
          <div className="group-caption">
            <strong>{activeGroup}</strong>
            <span>
              {visibleZones.length} khu vực riêng · Mỗi loại cây có ngưỡng tưới
              độc lập
            </span>
          </div>
          <GardenMap
            zones={visibleZones}
            activeZone={activeZone}
            onSelect={setActiveZone}
            view={view}
          />
          <div className="selected-zone">
            <div className="zone-title">
              <span className="status-dot" /> <strong>{selectedZone.id}</strong>{" "}
              · {selectedZone.name}
              <small>{selectedZone.crop}</small>
            </div>
            <div className="zone-stat">
              <span>Độ ẩm đất</span>
              <strong>{selectedZone.moisture}%</strong>
              <div className="progress">
                <i style={{ width: `${selectedZone.moisture}%` }} />
              </div>
            </div>
            <div className="zone-stat">
              <span>Ngưỡng kích hoạt</span>
              <strong>
                {selectedZone.threshold}%{" "}
                <em>
                  {selectedZone.moisture < selectedZone.threshold
                    ? "Cần tưới nước"
                    : "Độ ẩm tốt"}
                </em>
              </strong>
            </div>
            <button
              className={`water-button ${pumpOn ? "watering" : ""}`}
              onClick={toggleIrrigation}
              disabled={!connected}
              title={connected ? "Tưới khu vực đang chọn" : "Cần kết nối MQTT"}
            >
              {pumpOn ? "◌ Bơm đang chạy..." : "♧ Tưới khu vực này"}
            </button>
          </div>
        </section>

        <section className="control-grid">
          <article className="panel control-card">
            <div className="panel-heading">
              <div>
                <h2>Điều khiển Bơm</h2>
                <p>Tự động theo thuật toán Hysteresis (40% - 60%)</p>
              </div>
              <span className={`live-badge ${pumpOn ? "active" : ""}`}>
                <i /> {pumpOn ? "Máy bơm ĐANG BẬT" : "Máy bơm ĐANG TẮT"}
              </span>
            </div>
            <div className="mode-row">
              <span>Chế độ vận hành</span>
              <div className="mode-switch">
                <button
                  className={mode === "auto" ? "selected" : ""}
                  onClick={() => changeMode("auto")}
                >
                  Automatic
                </button>
                <button
                  className={mode === "manual" ? "selected" : ""}
                  onClick={() => changeMode("manual")}
                >
                  Manual
                </button>
              </div>
            </div>
            <div className="control-row">
              <div>
                <strong>
                  {mode === "auto"
                    ? "Chế độ Tự động (Auto)"
                    : "Chế độ Thủ công (Manual)"}
                </strong>
                <small>
                  {mode === "auto"
                    ? `ESP32 tự bật khi < 40%, tắt khi > 60%`
                    : "Bạn có thể bật/tắt bơm tự do bằng công tắc bên cạnh"}
                </small>
              </div>
              <button
                aria-label="Toggle pump"
                className={`big-toggle ${pumpOn ? "on" : ""}`}
                onClick={togglePump}
              >
                <i />
              </button>
            </div>
            <div className="threshold-control">
              <label htmlFor="threshold">
                Ngưỡng đất khô <strong>{selectedZone.threshold}%</strong>
              </label>
              <input
                id="threshold"
                type="range"
                min="20"
                max="80"
                value={selectedZone.threshold}
                onChange={(event) =>
                  changeThreshold(Number(event.target.value))
                }
              />
              <div>
                <span>20% Khô</span>
                <span>80% Ẩm</span>
              </div>
            </div>
          </article>
          <article className="panel weather-card">
            <div className="panel-heading">
              <div>
                <h2>Cảm biến DHT22</h2>
                <p>Nhiệt độ & Độ ẩm môi trường</p>
              </div>
              <span className="weather-icon">⛅</span>
            </div>
            <div className="weather-main">
              <strong>{temperature}°</strong>
              <span>°C · {humidity}% độ ẩm</span>
            </div>
            <div className="weather-details">
              <span>
                <b>☁</b> Trạng thái
              </span>
              <strong>
                {raining
                  ? `Đang mưa (${rainPercent}%)`
                  : temperature > 32
                    ? "Nắng nóng"
                    : "Ổn định"}
              </strong>
            </div>
            <div className="weather-details">
              <span>
                <b>☂</b> Cảm biến mưa
              </span>
              <strong>{rainPercent}%</strong>
            </div>
            <div className="weather-details">
              <span>
                <b>≋</b> MQTT Topic
              </span>
              <strong>smart-irrigation/status</strong>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={rainBlock}
                onChange={(event) => toggleWeatherGate(event.target.checked)}
              />
              <span>Hoãn tưới nếu có mưa</span>
            </label>
            <div className="weather-alert">
              {rainBlock
                ? "● Đang bật bảo vệ thời tiết"
                : "○ Weather gate đang tắt"}
            </div>
          </article>
          <article className="panel profile-card">
            <div className="panel-heading">
              <div>
                <h2>Hồ sơ cây trồng</h2>
                <p>Khuyến nghị cho {selectedZone.name}</p>
              </div>
              <button className="dots">•••</button>
            </div>
            <div className="plant-name">
              <span className="plant-emoji">🌿</span>
              <div>
                <strong>{selectedZone.name}</strong>
                <small>Nhu cầu nước: trung bình</small>
              </div>
            </div>
            <div className="profile-line">
              <span>Phương pháp</span>
              <strong>{selectedZone.method}</strong>
            </div>
            <div className="profile-line">
              <span>Thời lượng mỗi lần</span>
              <strong>{selectedZone.duration} phút</strong>
            </div>
            <div className="recommendation">
              ✦{" "}
              <span>
                {selectedZone.group}: bật dưới {selectedZone.threshold}%,
                dừng ở {selectedZone.stopThreshold}%. Chu kỳ{" "}
                {selectedZone.pumpSeconds}s, khoảng{" "}
                {selectedZone.flowLitersPerHour} L/giờ.
              </span>
            </div>
            <div className="water-progress-detail">
              <span>Lượng nước chu kỳ</span>
              <strong>
                {wateredLiters.toFixed(2)} /{" "}
                {selectedZone.targetLiters.toFixed(2)} L
              </strong>
              <div className="progress">
                <i
                  style={{
                    width: `${Math.min(
                      (wateredLiters / selectedZone.targetLiters) * 100,
                      100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </article>
        </section>

        <div className="section-title">
          <h2>Thông số thời gian thực</h2>
          <button className="link-button">Chi tiết cảm biến →</button>
        </div>
        <section className="metrics-grid">
          <article className="metric-card">
            <div className="metric-icon orange">☼</div>
            <span>Nhiệt độ không khí</span>
            <strong>
              {temperature}°<small>C</small>
            </strong>
            <p>Đọc từ DHT22 ESP32</p>
          </article>
          <article className="metric-card">
            <div className="metric-icon blue">≋</div>
            <span>Độ ẩm không khí</span>
            <strong>
              {humidity}% <small className="good">● DHT22</small>
            </strong>
            <p>Thời tiết nhà vườn</p>
          </article>
          <article className="metric-card">
            <div className="metric-icon green">♧</div>
            <span>Độ ẩm đất (Zone T002 - Cải xanh)</span>
            <strong>
              {zones.find((z) => z.id === "T002")?.moisture}%{" "}
              <small className={pumpOn ? "good" : "warning"}>
                {pumpOn ? "● Đang tưới" : "● Bình thường"}
              </small>
            </strong>
            <p>Đọc từ biến trở đất (GPIO 34)</p>
          </article>
          <article className="metric-card resource-card">
            <div className="resource-row">
              <span>
                <b className="resource-icon blue">♒</b> Trạng thái Rơ-le
              </span>
              <strong>{pumpOn ? "BẬT (Active)" : "TẮT (Idle)"}</strong>
            </div>
            <div className="resource-progress">
              <i
                className="blue-fill"
                style={{ width: pumpOn ? "100%" : "0%" }}
              />
            </div>
            <div className="resource-row">
              <span>
                <b className="resource-icon purple">✥</b> Góc mở van Servo
              </span>
              <strong>{pumpOn ? "90 độ" : "0 độ"}</strong>
            </div>
            <div className="resource-progress">
              <i
                className="purple-fill"
                style={{ width: pumpOn ? "100%" : "0%" }}
              />
            </div>
          </article>
          <article className="metric-card resource-card">
            <div className="resource-row">
              <span>
                <b className="resource-icon pink">✿</b> Chế độ tưới
              </span>
              <strong>{mode.toUpperCase()}</strong>
            </div>
            <div className="resource-progress">
              <i className="pink-fill" />
            </div>
            <div className="resource-row">
              <span>
                <b className="resource-icon orange">◌</b> Cổng WebSocket
              </span>
              <strong>9001 (Mosquitto)</strong>
            </div>
            <div className="resource-progress">
              <i className="orange-fill" />
            </div>
          </article>
        </section>

        <section className="below-grid">
          <article className="panel activity-card">
            <div className="panel-heading">
              <div>
                <h2>Nhật ký MQTT Events</h2>
                <p>Lịch sử truyền nhận dữ liệu</p>
              </div>
              <button className="link-button" onClick={() => setLogs([])}>
                Xóa log
              </button>
            </div>
            <div className="activity-list">
              {logs.length ? (
                logs.slice(0, 5).map((log, index) => (
                  <div className="activity-item" key={index}>
                    <i />
                    {log}
                  </div>
                ))
              ) : (
                <div className="empty-state">Chưa có sự kiện mới.</div>
              )}
            </div>
          </article>
          <article className="panel zone-summary">
            <div className="panel-heading">
              <div>
                <h2>Tình trạng các khu vực</h2>
                <p>Chỉ số độ ẩm đất toàn vườn</p>
              </div>
              <span className="healthy-count">
                {visibleZones.filter((zone) => zone.online && zone.moisture >= zone.threshold).length}/
                {visibleZones.filter((zone) => zone.online).length} Đạt chuẩn
              </span>
            </div>
            {visibleZones.map((zone) => (
              <button
                className="zone-row"
                key={zone.id}
                onClick={() => setActiveZone(zone.id)}
              >
                <span
                  className="zone-color"
                  style={{ background: zone.color }}
                />
                <strong>{zone.id}</strong>
                <span>{zone.name}</span>
                <small className={zone.online ? "zone-live" : "zone-offline"}>
                  {zone.online ? "LIVE" : "Chưa kết nối"}
                </small>
                <div className="mini-bar">
                  <i style={{ width: `${zone.moisture}%` }} />
                </div>
                <b className={zone.moisture < zone.threshold ? "dry" : ""}>
                  {zone.online ? `${zone.moisture}%` : "--"}
                </b>
              </button>
            ))}
          </article>
        </section>
      </section>
    </main>
  );
}

export default App;
