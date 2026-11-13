"use client";

import Link from "next/link";
import type { SoilType, Zone } from "../garden-data";
import type { ZoneConfigInput } from "../hooks/useMqtt";
import { EditIcon } from "./icons";
import { GardenBoard } from "./GardenBoard";
import { GardenDetailPanel } from "./GardenDetailPanel";
import { ZoneAdvicePanel } from "./ZoneAdvicePanel";

export function GardenOverview({
  zones,
  activeZone,
  soil,
  controlsEnabled,
  deviceId,
  tankEmpty,
  onSelectZone,
  onToggleIrrigation,
  onApplyAdvice,
}: {
  zones: Zone[];
  activeZone: string;
  soil: SoilType;
  controlsEnabled: boolean;
  deviceId: string;
  tankEmpty: boolean;
  onSelectZone: (zoneId: string) => void;
  onToggleIrrigation: () => void;
  onApplyAdvice: (input: ZoneConfigInput) => Promise<boolean>;
}) {
  const selectedZone = zones.find((zone) => zone.id === activeZone) ?? zones[0];
  if (!selectedZone) return null;

  const applyAdvice = (value: { threshold: number }) =>
    onApplyAdvice({
      threshold: value.threshold,
      pumpSeconds: selectedZone.pumpSeconds,
      flowLitersPerHour: selectedZone.flowLitersPerHour,
      targetLiters: selectedZone.targetLiters,
    });

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
          soil={soil}
          controlsEnabled={controlsEnabled}
          tankEmpty={tankEmpty}
          onToggleIrrigation={onToggleIrrigation}
        />
      </div>

      <ZoneAdvicePanel
        key={selectedZone.id}
        deviceId={deviceId}
        zone={selectedZone}
        soil={soil}
        onApply={applyAdvice}
      />
    </section>
  );
}
