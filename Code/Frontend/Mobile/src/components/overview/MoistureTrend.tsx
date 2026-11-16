import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

import { ZONE_IDS } from "../../api/types";
import { useHistory } from "../../hooks/useHistory";
import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { radius, spacing, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatNumber } from "../../utils/format";
import { AppIcon } from "../ui/AppIcon";

const CHART_HEIGHT = 96;
const PAD = { top: 12, right: 10, bottom: 8, left: 2 };

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Sparkline 7 ngày của khu đang chọn. Card này cố tình gọn: một đường,
 * một ngưỡng, ba con số — đủ để liếc nhanh mà không lấn át nút chế độ.
 */
export function MoistureTrend({ onOpenHistory }: { onOpenHistory: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { deviceId, zones, deviceOnline } = useGarden();

  const [zoneId, setZoneId] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const zone = zones.find((item) => item.id === zoneId) ?? zones[0];
  const activeZoneId = zone?.id ?? ZONE_IDS[0];

  const { samples, loading, error } = useHistory({
    deviceId,
    zoneId: activeZoneId,
    range: "7d",
  });

  const series = samples
    .map((sample) => ({ time: sample.recordedAt, value: sample.moisture }))
    .filter(
      (item): item is { time: number; value: number } =>
        Number.isFinite(item.value),
    );

  const pulse = useSharedValue(0);
  const draw = useSharedValue(0);

  useEffect(() => {
    if (!deviceOnline) {
      pulse.set(0);
      return;
    }
    pulse.set(
      withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [deviceOnline, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value,
    transform: [{ scale: 1 + pulse.value * 1.9 }],
  }));

  const threshold = samples[0]?.threshold ?? zone?.threshold ?? null;
  const values = series.map((item) => item.value);
  const average =
    values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  const last = values.length > 0 ? values[values.length - 1] : null;
  const current = deviceOnline && zone?.moisture !== null ? zone?.moisture : last;

  let linePath = "";
  let areaPath = "";
  let dot: { x: number; y: number } | null = null;
  let lineLength = 0;

  if (series.length > 0 && chartWidth > 0) {
    const scaleValues =
      threshold === null ? values : [...values, threshold];
    let min = Math.min(...scaleValues);
    let max = Math.max(...scaleValues);
    if (max - min < 1) {
      min -= 6;
      max += 6;
    } else {
      const padding = Math.max((max - min) * 0.16, 2);
      min -= padding;
      max += padding;
    }

    const innerWidth = chartWidth - PAD.left - PAD.right;
    const baseline = CHART_HEIGHT - PAD.bottom;
    const xAt = (index: number) =>
      PAD.left +
      (series.length === 1
        ? innerWidth / 2
        : (index / (series.length - 1)) * innerWidth);
    const yAt = (value: number) =>
      PAD.top + (1 - (value - min) / (max - min)) * (baseline - PAD.top);

    linePath = series
      .map(
        (item, index) =>
          `${index === 0 ? "M" : "L"} ${xAt(index).toFixed(1)} ${yAt(item.value).toFixed(1)}`,
      )
      .join(" ");

    areaPath = `${linePath} L ${xAt(series.length - 1).toFixed(1)} ${baseline} L ${xAt(0).toFixed(1)} ${baseline} Z`;
    dot = { x: xAt(series.length - 1), y: yAt(series[series.length - 1].value) };

    for (let index = 1; index < series.length; index += 1) {
      lineLength += Math.hypot(
        xAt(index) - xAt(index - 1),
        yAt(series[index].value) - yAt(series[index - 1].value),
      );
    }
  }

  // Nét vẽ tự "chạy" từ trái sang khi có dữ liệu mới hoặc đổi khu.
  useEffect(() => {
    draw.set(0);
    draw.set(withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }));
  }, [draw, linePath]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: lineLength * (1 - draw.value),
  }));

  const thresholdY =
    threshold !== null && chartWidth > 0 && series.length > 0
      ? (() => {
          const scaleValues = [...values, threshold];
          let min = Math.min(...scaleValues);
          let max = Math.max(...scaleValues);
          if (max - min < 1) {
            min -= 6;
            max += 6;
          } else {
            const padding = Math.max((max - min) * 0.16, 2);
            min -= padding;
            max += padding;
          }
          return (
            PAD.top +
            (1 - (threshold - min) / (max - min)) *
              (CHART_HEIGHT - PAD.bottom - PAD.top)
          );
        })()
      : null;

  const stale = !deviceOnline && values.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Độ ẩm đất</Text>
          <Text style={styles.subtitle}>
            {zone ? zone.name : "Khu vườn"} · 7 ngày
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở trang Lịch sử"
          onPress={onOpenHistory}
          hitSlop={8}
          style={styles.link}
        >
          <Text style={styles.linkText}>Lịch sử</Text>
          <AppIcon
            name="chevronRight"
            variant="outline"
            size={12}
            color={colors.greenStrong}
          />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {zones.map((item) => {
          const active = item.id === activeZoneId;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setZoneId(item.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        style={styles.chart}
        onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
      >
        {values.length > 1 && chartWidth > 0 ? (
          <>
            <Svg width={chartWidth} height={CHART_HEIGHT}>
              <Defs>
                <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={colors.green} stopOpacity={0.24} />
                  <Stop offset="100%" stopColor={colors.green} stopOpacity={0} />
                </LinearGradient>
              </Defs>

              {thresholdY !== null ? (
                <Line
                  x1={PAD.left}
                  x2={chartWidth - PAD.right}
                  y1={thresholdY}
                  y2={thresholdY}
                  stroke={colors.amber}
                  strokeWidth={1}
                  strokeDasharray="4 5"
                />
              ) : null}

              <Path d={areaPath} fill="url(#trendFill)" />
              <AnimatedPath
                d={linePath}
                fill="none"
                stroke={colors.green}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={lineLength > 0 ? `${lineLength}` : undefined}
                animatedProps={lineProps}
              />
            </Svg>

            {dot ? (
              <View style={[styles.dotWrap, { left: dot.x - 5, top: dot.y - 5 }]}>
                {deviceOnline ? (
                  <Animated.View style={[styles.dotRing, pulseStyle]} />
                ) : null}
                <View style={styles.dot} />
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading
                ? "Đang tải lịch sử..."
                : error
                  ? error
                  : "Không có dữ liệu trong 7 ngày."}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.stats}>
        <Stat
          label="Hiện tại"
          value={current === null || current === undefined ? "--" : `${formatNumber(current, 0)}%`}
          strong
        />
        <Stat
          label="Trung bình"
          value={average === null ? "--" : `${formatNumber(average, 0)}%`}
        />
        <Stat
          label="Thấp nhất"
          value={values.length === 0 ? "--" : `${formatNumber(Math.min(...values), 0)}%`}
        />
        {stale ? <Text style={styles.stale}>Dữ liệu đã cũ</Text> : null}
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, strong && styles.statValueStrong]}>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      gap: 8,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    title: {
      ...typo.section,
      color: colors.ink,
    },
    subtitle: {
      ...typo.caption,
      color: colors.faint,
    },
    link: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingTop: 2,
    },
    linkText: {
      ...typo.caption,
      color: colors.greenStrong,
    },
    chips: {
      gap: 6,
      paddingVertical: 2,
    },
    chip: {
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.lineSoft,
      backgroundColor: colors.surfaceSunken,
    },
    chipActive: {
      borderColor: colors.green,
      backgroundColor: colors.green,
    },
    chipText: {
      ...typo.caption,
      color: colors.muted,
    },
    chipTextActive: {
      color: colors.white,
    },
    chart: {
      height: CHART_HEIGHT,
      justifyContent: "center",
    },
    dotWrap: {
      position: "absolute",
      width: 10,
      height: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    dotRing: {
      position: "absolute",
      width: 10,
      height: 10,
      borderRadius: 999,
      borderWidth: 1.4,
      borderColor: colors.green,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor: colors.green,
      borderWidth: 1.4,
      borderColor: colors.surface,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSunken,
    },
    emptyText: {
      ...typo.caption,
      color: colors.faint,
    },
    stats: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 14,
    },
    stat: {
      gap: 1,
    },
    statLabel: {
      ...typo.caption,
      color: colors.faint,
    },
    statValue: {
      ...typo.smallStrong,
      color: colors.ink,
    },
    statValueStrong: {
      ...typo.section,
      color: colors.greenStrong,
    },
    stale: {
      ...typo.caption,
      color: colors.amber,
      marginLeft: "auto",
    },
  });
