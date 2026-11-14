"use client";

import { type Zone } from "../garden-data";
import type { ZoneConfigInput } from "../hooks/useMqtt";
import type { WateringRunSummary } from "../lib/garden-api";
import { ZoneConfigCard } from "./ZoneConfigCard";
import { CloudIcon, DropletIcon, RainIcon, ThermometerIcon } from "./icons";

interface ControlPanelProps {
  mode: "auto" | "manual";
  selectedZone: Zone;
  temperature: number | null;
  humidity: number | null;
  raining: boolean;
  rainPercent: number | null;
  rainBlock: boolean;
  wateredLiters: number;
  lastRun: WateringRunSummary | null;
  todayLiters: number;
  todayRuns: number;
  wateringLoaded: boolean;
  tankDistanceCm: number | null;
  tankEmpty: boolean;
  controlsEnabled: boolean;
  onChangeMode: (mode: "auto" | "manual") => Promise<boolean>;
  onTogglePump: () => void;
  onChangeThreshold: (val: number) => void;
  onToggleWeatherGate: (enabled: boolean) => void;
  onSaveZoneConfig: (input: ZoneConfigInput) => Promise<boolean>;
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
  lastRun,
  todayLiters,
  todayRuns,
  wateringLoaded,
  tankDistanceCm,
  tankEmpty,
  controlsEnabled,
  onChangeMode,
  onTogglePump,
  onChangeThreshold,
  onToggleWeatherGate,
  onSaveZoneConfig,
}: ControlPanelProps) {
  const tankLevel =
    tankDistanceCm === null ? null : Math.min(Math.max(tankDistanceCm, 0), 100);
  const offlineReason = "ESP32 đang offline nên lệnh chưa gửi được";

  return (
    <section className="control-grid">
      <article className="panel control-card">
        <div className="panel-heading">
          <div>
            <h2>Điều khiển bơm</h2>
            <p>
              Ngưỡng tưới {selectedZone.threshold}% · dừng ở {selectedZone.stopThreshold}%
            </p>
          </div>
          <span className={`live-badge ${selectedZone.pump ? "active" : ""}`}>
            <i />
            {selectedZone.pump ? "Đang tưới" : "Bơm đang tắt"}
          </span>
        </div>

        <div className="mode-row">
          <span>Chế độ vận hành</span>
          <div className="mode-switch">
            <button
              type="button"
              className={mode === "auto" ? "selected" : ""}
              aria-pressed={mode === "auto"}
              onClick={() => void onChangeMode("auto")}
              disabled={!controlsEnabled}
              title={controlsEnabled ? undefined : offlineReason}
            >
              Tự động
            </button>
            <button
              type="button"
              className={mode === "manual" ? "selected" : ""}
              aria-pressed={mode === "manual"}
              onClick={() => void onChangeMode("manual")}
              disabled={!controlsEnabled}
              title={controlsEnabled ? undefined : offlineReason}
            >
              Thủ công
            </button>
          </div>
        </div>

        {mode === "manual" && (
          <div className="mode-warning">
            <span>
              Đang ở chế độ Thủ công: ESP32 không tự tưới, lịch tự động tạm dừng cho cả
              vườn.
            </span>
            <button
              type="button"
              onClick={() => void onChangeMode("auto")}
              disabled={!controlsEnabled}
            >
              Quay lại Tự động
            </button>
          </div>
        )}

        {mode === "manual" && selectedZone.overTarget && (
          <div className="mode-warning overwater" role="status">
            <span>
              {selectedZone.id} đã vượt mục tiêu {selectedZone.targetLiters} L — tắt bơm
              nếu đất đã đủ ẩm. Sau 10 phút hệ thống tự về Tự động.
            </span>
          </div>
        )}

        <div className="control-row">
          <div>
            <strong>
              {!controlsEnabled
                ? "ESP32 đang offline"
                : mode === "auto"
                  ? "ESP32 tự quyết định"
                  : "Điều khiển bằng tay"}
            </strong>
            <small>
              {!controlsEnabled
                ? "Dữ liệu bên dưới là lần đo cuối; bơm không nhận lệnh mới."
                : tankEmpty
                  ? "Bồn nước đã cạn — bơm bị chặn để tránh chạy khô"
                  : mode === "auto"
                    ? `Bật khi độ ẩm < ${selectedZone.threshold}%, tắt khi > ${selectedZone.stopThreshold}% · chuyển Thủ công để bấm tay`
                    : "Công tắc gửi lệnh PUMP_ON/OFF tới khu vực đang chọn"}
            </small>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={selectedZone.pump}
            aria-label="Bật tắt bơm khu vực đang chọn"
            className={`big-toggle ${selectedZone.pump ? "on" : ""}`}
            onClick={onTogglePump}
            disabled={tankEmpty || !controlsEnabled || mode === "auto"}
            title={
              tankEmpty
                ? "Bồn nước đã cạn nên bơm bị chặn"
                : !controlsEnabled
                  ? offlineReason
                  : mode === "auto"
                    ? "Chế độ Tự động do ESP32 quyết định — chuyển sang Thủ công để bật/tắt bơm"
                    : undefined
            }
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
            min="10"
            max="90"
            value={selectedZone.threshold}
            onChange={(event) => onChangeThreshold(Number(event.target.value))}
            disabled={!controlsEnabled}
            title={controlsEnabled ? undefined : offlineReason}
          />
          <div>
            <span>10% · khô</span>
            <span>90% · ẩm</span>
          </div>
        </div>

        {!controlsEnabled && (
          <p className="control-note">
            ESP32 đang offline — công tắc bơm, chế độ và ngưỡng tạm khoá. Phần cấu hình
            vùng bên dưới vẫn lưu được vào Backend.
          </p>
        )}
      </article>

      <article className={`panel weather-card ${raining ? "raining" : ""}`}>
        <div className="panel-heading">
          <div>
            <h2>Cảm biến DHT22</h2>
            <p>Nhiệt độ và độ ẩm không khí</p>
          </div>
          <span className="card-icon">
            <ThermometerIcon size={18} />
          </span>
        </div>

        <div className="weather-main">
          <strong>{temperature === null ? "--" : `${temperature}°`}</strong>
          <span>°C · {humidity === null ? "--" : `${humidity}%`} độ ẩm</span>
        </div>

        <div className="weather-details">
          <span>
            <CloudIcon size={15} /> Trạng thái
          </span>
          <strong>
            {raining
              ? `Đang mưa (${rainPercent === null ? "--" : `${rainPercent}%`})`
              : rainPercent !== null && rainPercent >= 80
                ? `Có thể mưa (${rainPercent}%)`
                : temperature !== null && temperature > 32
                  ? "Nắng nóng"
                  : "Ổn định"}
          </strong>
        </div>
        <div className="weather-details">
          <span>
            <DropletIcon size={15} /> Độ ẩm không khí
          </span>
          <strong>{humidity === null ? "--" : `${humidity}%`}</strong>
        </div>
        <div className="weather-details">
          <span>
            <RainIcon size={15} /> Cảm biến mưa
          </span>
          <strong>{rainPercent === null ? "--" : `${rainPercent}%`}</strong>
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={rainBlock}
            onChange={(event) => onToggleWeatherGate(event.target.checked)}
            disabled={!controlsEnabled}
          />
          <span>Hoãn tưới khi có mưa</span>
        </label>
        <div className={`weather-alert ${rainBlock ? "" : "off"}`}>
          {rainBlock ? "Đang bật bảo vệ thời tiết" : "Weather gate đang tắt"}
        </div>
        {!raining && rainPercent !== null && rainPercent >= 80 && (
          <div className="weather-alert warn" role="status">
            Có thể mưa ({rainPercent}%): còi đã báo, hệ thống vẫn tưới. Ở 100% bơm sẽ
            dừng nếu đang bật hoãn mưa.
          </div>
        )}
      </article>

      <article className="panel tank-card">
        <div className="panel-heading">
          <div>
            <h2>Bồn nước</h2>
            <p>HC-SR04 đo khoảng cách tới mặt nước</p>
          </div>
          <span className="card-icon">
            <DropletIcon size={18} />
          </span>
        </div>

        <div className="tank-headline">
          <div className="tank-reading">
            <strong>{tankDistanceCm === null ? "--" : Math.round(tankDistanceCm)}</strong>
            <small>cm</small>
          </div>
          <span
            className={`live-badge ${
              tankEmpty ? "danger" : tankDistanceCm === null ? "" : "active"
            }`}
          >
            <i />
            {tankEmpty ? "Bồn cạn" : tankDistanceCm === null ? "Chưa có dữ liệu" : "Còn nước"}
          </span>
        </div>

        <div className="tank-gauge">
          <div className="tank-track">
            {tankLevel !== null && (
              <span
                className={`tank-marker ${tankEmpty ? "danger" : ""}`}
                style={{ left: `${tankLevel}%` }}
              />
            )}
          </div>
          <div className="tank-scale">
            <span>0 cm · đầy</span>
            <span>100 cm · cạn</span>
          </div>
        </div>

        <p className="tank-caption">
          {tankEmpty
            ? "Bồn cạn: bơm đang bị chặn để tránh chạy khô."
            : tankDistanceCm === null
              ? "Chưa nhận được số đo từ cảm biến."
              : "Khoảng cách càng lớn, mực nước càng thấp."}
        </p>

        <div className="tank-limits">
          <span>
            <em>Báo cạn</em>≥ 80 cm
          </span>
          <span>
            <em>Hồi nước</em>≤ 60 cm
          </span>
        </div>
      </article>

      <ZoneConfigCard
        key={selectedZone.id}
        zone={selectedZone}
        wateredLiters={wateredLiters}
        lastRun={lastRun}
        todayLiters={todayLiters}
        todayRuns={todayRuns}
        wateringLoaded={wateringLoaded}
        onSave={onSaveZoneConfig}
      />
    </section>
  );
}
