import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { ZoneProfileEditor } from "@/components/garden/ZoneProfileEditor";
import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { ZoneSettingsForm } from "@/components/settings/ZoneSettingsForm";
import { LedgerTabs } from "@/components/ui/LedgerTabs";
import { Panel } from "@/components/ui/Panel";
import { Reveal } from "@/components/ui/Reveal";
import { ZoneGrid } from "@/components/zones/ZoneGrid";
import { useGarden } from "@/providers/GardenProvider";
import { formatNumber } from "@/utils/format";

type GardenView = "crop" | "irrigation";

const VIEW_OPTIONS: { value: GardenView; label: string }[] = [
  { value: "crop", label: "Cây trồng" },
  { value: "irrigation", label: "Tưới" },
];

function parseView(value: string | undefined): GardenView {
  return value === "irrigation" ? value : "crop";
}

export default function GardenScreen() {
  const params = useLocalSearchParams<{ zone?: string; at?: string; view?: string }>();

  const {
    zones,
    reloadConfig,
    deviceOnline,
    lastTelemetryAt,
  } = useGarden();

  // Điều hướng kèm ?zone=...&view=...; đổi tham số thì đổi khu vực và mục.
  const paramKey = `${params.zone ?? ""}|${params.at ?? ""}|${params.view ?? ""}`;
  const [selection, setSelection] = useState<{
    key: string;
    zoneId: string | null;
    view: GardenView;
  }>({
    key: paramKey,
    zoneId: params.zone ?? null,
    view: parseView(params.view),
  });

  if (selection.key !== paramKey) {
    setSelection({
      key: paramKey,
      zoneId: params.zone ?? null,
      view: parseView(params.view),
    });
  }

  const zone = zones.find((item) => item.id === selection.zoneId) ?? zones[0] ?? null;
  const view = selection.view;

  const changeView = (next: GardenView) =>
    setSelection((current) => ({ ...current, view: next }));

  // Vuốt trái/phải đổi giữa Cây trồng và Tưới; hết mục thì nhường cho tab đáy.
  const handleSwipe = (direction: "left" | "right") => {
    if (direction === "left" && view === "crop") {
      changeView("irrigation");
      return true;
    }
    if (direction === "right" && view === "irrigation") {
      changeView("crop");
      return true;
    }
    return false;
  };

  return (
    <Screen onSwipe={handleSwipe}>
      <PageHeader
        title="Khu vườn"
        status={{ online: deviceOnline, at: lastTelemetryAt }}
      />

      <Reveal index={0}>
        <Panel
          index="01"
          title="Khu vực"
          hint={zones.length > 0 ? `${zones.length} khu` : undefined}
        >
          <ZoneGrid
            selectedId={zone?.id ?? null}
            onSelect={(zoneId) =>
              setSelection((current) => ({ ...current, zoneId }))
            }
          />
        </Panel>
      </Reveal>

      <LedgerTabs
        options={VIEW_OPTIONS}
        value={view}
        onChange={changeView}
      />

      <Reveal index={1} key={view}>
        {view === "crop" && zone ? (
          <ZoneProfileEditor
            key={zone.id}
            zone={zone}
            onReload={reloadConfig}
          />
        ) : null}

        {view === "irrigation" && zone ? (
          <Panel
            index="02"
            title="Thông số tưới"
            hint={
              zone.moisture === null
                ? "Chưa có dữ liệu"
                : `Độ ẩm ${formatNumber(zone.moisture, 0)}%`
            }
          >
            <ZoneSettingsForm key={zone.id} zone={zone} />
          </Panel>
        ) : null}
      </Reveal>
    </Screen>
  );
}
