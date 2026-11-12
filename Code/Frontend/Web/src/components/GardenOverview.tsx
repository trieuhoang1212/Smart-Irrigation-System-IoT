"use client";

import Link from "next/link";
import type { Zone } from "../garden-data";
import { EditIcon } from "./icons";
import { GardenBoard } from "./GardenBoard";
import { GardenDetailPanel } from "./GardenDetailPanel";

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
  if (!selectedZone) return null;

  return (
    <section className="garden-panel panel">
      <div className="panel-heading">
        <div>
          <h2>Khu vườn</h2>
          <p>6 ô trồng · dữ liệu realtime từ ESP32</p>
        </div>
        <Link className="link-button" href="/garden">
          <EditIcon size={14} />
          Quản lý khu vườn
        </Link>
      </div>

      <div className="garden-workspace">
        <GardenBoard zones={zones} activeZone={selectedZone.id} onSelect={onSelectZone} />
        <GardenDetailPanel
          zone={selectedZone}
          connected={connected}
          onToggleIrrigation={onToggleIrrigation}
        />
      </div>
    </section>
  );
}
