"use client";

import { MAX_RAIN_THRESHOLD, MIN_RAIN_THRESHOLD } from "../hooks/useMqtt";
import { CloudIcon, RainIcon, ThermometerIcon } from "./icons";
import { Tooltip } from "./Tooltip";

interface WeatherCardProps {
  temperature: number | null;
  humidity: number | null;
  raining: boolean;
  rainPercent: number | null;
  rainThreshold: number;
  rainWarnThreshold: number;
  rainBlock: boolean;
  controlsEnabled: boolean;
  onChangeRainThreshold: (val: number) => void;
  onToggleWeatherGate: (enabled: boolean) => void;
}

export function WeatherCard({
  temperature,
  humidity,
  raining,
  rainPercent,
  rainThreshold,
  rainWarnThreshold,
  rainBlock,
  controlsEnabled,
  onChangeRainThreshold,
  onToggleWeatherGate,
}: WeatherCardProps) {
  const offlineReason = "Thiết bị mất kết nối";

  return (
    <article className={`panel weather-card ${raining ? "raining" : ""}`}>
      <div className="panel-heading">
        <div>
          <h2>Thời tiết ngoài vườn</h2>
          <p>Nhiệt độ, độ ẩm không khí và khả năng mưa</p>
        </div>
        <span className="card-icon">
          <ThermometerIcon size={18} />
        </span>
      </div>

      <div className="weather-main">
        {temperature === null && humidity === null ? (
          <span className="weather-main-empty">Không có dữ liệu</span>
        ) : (
          <>
            <strong>{temperature === null ? "--" : `${temperature}°`}</strong>
            <span>· {humidity === null ? "--" : `${humidity}%`} độ ẩm</span>
          </>
        )}
      </div>

      <div className="weather-details">
        <span>
          <CloudIcon size={15} /> Trạng thái
        </span>
        <strong>
          {temperature === null && rainPercent === null
            ? "Không có dữ liệu"
            : raining
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
          <RainIcon size={15} /> Khả năng mưa
        </span>
        <strong>{rainPercent === null ? "Không có dữ liệu" : `${rainPercent}%`}</strong>
      </div>

      <div className="threshold-control">
        <label htmlFor="rain-threshold">
          Tạm dừng tưới khi mưa đạt <strong>{rainThreshold}%</strong>
          <Tooltip text={`Bơm sẽ tự động tạm dừng khi mưa đạt ${rainThreshold}% để chống úng nước.`} />
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
          Có thể sắp mưa ({rainPercent}%): còi đã báo động, hệ thống vẫn tưới. Khi mưa vượt {rainThreshold}% bơm sẽ tự dừng nếu đang bật hoãn tưới.
        </div>
      )}
    </article>
  );
}
