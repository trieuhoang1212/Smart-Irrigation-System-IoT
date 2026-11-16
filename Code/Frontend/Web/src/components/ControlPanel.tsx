"use client";

import { type Zone } from "../garden-data";
import {
  MAX_RAIN_THRESHOLD,
  MIN_RAIN_THRESHOLD,
  type ZoneConfigInput,
} from "../hooks/useMqtt";
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
  rainThreshold: number;
  rainWarnThreshold: number;
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
  onChangeRainThreshold: (val: number) => void;
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
  rainThreshold,
  rainWarnThreshold,
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
  onChangeRainThreshold,
  onToggleWeatherGate,
  onSaveZoneConfig,
}: ControlPanelProps) {
  const waterPercent =
    tankDistanceCm === null
      ? null
      : Math.max(0, Math.min(100, Math.round(100 - tankDistanceCm)));
  const offlineReason = "Thiết bị tưới đang mất kết nối nên lệnh chưa gửi được";

  return (
    <section className="control-grid">
      <article className="panel control-card">
        <div className="panel-heading">
          <div>
            <h2>Điều khiển bơm</h2>
            <p>
              {selectedZone.id} · {selectedZone.name} · tưới khi đất dưới{" "}
              {selectedZone.threshold}% · dừng khi đạt {selectedZone.stopThreshold}%
            </p>
          </div>
          <span className={`live-badge ${selectedZone.pump ? "active" : ""}`}>
            <i />
            {selectedZone.pump ? "Đang tưới" : "Bơm đang tắt"}
          </span>
        </div>

        <div className="mode-row">
          <span>Chế độ toàn vườn</span>
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
              Đang Thủ công: hệ thống không tự tưới, lịch tự động tạm dừng cho cả vườn.
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
              {selectedZone.id} đã đủ {selectedZone.targetLiters} L cho lần tưới này —
              bơm đã tự dừng. Sau 10 phút hệ thống tự về Tự động.
            </span>
          </div>
        )}

        <div className="control-row">
          <div>
            <strong>
              {!controlsEnabled
                ? "Thiết bị tưới đang mất kết nối"
                : mode === "auto"
                  ? "Hệ thống tự quyết định"
                  : "Điều khiển bằng tay"}
            </strong>
            <small>
              {!controlsEnabled
                ? "Dữ liệu bên dưới là lần đo cuối; bơm không nhận lệnh mới."
                : tankEmpty
                  ? "Bồn nước đã cạn — bơm bị chặn để tránh chạy khô"
                  : mode === "auto"
                    ? `Tự tưới khi đất dưới ${selectedZone.threshold}% và dừng khi đạt ${selectedZone.stopThreshold}%. Bấm công tắc để tưới tay ngay.`
                    : "Công tắc bật/tắt bơm của khu vực đang chọn."}
            </small>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={selectedZone.pump}
            aria-label="Bật tắt bơm khu vực đang chọn"
            className={`big-toggle ${selectedZone.pump ? "on" : ""}`}
            onClick={onTogglePump}
            disabled={tankEmpty || !controlsEnabled}
            title={
              tankEmpty
                ? "Bồn nước đã cạn nên bơm bị chặn"
                : !controlsEnabled
                  ? offlineReason
                  : mode === "auto"
                    ? selectedZone.pump
                      ? "Dừng bơm và chuyển cả vườn sang Thủ công"
                      : "Bật bơm khu vực này (hệ thống sẽ tự chuyển sang Thủ công)"
                    : undefined
            }
          >
            <i />
          </button>
        </div>

        <div className="threshold-control">
          <label htmlFor="threshold">
            Tưới khi đất dưới <strong>{selectedZone.threshold}%</strong>
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
            Thiết bị tưới đang mất kết nối — công tắc bơm, chế độ và ngưỡng tạm khoá.
            Phần cấu hình vùng bên dưới vẫn lưu được vào máy chủ.
          </p>
        )}
      </article>

      <article className={`panel weather-card ${raining ? "raining" : ""}`}>
        <div className="panel-heading">
          <div>
            <h2>Thời tiết ngoài vườn</h2>
            <p>Nhiệt độ, độ ẩm không khí và cảm biến mưa</p>
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
              : rainPercent !== null && rainPercent >= rainWarnThreshold
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
            <RainIcon size={15} /> Khả năng mưa
          </span>
          <strong>{rainPercent === null ? "--" : `${rainPercent}%`}</strong>
        </div>

        <div className="threshold-control">
          <label htmlFor="rain-threshold">
            Tạm dừng tưới khi lượng mưa đạt <strong>{rainThreshold}%</strong>
          </label>
          <input
            id="rain-threshold"
            type="range"
            min={MIN_RAIN_THRESHOLD}
            max={MAX_RAIN_THRESHOLD}
            step="1"
            value={rainThreshold}
            onChange={(event) => onChangeRainThreshold(Number(event.target.value))}
            disabled={!controlsEnabled}
            title={controlsEnabled ? undefined : offlineReason}
          />
          <div>
            <span>{MIN_RAIN_THRESHOLD}% · dừng sớm</span>
            <span>{MAX_RAIN_THRESHOLD}% · dừng muộn</span>
          </div>
          <p className="rain-threshold-note">
            Cảnh báo từ {rainWarnThreshold}% · bơm tự động ngắt từ {rainThreshold}% nếu bật
            tính năng hoãn mưa.
          </p>
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={rainBlock}
            onChange={(event) => onToggleWeatherGate(event.target.checked)}
            disabled={!controlsEnabled}
          />
          <span>Tự động hoãn tưới khi trời mưa</span>
        </label>
        <div className={`weather-alert ${rainBlock ? "" : "off"}`}>
          {rainBlock ? "Đang bật chế độ hoãn tưới khi có mưa" : "Đã tắt chế độ hoãn tưới khi có mưa"}
        </div>
        {!raining && rainPercent !== null && rainPercent >= rainWarnThreshold && (
          <div className="weather-alert warn" role="status">
            Có thể sắp mưa ({rainPercent}%): còi đã báo động, hệ thống vẫn tưới. Khi mưa vượt{" "}
            {rainThreshold}% bơm sẽ tự dừng nếu đang bật hoãn tưới.
          </div>
        )}
      </article>

      <article className="panel tank-card">
        <div className="panel-heading">
          <div>
            <h2>Mực nước bồn chứa</h2>
            <p>Dung tích nước sẵn sàng để tưới cây</p>
          </div>
          <span className="card-icon">
            <DropletIcon size={18} />
          </span>
        </div>

        <div className="tank-headline">
          <div className="tank-reading">
            <strong>{waterPercent === null ? "--" : waterPercent}</strong>
            <small>%</small>
            {tankDistanceCm !== null && (
              <span className="tank-cm-hint">({Math.round(tankDistanceCm)} cm tới mặt nước)</span>
            )}
          </div>
          <span
            className={`live-badge ${
              tankEmpty
                ? "danger"
                : waterPercent === null
                  ? ""
                  : waterPercent <= 25
                    ? "danger"
                    : "active"
            }`}
          >
            <i />
            {tankEmpty
              ? "Bồn cạn nước"
              : waterPercent === null
                ? "Chưa có dữ liệu"
                : waterPercent <= 25
                  ? "Sắp hết nước"
                  : "Đủ nước tưới"}
          </span>
        </div>

        <div className="tank-gauge">
          <div className="tank-track">
            {waterPercent !== null && (
              <span
                className={`tank-marker ${tankEmpty || waterPercent <= 25 ? "danger" : ""}`}
                style={{ left: `${waterPercent}%` }}
              />
            )}
          </div>
          <div className="tank-scale">
            <span>0% · cạn</span>
            <span>100% · đầy</span>
          </div>
        </div>

        <p className="tank-caption">
          {tankEmpty
            ? "Bồn nước đã cạn: hệ thống tự động khóa bơm để chống cháy thiết bị."
            : waterPercent === null
              ? "Chưa nhận được số đo từ cảm biến."
              : waterPercent <= 25
                ? "Mực nước xuống thấp: nên sớm châm thêm nước vào bồn."
                : "Mực nước dồi dào, sẵn sàng phục vụ các lượt tưới tự động."}
        </p>

        <div className="tank-limits">
          <span>
            <em>Cảnh báo cạn</em>dưới 20% (≥ 80 cm)
          </span>
          <span>
            <em>An toàn để tưới</em>trên 40% (≤ 60 cm)
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
