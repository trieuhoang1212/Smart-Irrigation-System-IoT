"use client";

import React from "react";
import { type Zone } from "../garden-data";

interface ControlPanelProps {
  mode: "auto" | "manual";
  selectedZone: Zone;
  temperature: number | null;
  humidity: number | null;
  raining: boolean;
  rainPercent: number | null;
  rainBlock: boolean;
  wateredLiters: number;
  onChangeMode: (mode: "auto" | "manual") => void;
  onTogglePump: () => void;
  onChangeThreshold: (val: number) => void;
  onToggleWeatherGate: (enabled: boolean) => void;
}

export function ControlPanel({
  mode,
  selectedZone,
  temperature,
  humidity,
  raining,
  rainPercent,
  rainBlock,
  wateredLiters,
  onChangeMode,
  onTogglePump,
  onChangeThreshold,
  onToggleWeatherGate,
}: ControlPanelProps) {
  return (
    <section className="control-grid">
      {/* 1. ĐIỀU KHIỂN BƠM */}
      <article className="panel control-card">
        <div className="panel-heading">
          <div>
            <h2>Điều khiển Bơm</h2>
            <p>Tự động theo thuật toán Hysteresis (40% - 60%)</p>
          </div>
          <span className={`live-badge ${selectedZone.pump ? "active" : ""}`}>
            <i />{" "}
            {selectedZone.pump
              ? `${selectedZone.name} đang tưới`
              : "Máy bơm đang tắt"}
          </span>
        </div>
        <div className="mode-row">
          <span>Chế độ vận hành</span>
          <div className="mode-switch">
            <button
              className={mode === "auto" ? "selected" : ""}
              onClick={() => onChangeMode("auto")}
            >
              Automatic
            </button>
            <button
              className={mode === "manual" ? "selected" : ""}
              onClick={() => onChangeMode("manual")}
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
            className={`big-toggle ${selectedZone.pump ? "on" : ""}`}
            onClick={onTogglePump}
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
              onChangeThreshold(Number(event.target.value))
            }
          />
          <div>
            <span>20% Khô</span>
            <span>80% Ẩm</span>
          </div>
        </div>
      </article>

      {/* 2. CẢM BIẾN DHT22 & MƯA */}
      <article className="panel weather-card">
        <div className="panel-heading">
          <div>
            <h2>Cảm biến DHT22</h2>
            <p>Nhiệt độ & Độ ẩm môi trường</p>
          </div>
          <span className="weather-icon">⛅</span>
        </div>
        <div className="weather-main">
          <strong>{temperature === null ? "--" : `${temperature}°`}</strong>
          <span>°C · {humidity === null ? "--" : `${humidity}%`} độ ẩm</span>
        </div>
        <div className="weather-details">
          <span>
            <b>☁</b> Trạng thái
          </span>
          <strong>
            {raining
              ? `Đang mưa (${rainPercent}%)`
              : temperature !== null && temperature > 32
                ? "Nắng nóng"
                : "Ổn định"}
          </strong>
        </div>
        <div className="weather-details">
          <span>
            <b>☂</b> Cảm biến mưa
          </span>
          <strong>{rainPercent === null ? "--" : `${rainPercent}%`}</strong>
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
            onChange={(event) => onToggleWeatherGate(event.target.checked)}
          />
          <span>Hoãn tưới nếu có mưa</span>
        </label>
        <div className="weather-alert">
          {rainBlock
            ? "● Đang bật bảo vệ thời tiết"
            : "○ Weather gate đang tắt"}
        </div>
      </article>

      {/* 3. HỒ SƠ CÂY TRỒNG */}
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
  );
}
