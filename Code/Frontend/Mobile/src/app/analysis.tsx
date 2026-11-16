import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ZONE_IDS } from "@/api/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { Card } from "@/components/ui/Card";
import { ChipRow } from "@/components/ui/ChipRow";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ZonePicker } from "@/components/zones/ZonePicker";
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
    loading,
    configError,
    reloadConfig,
    deviceOnline,
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
        success: { bg: colors.greenSoft, fg: colors.greenStrong },
        warning: { bg: colors.amberSoft, fg: colors.amber },
        error: { bg: colors.redSoft, fg: colors.red },
        neutral: { bg: colors.surfaceSunken, fg: colors.muted },
      }[analysis.tone]
    : null;

  const currentPct =
    analysis?.current === null || analysis?.current === undefined
      ? null
      : clamp(analysis.current, 0, 100);

  return (
    <Screen>
      <PageHeader
        title="Phân tích"
        subtitle="Chẩn đoán độ ẩm đất theo ngưỡng tưới của từng khu vườn."
      />

      <Card>
        <SectionHeader title="Khu vườn" hint={zone ? zone.crop : undefined} />
        {loading && zones.length === 0 ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.green} />
            <Text style={styles.loadingText}>Đang tải danh sách khu vườn...</Text>
          </View>
        ) : configError && zones.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.errorText}>{configError}</Text>
            <Pressable accessibilityRole="button" onPress={reloadConfig} hitSlop={8}>
              <Text style={styles.retry}>Thử lại</Text>
            </Pressable>
          </View>
        ) : (
          <ZonePicker zones={zones} value={activeZoneId} onChange={setZoneId} />
        )}
      </Card>

      {analysis && zone && toneColors ? (
        <Card>
          <SectionHeader
            title={zone.name}
            hint={HISTORY_RANGES[range].label.toUpperCase()}
          />

          <ChipRow options={RANGE_OPTIONS} value={range} onChange={setRange} />

          <View style={[styles.verdict, { backgroundColor: toneColors.bg }]}>
            <View style={styles.verdictHead}>
              <AppIcon
                name={TONE_ICON[analysis.tone]}
                size={18}
                color={toneColors.fg}
              />
              <Text style={[styles.verdictTitle, { color: toneColors.fg }]}>
                {analysis.headline}
              </Text>
            </View>
            <Text style={styles.summary}>{analysis.summary}</Text>
          </View>

          <View style={styles.bandBlock}>
            <View style={styles.bandHead}>
              <Text style={styles.bandLabel}>Độ ẩm hiện tại</Text>
              <Text style={styles.bandValue}>
                {analysis.current === null
                  ? "Chưa có dữ liệu"
                  : `${formatNumber(analysis.current, 0)}%`}
              </Text>
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
            <Stat
              label="Trong ngưỡng"
              value={
                analysis.inSafePct === null
                  ? "--"
                  : `${formatNumber(analysis.inSafePct, 0)}%`
              }
            />
            <Stat
              label="Trung bình"
              value={
                analysis.average === null
                  ? "--"
                  : `${formatNumber(analysis.average, 0)}%`
              }
            />
          </View>

          <View style={styles.statRow}>
            <Stat
              label="Thấp nhất"
              value={
                analysis.min === null ? "--" : `${formatNumber(analysis.min, 0)}%`
              }
            />
            <Stat
              label="Cao nhất"
              value={
                analysis.max === null ? "--" : `${formatNumber(analysis.max, 0)}%`
              }
            />
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
        </Card>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
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
      ...typo.caption,
      color: colors.faint,
    },
    state: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
    },
    errorText: {
      ...typo.small,
      color: colors.red,
      textAlign: "center",
    },
    retry: {
      ...typo.smallStrong,
      color: colors.green,
    },
    verdict: {
      padding: 14,
      borderRadius: 14,
      gap: 6,
      marginTop: 10,
    },
    verdictHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    verdictTitle: {
      ...typo.section,
    },
    summary: {
      ...typo.small,
      color: colors.inkSoft,
      lineHeight: 18,
    },
    bandBlock: {
      gap: 8,
      paddingTop: 2,
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
      height: 10,
      borderRadius: 999,
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
      borderRadius: 999,
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
      gap: 8,
    },
    stat: {
      flex: 1,
      padding: 11,
      borderRadius: 12,
      backgroundColor: colors.surfaceSunken,
      gap: 2,
    },
    statLabel: {
      ...typo.caption,
      color: colors.muted,
    },
    statValue: {
      ...typo.bodyStrong,
      color: colors.ink,
    },
    advice: {
      gap: 6,
      paddingTop: 2,
    },
    adviceTitle: {
      ...typo.caption,
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
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
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
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
