import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ZONE_IDS } from "@/api/types";
import {
  HistoryChart,
  HISTORY_METRICS,
  type HistoryMetric,
} from "@/components/history/HistoryChart";
import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { LedgerTabs } from "@/components/ui/LedgerTabs";
import { Panel } from "@/components/ui/Panel";
import { ZonePicker } from "@/components/zones/ZonePicker";
import { HISTORY_RANGES, useHistory, type RangeKey } from "@/hooks/useHistory";
import { useGarden } from "@/providers/GardenProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { typo, type Palette } from "@/theme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { formatNumber } from "@/utils/format";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = (
  Object.keys(HISTORY_RANGES) as RangeKey[]
).map((key) => ({ value: key, label: HISTORY_RANGES[key].label }));

const METRIC_OPTIONS: { value: HistoryMetric; label: string }[] = [
  { value: "moisture", label: "Độ ẩm đất" },
  { value: "temperature", label: "Nhiệt độ" },
  { value: "humidity", label: "Độ ẩm khí" },
  { value: "rain", label: "Mưa" },
];

export default function HistoryScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { deviceId, zones, loading } = useGarden();

  const [zoneId, setZoneId] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("24h");
  const [metric, setMetric] = useState<HistoryMetric>("moisture");

  const zone = zones.find((item) => item.id === zoneId) ?? zones[0];
  const activeZoneId = zone?.id ?? ZONE_IDS[0];
  const { samples, loading: chartLoading, error, reload } = useHistory({
    deviceId,
    zoneId: activeZoneId,
    range,
  });

  return (
    <Screen>
      <PageHeader
        title="Lịch sử"
        subtitle="Độ ẩm đất, nhiệt độ và thời tiết theo thời gian."
      />

      <Panel index="01" title="Khu vườn" hint={zone ? zone.crop : undefined}>
        {loading && zones.length === 0 ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.green} />
            <Text style={styles.loadingText}>
              Đang tải danh sách khu vườn...
            </Text>
          </View>
        ) : (
          <ZonePicker zones={zones} value={activeZoneId} onChange={setZoneId} />
        )}

        {zone ? (
          <Text style={styles.zoneMeta}>
            {zone.id} · Ngưỡng tưới {formatNumber(zone.threshold, 0)}% · Dừng{" "}
            {formatNumber(zone.stopThreshold, 0)}%
          </Text>
        ) : null}
      </Panel>

      <Panel
        index="02"
        title={HISTORY_METRICS[metric].label}
        hint={`${HISTORY_RANGES[range].label} · ${
          zone ? zone.name : activeZoneId
        }`}
        footer={
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {metric === "moisture"
                ? "Đường nét đứt là ngưỡng tưới. Tự làm mới mỗi 30 giây."
                : "Chỉ số lấy trung bình theo khoảng. Tự làm mới mỗi 30 giây."}
            </Text>

            <Pressable accessibilityRole="button" onPress={reload} hitSlop={8}>
              <Text style={styles.reload}>Tải lại</Text>
            </Pressable>
          </View>
        }
      >
        <LedgerTabs options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
        <LedgerTabs options={RANGE_OPTIONS} value={range} onChange={setRange} />

        <View style={styles.chartBlock}>
          <HistoryChart
            response={{ samples, bucketMs: HISTORY_RANGES[range].bucketMs }}
            metric={metric}
            range={range}
            loading={chartLoading}
            error={error}
          />
        </View>
      </Panel>
    </Screen>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
    },
    loadingText: {
      ...typo.small,
      color: colors.faint,
    },
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
      justifyContent: "space-between",
      gap: 12,
    },
    footerText: {
      flex: 1,
      ...typo.caption,
      color: colors.faint,
    },
    reload: {
      ...typo.smallStrong,
      color: colors.green,
    },
  });
