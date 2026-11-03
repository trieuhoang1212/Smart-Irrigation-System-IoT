"use client";

import React from "react";
import { GardenMap } from "./GardenMap";
import { type Zone } from "../garden-data";

export function GardenOverview({
  zones,
  activeZone,
  view,
  connected,
  onSelectZone,
  onChangeView,
  onToggleIrrigation,
}: {
  zones: Zone[];
  activeZone: string;
  view: "2d" | "map";
  connected: boolean;
  onSelectZone: (zoneId: string) => void;
  onChangeView: (view: "2d" | "map") => void;
  onToggleIrrigation: () => void;
}) {
  const selectedZone = zones.find((zone) => zone.id === activeZone) ?? zones[0];

  return (
    <section className="garden-panel panel">
      <div className="panel-heading">
        <div>
          <h2>Garden overview</h2>
          <p>
            Vùng <strong>T002 (Cà chua)</strong> được liên kết trực tiếp với cảm biến ESP32
          </p>
        </div>
        <div className="view-switch">
          <button
            className={view === "2d" ? "selected" : ""}
            onClick={() => onChangeView("2d")}
          >
            2D view
          </button>
          <button
            className={view === "map" ? "selected" : ""}
            onClick={() => onChangeView("map")}
          >
            Map
          </button>
        </div>
      </div>

      <div className="group-caption" style={{ marginTop: "12px" }}>
        <strong>Khu vườn thông minh Greenflow</strong>
        <span>
          6 luống cây trồng chuyên biệt (T001 - T006) · Điều khiển tưới tự động & van độc lập
        </span>
      </div>

      <GardenMap
        zones={zones}
        activeZone={activeZone}
        onSelect={onSelectZone}
        view={view}
      />

      <div className="selected-zone">
        <div className="zone-title">
          <span className="status-dot" /> <strong>{selectedZone.id}</strong> ·{" "}
          {selectedZone.name}
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
          className={`water-button ${selectedZone.pump ? "watering" : ""}`}
          onClick={onToggleIrrigation}
          disabled={!connected}
          title={connected ? "Tưới khu vực đang chọn" : "Cần kết nối MQTT"}
        >
          {selectedZone.pump
            ? `◌ ${selectedZone.name} đang tưới...`
            : "♧ Tưới khu vực này"}
        </button>
      </div>
    </section>
  );
}
