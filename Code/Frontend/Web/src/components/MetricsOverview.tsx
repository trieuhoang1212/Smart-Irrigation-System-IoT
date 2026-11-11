"use client";

import { type Zone } from "../garden-data";
import {
  ArrowRightIcon,
  DropletIcon,
  GaugeIcon,
  ModeIcon,
  ThermometerIcon,
  ValveIcon,
} from "./icons";

interface MetricsOverviewProps {
  temperature: number | null;
  humidity: number | null;
  pumpOn: boolean;
  servoAngle: number | null;
  mode: string;
  selectedZone: Zone;
}

export function MetricsOverview({
  temperature,
  humidity,
  pumpOn,
  servoAngle,
  mode,
  selectedZone,
}: MetricsOverviewProps) {
  return (
    <>
      <div className="section-title">
        <h2>Thông số thời gian thực</h2>
        <a className="link-button" href="#history">
          Xem lịch sử cảm biến <ArrowRightIcon size={14} />
        </a>
      </div>

      <section className="metrics-grid">
        <article className="metric-card">
          <div className="metric-icon orange">
            <ThermometerIcon size={17} />
          </div>
          <span>Nhiệt độ không khí</span>
          <strong>
            {temperature === null ? "--" : `${temperature}°`}
            <small>C</small>
          </strong>
          <p>Đọc từ DHT22 trên ESP32</p>
        </article>

        <article className="metric-card">
          <div className="metric-icon blue">
            <DropletIcon size={17} />
          </div>
          <span>Độ ẩm không khí</span>
          <strong>
            {humidity === null ? "--" : `${humidity}%`}
          </strong>
          <p>{humidity === null ? "Cảm biến chưa trả dữ liệu" : "DHT22 · cập nhật 2 giây"}</p>
        </article>

        <article className="metric-card moisture-card">
          <div className="metric-icon green">
            <GaugeIcon size={17} />
          </div>
          <span>
            Độ ẩm đất · {selectedZone.id} {selectedZone.name}
          </span>
          <strong>
            {selectedZone.moisture === null ? "--" : `${selectedZone.moisture}%`}
            <small className={selectedZone.pump ? "good" : "warning"}>
              {selectedZone.pump ? "Đang tưới" : "Bình thường"}
            </small>
          </strong>
          <p>{selectedZone.method} · ngưỡng {selectedZone.threshold}%</p>
        </article>

        <article className="metric-card system-card">
          <div className="system-row">
            <span>
              <ValveIcon size={16} /> Bơm khu vực
            </span>
            <strong className={pumpOn ? "good" : ""}>{pumpOn ? "Bật" : "Tắt"}</strong>
          </div>
          <div className="system-row">
            <span>
              <GaugeIcon size={16} /> Van servo
            </span>
            <strong>{servoAngle === null ? "--" : `${servoAngle}°`}</strong>
          </div>
          <div className="system-row">
            <span>
              <ModeIcon size={16} /> Chế độ
            </span>
            <strong>{mode === "auto" ? "Tự động" : "Thủ công"}</strong>
          </div>
        </article>
      </section>
    </>
  );
}
