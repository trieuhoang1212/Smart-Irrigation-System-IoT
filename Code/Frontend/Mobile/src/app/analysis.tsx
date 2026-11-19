import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ZONE_IDS } from "@/api/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { LedgerTabs } from "@/components/ui/LedgerTabs";
import { Panel } from "@/components/ui/Panel";
import { Reveal } from "@/components/ui/Reveal";
import { ZoneGrid } from "@/components/zones/ZoneGrid";
import { HISTORY_RANGES, useHistory, type RangeKey } from "@/hooks/useHistory";
import { useGarden } from "@/providers/GardenProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { typo, type Palette } from "@/theme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { analyzeMoisture } from "@/utils/analysis";
import { clamp, formatNumber, formatShortTime } from "@/utils/format";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = (
  Object.keys(HISTORY_RANGES) as RangeKey[]
).map((key) => ({ value: key, label: HISTORY_RANGES[key].label }));

const TONE_ICON: Record<"success" | "warning" | "error" | "neutral", AppIconName> = {
  success: "check",
  warning: "error",
  error: "cancel",
  neutral: "help",
};

export default function AnalysisScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const {
    deviceId,
    zones,
    deviceOnline,
    lastTelemetryAt,
    telemetry,
    mode,
  } = useGarden();

  const [zoneId, setZoneId] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("24h");

  const zone = zones.find((item) => item.id === zoneId) ?? zones[0];
  const activeZoneId = zone?.id ?? ZONE_IDS[0];
  const {
    samples,
    loading: historyLoading,
    error,
    reload,
  } = useHistory({ deviceId, zoneId: activeZoneId, range });

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void reload().finally(() => setRefreshing(false));
  }, [reload]);

  const analysis = useMemo(
    () =>
      zone
        ? analyzeMoisture({
            samples,
            zone,
            online: deviceOnline,
            mode,
            tankEmpty: Boolean(telemetry?.tank.empty),
            raining: Boolean(telemetry?.raining),
            rainBlock: Boolean(telemetry?.weatherGate),
          })
        : null,
    [samples, zone, deviceOnline, mode, telemetry],
  );

  const toneColors = analysis
    ? {
        success: colors.greenStrong,
        warning: colors.amber,
        error: colors.red,
        neutral: colors.muted,
      }[analysis.tone]
    : null;

  const currentPct =
    analysis?.current === null || analysis?.current === undefined
      ? null
      : clamp(analysis.current, 0, 100);

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <PageHeader
        title="Phân tích"
        status={{ online: deviceOnline, at: lastTelemetryAt }}
      />

      <Reveal index={0}>
        <Panel index="01" title="Khu vực" hint={zone ? zone.crop : undefined}>
          <ZoneGrid selectedId={activeZoneId} onSelect={setZoneId} />
        </Panel>
      </Reveal>

      <Reveal
        index={1}
        key={analysis && zone && toneColors ? "ready" : "pending"}
      >
        {analysis && zone && toneColors ? (
          <Panel
          index="02"
          title="Chẩn đoán"
          hint={zone.name}
          footer={
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {historyLoading && analysis.sampleCount === 0
                  ? "Đang tải lịch sử..."
                  : error
                    ? error
                    : analysis.lastSampleAt
                      ? `${analysis.sampleCount} mẫu · ${formatShortTime(
                          analysis.lastSampleAt,
                          range === "7d",
                        )}`
                      : "Chưa có mẫu nào trong khoảng này."}
              </Text>
              <Pressable accessibilityRole="button" onPress={reload} hitSlop={8}>
                <Text style={styles.reload}>Tải lại</Text>
              </Pressable>
            </View>
          }
        >
          <LedgerTabs options={RANGE_OPTIONS} value={range} onChange={setRange} />

          <View style={[styles.verdict, { borderLeftColor: toneColors }]}>
            <View style={styles.verdictHead}>
              <AppIcon
                name={TONE_ICON[analysis.tone]}
                size={15}
                color={toneColors}
              />
              <Text style={[styles.verdictTitle, { color: toneColors }]}>
                {analysis.headline}
              </Text>
            </View>
            <Text style={styles.summary}>{analysis.summary}</Text>
          </View>

          <View style={styles.bandBlock}>
            <View style={styles.bandHead}>
              <Text style={styles.bandLabel}>Độ ẩm hiện tại</Text>
              <AnimatedNumber
                value={analysis.current}
                format={(value) => `${formatNumber(value, 0)}%`}
                empty="Chưa có dữ liệu"
                style={styles.bandValue}
              />
            </View>

            <View style={styles.band}>
              <View
                style={[
                  styles.bandSafe,
                  {
                    left: `${clamp(analysis.safeLow, 0, 100)}%`,
                    width: `${clamp(
                      analysis.safeHigh - analysis.safeLow,
                      0,
                      100,
                    )}%`,
                  },
                ]}
              />
              {currentPct !== null ? (
                <View style={[styles.bandMarker, { left: `${currentPct}%` }]} />
              ) : null}
            </View>

            <View style={styles.bandLegend}>
              <Text style={styles.legend}>
                Ngưỡng tưới {formatNumber(analysis.safeLow, 0)}%
              </Text>
              <Text style={styles.legend}>
                Ngưỡng dừng {formatNumber(analysis.safeHigh, 0)}%
              </Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <Stat label="Trong ngưỡng" value={analysis.inSafePct} />
            <Stat label="Trung bình" value={analysis.average} divider />
          </View>

          <View style={styles.statRow}>
            <Stat label="Thấp nhất" value={analysis.min} />
            <Stat label="Cao nhất" value={analysis.max} divider />
          </View>

          <View style={styles.advice}>
            <Text style={styles.adviceTitle}>Gợi ý</Text>
            {analysis.advice.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.adviceRow}>
                <AppIcon name="leaf" size={13} color={colors.green} />
                <Text style={styles.adviceText}>{item}</Text>
              </View>
            ))}
          </View>
        </Panel>
        ) : null}
      </Reveal>
    </Screen>
  );
}

function Stat({
  label,
  value,
  divider = false,
}: {
  label: string;
  value: number | null;
  divider?: boolean;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <Text style={styles.statLabel}>{label}</Text>
      <AnimatedNumber
        value={value}
        format={(item) => `${formatNumber(item, 0)}%`}
        style={styles.statValue}
      />
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    verdict: {
      gap: 4,
      paddingVertical: 2,
      paddingLeft: 10,
      borderLeftWidth: 2,
    },
    verdictHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    verdictTitle: {
      ...typo.bodyStrong,
    },
    summary: {
      ...typo.small,
      color: colors.inkSoft,
      lineHeight: 18,
    },
    bandBlock: {
      gap: 7,
    },
    bandHead: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 8,
    },
    bandLabel: {
      ...typo.caption,
      color: colors.muted,
    },
    bandValue: {
      ...typo.section,
      color: colors.ink,
    },
    band: {
      height: 8,
      borderRadius: 2,
      backgroundColor: colors.lineSoft,
      overflow: "hidden",
    },
    bandSafe: {
      position: "absolute",
      top: 0,
      bottom: 0,
      backgroundColor: colors.greenSoft,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.green,
    },
    bandMarker: {
      position: "absolute",
      top: -2,
      bottom: -2,
      width: 3,
      marginLeft: -1,
      backgroundColor: colors.ink,
    },
    bandLegend: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    legend: {
      ...typo.caption,
      color: colors.faint,
    },
    statRow: {
      flexDirection: "row",
    },
    stat: {
      flex: 1,
      gap: 1,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    statDivider: {
      paddingLeft: 12,
      borderLeftWidth: 1,
      borderLeftColor: colors.lineSoft,
    },
    statLabel: {
      ...typo.caption,
      color: colors.muted,
    },
    statValue: {
      ...typo.bodyStrong,
      fontVariant: ["tabular-nums"],
      color: colors.ink,
    },
    advice: {
      gap: 6,
      paddingTop: 2,
    },
    adviceTitle: {
      ...typo.micro,
      color: colors.faint,
    },
    adviceRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 7,
    },
    adviceText: {
      ...typo.small,
      flex: 1,
      color: colors.inkSoft,
      lineHeight: 18,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    footerText: {
      ...typo.caption,
      flex: 1,
      color: colors.faint,
    },
    reload: {
      ...typo.smallStrong,
      color: colors.green,
    },
  });
