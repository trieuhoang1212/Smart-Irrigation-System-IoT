"use client";

import type { Zone } from "../garden-data";
import { zoneStatus } from "../lib/zone-status";
import { ZonePhoto } from "./ZonePhoto";

export function GardenBoard({
  zones,
  activeZone,
  onSelect,
}: {
  zones: Zone[];
  activeZone: string;
  onSelect: (zoneId: string) => void;
}) {
  return (
    <div className="garden-board">
      {zones.map((zone) => {
        const status = zoneStatus(zone);
        const isActive = zone.id === activeZone;
        const moisture = zone.online ? zone.moisture : null;

        return (
          <button
            key={zone.id}
            type="button"
            className={`garden-cell ${isActive ? "active" : ""}`}
            aria-pressed={isActive}
            onClick={() => onSelect(zone.id)}
          >
            <ZonePhoto zone={zone} className="garden-cell-photo" />
            <span className={`zone-chip ${status.tone}`}>{status.label}</span>
            <span className="garden-cell-body">
              <span className="garden-cell-line">
                <strong>{zone.name}</strong>
                <em>{zone.id}</em>
              </span>
              <small>{zone.group}</small>
              <span className="garden-cell-meter">
                <span className={`garden-meter ${zone.pump ? "pumping" : ""}`}>
                  <i style={{ width: `${moisture ?? 0}%` }} />
                </span>
                <b className={status.tone === "dry" ? "dry" : ""}>
                  {moisture !== null ? `${moisture}%` : "--"}
                </b>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
