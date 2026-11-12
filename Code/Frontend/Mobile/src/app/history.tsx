import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ZONE_IDS } from "@/api/types";
import { HistoryChart, HISTORY_METRICS, type HistoryMetric } from "@/components/history/HistoryChart";
import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { Card } from "@/components/ui/Card";
import { ChipRow } from "@/components/ui/ChipRow";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ZonePicker } from "@/components/zones/ZonePicker";
import { HISTORY_RANGES, useHistory, type RangeKey } from "@/hooks/useHistory";
import { useGarden } from "@/providers/GardenProvider";
import { colors, spacing } from "@/theme";
import { formatNumber } from "@/utils/format";

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = (
  Object.keys(HISTORY_RANGES) as RangeKey[]
).map((key) => ({ value: key, label: HISTORY_RANGES[key].label }));

const METRIC_OPTIONS: Array<{ value: HistoryMetric; label: string }> = [
  { value: "moisture", label: "Độ ẩm đất" },
  { value: "temperature", label: "Nhiệt độ" },
  { value: "humidity", label: "Độ ẩm khí" },
  { value: "rain", label: "Cảm biến mưa" },
];

export default function HistoryScreen() {
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
        title="Lịch sử dữ liệu"
        subtitle="Theo dõi độ ẩm đất, nhiệt độ và thời tiết theo thời gian."
      />

      <Card>
        <SectionHeader title="Khu vườn" hint={zone ? zone.crop : undefined} />
        {loading && zones.length === 0 ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.green} />
            <Text style={styles.loadingText}>Đang tải danh sách khu vườn...</Text>
          </View>
        ) : (
          <ZonePicker zones={zones} value={activeZoneId} onChange={setZoneId} />
        )}
        {zone ? (
          <Text style={styles.zoneMeta}>
            {zone.id} · Ngưỡng tưới {formatNumber(zone.threshold, 0)}% · Ngưỡng dừng{" "}
            {formatNumber(zone.stopThreshold, 0)}%
          </Text>
        ) : null}
      </Card>

      <Card>
        <SectionHeader title="Khoảng thời gian" hint="TỰ ĐỘNG LÀM MỚI 30 GIÂY" />
        <ChipRow options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </Card>

      <Card>
        <SectionHeader
          title={HISTORY_METRICS[metric].label}
          hint={`${HISTORY_RANGES[range].label.toUpperCase()} · ${
            zone ? zone.name : activeZoneId
          }`}
        />
        <ChipRow options={METRIC_OPTIONS} value={metric} onChange={setMetric} />

        <HistoryChart
          response={{ samples, bucketMs: HISTORY_RANGES[range].bucketMs }}
          metric={metric}
          range={range}
          loading={chartLoading}
          error={error}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {metric === "moisture"
              ? "Đường nét đứt là ngưỡng tưới của khu vực."
              : "Chỉ số lấy trung bình theo từng khoảng thời gian."}
          </Text>
          <Pressable accessibilityRole="button" onPress={reload} hitSlop={8}>
            <Text style={styles.reload}>Tải lại</Text>
          </Pressable>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    fontSize: 12,
    color: colors.faint,
  },
  zoneMeta: {
    marginTop: spacing.sm,
    fontSize: 11,
    color: colors.faint,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  footerText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.faint,
  },
  reload: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.green,
  },
});
