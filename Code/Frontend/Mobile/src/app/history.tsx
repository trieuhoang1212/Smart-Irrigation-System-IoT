import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ZONE_IDS } from "@/api/types";
import { EnvironmentPanel } from "@/components/history/EnvironmentPanel";
import { HistoryChart } from "@/components/history/HistoryChart";
import { WaterDonut } from "@/components/history/WaterDonut";
import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { LedgerTabs } from "@/components/ui/LedgerTabs";
import { Panel } from "@/components/ui/Panel";
import { Reveal } from "@/components/ui/Reveal";
import { ZoneGrid } from "@/components/zones/ZoneGrid";
import { HISTORY_RANGES, useHistory, type RangeKey } from "@/hooks/useHistory";
import { useWatering } from "@/hooks/useWatering";
import { useGarden } from "@/providers/GardenProvider";
import { typo, type Palette } from "@/theme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { formatNumber } from "@/utils/format";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = (
  Object.keys(HISTORY_RANGES) as RangeKey[]
).map((key) => ({ value: key, label: HISTORY_RANGES[key].label }));

export default function HistoryScreen() {
  const styles = useThemedStyles(createStyles);
  const { deviceId, zones, deviceOnline, lastTelemetryAt } = useGarden();

  const [zoneId, setZoneId] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("24h");

  const zone = zones.find((item) => item.id === zoneId) ?? zones[0];
  const activeZoneId = zone?.id ?? ZONE_IDS[0];
  // Cảm biến môi trường dùng chung: lấy đại diện một khu cố định để biểu đồ
  // không đổi theo khu đang chọn.
  const envZoneId = zones[0]?.id ?? activeZoneId;

  const {
    samples,
    loading: chartLoading,
    error,
    reload: reloadHistory,
  } = useHistory({ deviceId, zoneId: activeZoneId, range });
  const {
    samples: envSamples,
    loading: envLoading,
    error: envError,
    reload: reloadEnvironment,
  } = useHistory({ deviceId, zoneId: envZoneId, range });
  const { byZone, reload: reloadWatering } = useWatering(deviceId);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([reloadHistory(), reloadEnvironment(), reloadWatering()]).finally(
      () => setRefreshing(false),
    );
  }, [reloadHistory, reloadEnvironment, reloadWatering]);

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PageHeader
        title="Lịch sử"
        status={{ online: deviceOnline, at: lastTelemetryAt }}
      />

      <Reveal index={0}>
        <Panel index="01" title="Khu vực" hint={zone ? zone.crop : undefined}>
          <ZoneGrid selectedId={activeZoneId} onSelect={setZoneId} />

          {zone ? (
            <Text style={styles.zoneMeta}>
              {zone.id} · Ngưỡng tưới {formatNumber(zone.threshold, 0)}% · Dừng{" "}
              {formatNumber(zone.stopThreshold, 0)}%
            </Text>
          ) : null}
        </Panel>
      </Reveal>

      <Reveal index={1}>
        <Panel
          index="02"
          title="Độ ẩm đất"
          hint={zone ? zone.name : undefined}
          footer={
            <View style={styles.footer}>
              <Pressable accessibilityRole="button" onPress={reloadHistory} hitSlop={8}>
                <Text style={styles.reload}>Tải lại</Text>
              </Pressable>
            </View>
          }
        >
          <LedgerTabs options={RANGE_OPTIONS} value={range} onChange={setRange} />

          <View style={styles.chartBlock}>
            <HistoryChart
              response={{ samples, bucketMs: HISTORY_RANGES[range].bucketMs }}
              metric="moisture"
              range={range}
              loading={chartLoading}
              error={error}
              threshold={zone ? zone.threshold : null}
            />
          </View>
        </Panel>
      </Reveal>

      <Reveal index={2}>
        <EnvironmentPanel samples={envSamples} loading={envLoading} error={envError} />
      </Reveal>

      <Reveal index={3}>
        <WaterDonut zones={zones} byZone={byZone} />
      </Reveal>
    </Screen>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    zoneMeta: {
      ...typo.caption,
      color: colors.faint,
      marginTop: 2,
    },
    chartBlock: {
      paddingTop: 2,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    reload: {
      ...typo.smallStrong,
      color: colors.green,
    },
  });
