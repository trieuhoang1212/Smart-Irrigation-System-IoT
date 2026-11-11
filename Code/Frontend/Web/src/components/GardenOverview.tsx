"use client";

import { GardenMap } from "./GardenMap";
import { type Zone } from "../garden-data";
import { DropletIcon } from "./icons";

export function GardenOverview({
  zones,
  activeZone,
  connected,
  onSelectZone,
  onToggleIrrigation,
}: {
  zones: Zone[];
  activeZone: string;
  connected: boolean;
  onSelectZone: (zoneId: string) => void;
  onToggleIrrigation: () => void;
}) {
  const selectedZone = zones.find((zone) => zone.id === activeZone) ?? zones[0];
  const moistureStatus =
    selectedZone.moisture === null
      ? null
      : selectedZone.moisture < selectedZone.threshold
        ? "Cần tưới nước"
        : "Độ ẩm tốt";

  return (
    <section className="garden-panel panel">
      <div className="panel-heading">
        <div>
          <h2>Tổng quan khu vườn</h2>
          <p>
            Vùng <strong>{selectedZone.id} · {selectedZone.name}</strong> đang được chọn ·
            dữ liệu realtime từ ESP32
          </p>
        </div>
      </div>

      <GardenMap
        zones={zones}
        activeZone={activeZone}
        onSelect={onSelectZone}
      />

      <div className="selected-zone">
        <div className="zone-title">
          <span className="status-dot" /> <strong>{selectedZone.id}</strong> ·{" "}
          {selectedZone.name}
          <small>{selectedZone.crop}</small>
        </div>
        <div className="zone-stat">
          <span>Độ ẩm đất</span>
          <strong>{selectedZone.moisture === null ? "--" : `${selectedZone.moisture}%`}</strong>
          <div className="progress">
            <i style={{ width: `${selectedZone.moisture ?? 0}%` }} />
          </div>
          {moistureStatus && (
            <em
              className={
                selectedZone.moisture !== null && selectedZone.moisture < selectedZone.threshold
                  ? "dry"
                  : "ok"
              }
            >
              {moistureStatus}
            </em>
          )}
        </div>
        <div className="zone-stat">
          <span>Ngưỡng kích hoạt</span>
          <strong>{selectedZone.threshold}%</strong>
        </div>
        <button
          className={`water-button ${selectedZone.pump ? "watering" : ""}`}
          onClick={onToggleIrrigation}
          disabled={!connected}
          title={connected ? "Tưới khu vực đang chọn" : "Cần kết nối MQTT"}
        >
          <DropletIcon size={15} />
          {selectedZone.pump ? `${selectedZone.name} đang tưới...` : "Tưới khu vực này"}
        </button>
      </div>
    </section>
  );
}
