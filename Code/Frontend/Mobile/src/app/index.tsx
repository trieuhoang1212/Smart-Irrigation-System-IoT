import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { ChartEntry, ChartSheet } from "@/components/overview/ChartSheet";
import { EnvRow } from "@/components/overview/EnvRow";
import { MetricStrip } from "@/components/overview/MetricStrip";
import { ModeDock } from "@/components/overview/ModeDock";
import { StatusLine } from "@/components/overview/StatusLine";
import { SearchSheet } from "@/components/search/SearchSheet";
import { Panel } from "@/components/ui/Panel";
import { Reveal } from "@/components/ui/Reveal";
import { ZoneGrid } from "@/components/zones/ZoneGrid";
import { ZoneSheet } from "@/components/zones/ZoneSheet";
import { useGarden } from "@/providers/GardenProvider";

export default function OverviewScreen() {
  const router = useRouter();
  const { zones, deviceOnline, lastTelemetryAt, refreshConfig } = useGarden();

  const [searchOpen, setSearchOpen] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void refreshConfig().finally(() => setRefreshing(false));
  }, [refreshConfig]);

  const openZone = openId
    ? (zones.find((item) => item.id === openId) ?? null)
    : null;

  return (
    <Screen
      onPullUp={() => setChartsOpen(true)}
      refreshing={refreshing}
      onRefresh={handleRefresh}
    >
      <PageHeader
        title="Tổng quan"
        status={{ online: deviceOnline, at: lastTelemetryAt }}
        onSearch={() => setSearchOpen(true)}
      />

      <Reveal index={0}>
        <ModeDock />
      </Reveal>

      <Reveal index={1}>
        <Panel index="01" title="Khu vực" hint={`${zones.length || 6} khu`}>
          <ZoneGrid onSelect={setOpenId} />
        </Panel>
      </Reveal>

      <Reveal index={2}>
        <Panel
          index="02"
          title="Trạng thái"
          hint={deviceOnline ? "Trực tiếp" : undefined}
        >
          <MetricStrip />
          <EnvRow />
        </Panel>
      </Reveal>

      <Reveal index={3}>
        <ChartEntry onPress={() => setChartsOpen(true)} />
      </Reveal>

      <Reveal index={4}>
        <StatusLine />
      </Reveal>

      <ZoneSheet
        zone={openZone}
        onClose={() => setOpenId(null)}
        onEdit={(id) => {
          setOpenId(null);
          router.navigate({
            pathname: "/garden",
            params: { zone: id, at: String(Date.now()), view: "irrigation" },
          });
        }}
      />

      <SearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectZone={(id) => setOpenId(id)}
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
