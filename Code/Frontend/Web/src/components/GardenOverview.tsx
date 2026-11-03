"use client";

import React from "react";
import { GardenMap } from "./GardenMap";
import { type Zone } from "../garden-data";

interface GardenOverviewProps {
  zones: Zone[];
  activeGroup: string;
  plantGroups: readonly string[];
  activeZone: string;
  view: "2d" | "map";
  pumpOn: boolean;
  connected: boolean;
  onSelectGroup: (group: any) => void;
  onSelectZone: (zoneId: string) => void;
  onChangeView: (view: "2d" | "map") => void;
  onToggleIrrigation: () => void;
}

export function GardenOverview({
  zones,
  activeGroup,
  plantGroups,
  activeZone,
  view,
  pumpOn,
  connected,
  onSelectGroup,
  onSelectZone,
  onChangeView,
  onToggleIrrigation,
}: GardenOverviewProps) {
  const visibleZones = zones.filter((zone) => zone.group === activeGroup);
  const selectedZone = zones.find((zone) => zone.id === activeZone) ?? zones[0];

  return (
    <section className="garden-panel panel">
      <div className="panel-heading">
        <div>
          <h2>Garden overview</h2>
          <p>
            Vùng <strong>T002</strong> được liên kết trực tiếp với cảm biến ESP32
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

      <div className="garden-tabs" role="tablist" aria-label="Nhóm cây trồng">
        {plantGroups.map((group) => (
          <button
            key={group}
            className={activeGroup === group ? "selected" : ""}
            onClick={() => onSelectGroup(group)}
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
          {visibleZones.length} khu vực riêng · Mỗi loại cây có ngưỡng tưới độc lập
        </span>
      </div>

      <GardenMap
        zones={visibleZones}
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
          className={`water-button ${pumpOn ? "watering" : ""}`}
          onClick={onToggleIrrigation}
          disabled={!connected}
          title={connected ? "Tưới khu vực đang chọn" : "Cần kết nối MQTT"}
        >
          {pumpOn ? "◌ Bơm đang chạy..." : "♧ Tưới khu vực này"}
        </button>
      </div>
    </section>
  );
}
