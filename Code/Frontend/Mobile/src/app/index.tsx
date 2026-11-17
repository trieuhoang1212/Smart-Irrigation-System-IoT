import { useRouter } from "expo-router";
import { useState } from "react";

import { DashboardHeader } from "@/components/overview/DashboardHeader";
import { ChartEntry, ChartSheet } from "@/components/overview/ChartSheet";
import { EnvRow } from "@/components/overview/EnvRow";
import { MetricStrip } from "@/components/overview/MetricStrip";
import { ModeDock } from "@/components/overview/ModeDock";
import { StatusLine } from "@/components/overview/StatusLine";
import { Screen } from "@/components/layout/Screen";
import { SearchSheet } from "@/components/search/SearchSheet";
import { Panel } from "@/components/ui/Panel";
import { Reveal } from "@/components/ui/Reveal";
import { ZoneGrid } from "@/components/zones/ZoneGrid";
import { ZoneSheet } from "@/components/zones/ZoneSheet";
import { useGarden } from "@/providers/GardenProvider";

export default function OverviewScreen() {
  const router = useRouter();
  const { zones, deviceOnline } = useGarden();

  const [searchOpen, setSearchOpen] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [zoneId, setZoneId] = useState<string | null>(null);

  const zone = zoneId ? (zones.find((item) => item.id === zoneId) ?? null) : null;

  return (
    <Screen>
      <DashboardHeader onOpenSearch={() => setSearchOpen(true)} />

      <Reveal index={0}>
        <ModeDock />
      </Reveal>

      <Reveal index={1}>
        <Panel
          index="01"
          title="Trạng thái"
          hint={deviceOnline ? "Trực tiếp" : "Chờ kết nối"}
          tone={deviceOnline ? undefined : "error"}
        >
          <MetricStrip />
          <EnvRow />
        </Panel>
      </Reveal>

      <Reveal index={2}>
        <Panel index="02" title="Khu vực" hint={`${zones.length || 6} khu · chạm để mở`}>
          <ZoneGrid onSelect={setZoneId} />
        </Panel>
      </Reveal>

      <Reveal index={3}>
        <ChartEntry onPress={() => setChartsOpen(true)} />
      </Reveal>

      <Reveal index={4}>
        <StatusLine />
      </Reveal>

      <ZoneSheet
        zone={zone}
        onClose={() => setZoneId(null)}
        onEdit={(id) => {
          setZoneId(null);
          router.navigate({
            pathname: "/garden",
            params: { zone: id, at: String(Date.now()), view: "irrigation" },
          });
        }}
      />

      <SearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectZone={setZoneId}
        onNavigate={(path) => router.navigate(path)}
      />

      <ChartSheet
        visible={chartsOpen}
        onClose={() => setChartsOpen(false)}
        onOpenHistory={() => {
          setChartsOpen(false);
          router.navigate("/history");
        }}
      />
    </Screen>
  );
}
