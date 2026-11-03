"use client";

import React from "react";
import { type Zone } from "../garden-data";

interface MetricsOverviewProps {
  temperature: number;
  humidity: number;
  pumpOn: boolean;
  mode: string;
  leafyMoisture: number;
}

export function MetricsOverview({
  temperature,
  humidity,
  pumpOn,
  mode,
  leafyMoisture,
}: MetricsOverviewProps) {
  return (
    <>
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
          <span>Độ ẩm đất (Zone T002 - Cà chua)</span>
          <strong>
            {leafyMoisture}%{" "}
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
    </>
  );
}
