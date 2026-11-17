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
import { Reveal } from "@/components/ui/Reveal";
import { ZoneGrid } from "@/components/zones/ZoneGrid";
import { ZoneSheet } from "@/components/zones/ZoneSheet";
import { useGarden } from "@/providers/GardenProvider";

export default function OverviewScreen() {
  const router = useRouter();
  const { zones } = useGarden();

  const [searchOpen, setSearchOpen] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [zoneId, setZoneId] = useState<string | null>(null);

  const zone = zoneId ? (zones.find((item) => item.id === zoneId) ?? null) : null;

  return (
    <Screen>
      <DashboardHeader
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => router.navigate("/settings")}
      />

      <Reveal index={0}>
        <ModeDock />
      </Reveal>

      <Reveal index={1}>
        <MetricStrip />
      </Reveal>

      <Reveal index={2}>
        <EnvRow />
      </Reveal>

      <Reveal index={3}>
        <ZoneGrid onSelect={setZoneId} />
      </Reveal>

      <Reveal index={4}>
        <ChartEntry onPress={() => setChartsOpen(true)} />
      </Reveal>

      <Reveal index={5}>
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
