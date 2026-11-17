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
  useSharedValue,
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
import {
  HISTORY_RANGES,
  useHistory,
  type RangeKey,
} from "../../hooks/useHistory";
import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { font, radius, spacing, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatNumber } from "../../utils/format";
import { AppIcon, type AppIconName } from "../ui/AppIcon";
import { PressableScale } from "../ui/PressableScale";
import { Reveal } from "../ui/Reveal";
import { Sheet } from "../ui/Sheet";

const CHART_HEIGHT = 64;
const PAD = { top: 7, right: 7, bottom: 7, left: 2 };
const RANGES: RangeKey[] = ["1h", "24h", "7d"];

type MetricKey = "moisture" | "temperature" | "humidity" | "rain";

type Metric = {
  key: MetricKey;
  label: string;
  unit: string;
  digits: number;
  icon: AppIconName;
  color: "green" | "amber" | "blue" | "muted";
  hasThreshold?: boolean;
};

// Nhãn lấy đúng chữ đang dùng trên Web để hai nền tảng đọc như một.
const METRICS: Metric[] = [
  {
    key: "moisture",
    label: "Độ ẩm đất",
    unit: "%",
    digits: 0,
    icon: "water",
    color: "green",
    hasThreshold: true,
  },
  {
    key: "temperature",
    label: "Nhiệt độ",
    unit: "°C",
    digits: 1,
    icon: "temperature",
    color: "amber",
  },
  {
    key: "humidity",
    label: "Độ ẩm không khí",
    unit: "%",
    digits: 0,
    icon: "humidity",
    color: "blue",
  },
  {
    key: "rain",
    label: "Cảm biến mưa",
    unit: "%",
    digits: 0,
    icon: "rain",
    color: "muted",
  },
];

const AnimatedPath = Animated.createAnimatedComponent(Path);

function formatValue(value: number | null, metric: Metric): string {
  if (value === null) return "—";
  return `${formatNumber(value, metric.digits)}${metric.unit}`;
}

/** Nút gọn trên Tổng quan để mở bảng biểu đồ. */
export function ChartEntry({ onPress }: { onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel="Mở biểu đồ dữ liệu"
      accessibilityHint="Xem độ ẩm đất, nhiệt độ, độ ẩm không khí và cảm biến mưa"
      innerStyle={styles.teaser}
    >
      <View style={styles.teaserIcon}>
        <AppIcon name="chart" size={16} color={colors.greenStrong} />
      </View>

      <View style={styles.teaserText}>
        <Text style={styles.teaserTitle}>Biểu đồ dữ liệu</Text>
        <Text style={styles.teaserSub} numberOfLines={1}>
          Độ ẩm, nhiệt độ, không khí và mưa
        </Text>
      </View>

      <Text style={styles.teaserLink}>Mở</Text>
      <AppIcon
        name="chevronRight"
        variant="outline"
        size={13}
        color={colors.faint}
      />
    </PressableScale>
  );
}

export function ChartSheet({
  visible,
  onClose,
  onOpenHistory,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenHistory: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { deviceId, zones } = useGarden();

  const [zoneId, setZoneId] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("7d");

  const zone = zones.find((item) => item.id === zoneId) ?? zones[0];
  const activeZoneId = zone?.id ?? ZONE_IDS[0];

  const { samples, loading, error } = useHistory({
    deviceId,
    zoneId: activeZoneId,
    range,
  });

  return (
    <Sheet visible={visible} onClose={onClose} title="Biểu đồ dữ liệu">
      <Text style={styles.subtitle}>
        {zone ? zone.name : "Khu vườn"} · {HISTORY_RANGES[range].label} · 4 chỉ số
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.zoneChips}
      >
        {zones.map((item) => {
          const active = item.id === activeZoneId;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setZoneId(item.id)}
              style={[styles.zoneChip, active && styles.zoneChipActive]}
            >
              <Text
                style={[styles.zoneChipText, active && styles.zoneChipTextActive]}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.rangeRow}>
        {RANGES.map((key) => {
          const active = key === range;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setRange(key)}
              style={[styles.rangeChip, active && styles.rangeChipActive]}
            >
              <Text
                style={[styles.rangeText, active && styles.rangeTextActive]}
              >
                {HISTORY_RANGES[key].label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
      >
        {METRICS.map((metric, index) => (
          <Reveal key={metric.key} index={index}>
            <MetricCard
              metric={metric}
              samples={samples}
              range={range}
              loading={loading}
              error={error}
            />
          </Reveal>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở trang Lịch sử"
          onPress={onOpenHistory}
          style={styles.historyLink}
        >
          <AppIcon name="chart" size={14} color={colors.greenStrong} />
          <Text style={styles.historyText}>Xem lịch sử đầy đủ</Text>
          <AppIcon
            name="chevronRight"
            variant="outline"
            size={12}
            color={colors.greenStrong}
          />
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

function MetricCard({
  metric,
  samples,
  range,
  loading,
  error,
}: {
  metric: Metric;
  samples: ReturnType<typeof useHistory>["samples"];
  range: RangeKey;
  loading: boolean;
  error: string | null;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [chartWidth, setChartWidth] = useState(0);

  const color = colors[metric.color];

  const series = samples
    .map((sample) => ({
      time: sample.recordedAt,
      value: sample[metric.key],
    }))
    .filter(
      (item): item is { time: number; value: number } =>
        typeof item.value === "number" && Number.isFinite(item.value),
    );

  const values = series.map((item) => item.value);
  const current = values.length > 0 ? values[values.length - 1] : null;
  const average =
    values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  const min = values.length > 0 ? Math.min(...values) : null;
  const max = values.length > 0 ? Math.max(...values) : null;

  const threshold = metric.hasThreshold
    ? (samples[0]?.threshold ?? null)
    : null;

  let linePath = "";
  let areaPath = "";
  let lineLength = 0;
  let dot: { x: number; y: number } | null = null;
  let thresholdY: number | null = null;

  if (series.length > 1 && chartWidth > 0) {
    const scaleValues = threshold === null ? values : [...values, threshold];
    let low = Math.min(...scaleValues);
    let high = Math.max(...scaleValues);

    if (high - low < 1) {
      low -= metric.digits > 0 ? 0.8 : 4;
      high += metric.digits > 0 ? 0.8 : 4;
    } else {
      const padding = Math.max((high - low) * 0.16, 0.6);
      low -= padding;
      high += padding;
    }

    const innerWidth = chartWidth - PAD.left - PAD.right;
    const baseline = CHART_HEIGHT - PAD.bottom;
    const xAt = (index: number) =>
      PAD.left +
      (series.length === 1
        ? innerWidth / 2
        : (index / (series.length - 1)) * innerWidth);
    const yAt = (value: number) =>
      PAD.top + (1 - (value - low) / (high - low)) * (baseline - PAD.top);

    linePath = series
      .map(
        (item, index) =>
          `${index === 0 ? "M" : "L"} ${xAt(index).toFixed(1)} ${yAt(item.value).toFixed(1)}`,
      )
      .join(" ");

    areaPath = `${linePath} L ${xAt(series.length - 1).toFixed(1)} ${baseline} L ${xAt(0).toFixed(1)} ${baseline} Z`;
    dot = {
      x: xAt(series.length - 1),
      y: yAt(series[series.length - 1].value),
    };

    if (threshold !== null) {
      thresholdY = yAt(threshold);
    }

    for (let index = 1; index < series.length; index += 1) {
      lineLength += Math.hypot(
        xAt(index) - xAt(index - 1),
        yAt(series[index].value) - yAt(series[index - 1].value),
      );
    }
  }

  const draw = useSharedValue(0);

  useEffect(() => {
    draw.set(0);
    draw.set(withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [draw, linePath]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: lineLength * (1 - draw.value),
  }));

  const emptyText = loading
    ? "Đang tải..."
    : (error ?? `Chưa có dữ liệu trong ${HISTORY_RANGES[range].label}.`);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <AppIcon name={metric.icon} size={14} color={color} />
        </View>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {metric.label}
        </Text>

        <Text style={[styles.cardValue, { color }]}>
          {formatValue(current, metric)}
        </Text>
      </View>

      <View
        style={styles.chart}
        onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
      >
        {series.length > 1 && chartWidth > 0 ? (
          <>
            <Svg width={chartWidth} height={CHART_HEIGHT}>
              <Defs>
                <LinearGradient
                  id={`chart-fill-${metric.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <Stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <Stop offset="100%" stopColor={color} stopOpacity={0} />
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

              <Path d={areaPath} fill={`url(#chart-fill-${metric.key})`} />
              <AnimatedPath
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={lineLength > 0 ? `${lineLength}` : undefined}
                animatedProps={lineProps}
              />
            </Svg>

            {dot ? (
              <View
                style={[
                  styles.dot,
                  {
                    left: dot.x - 3.5,
                    top: dot.y - 3.5,
                    backgroundColor: color,
                  },
                ]}
              />
            ) : null}
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        )}
      </View>

      {values.length > 0 ? (
        <View style={styles.cardFoot}>
          <Text style={styles.footText}>
            TB {formatNumber(average, metric.digits)}
            {metric.unit} · {formatNumber(min, metric.digits)}–
            {formatNumber(max, metric.digits)}
            {metric.unit}
          </Text>

          {threshold !== null ? (
            <Text style={[styles.footText, { color: colors.amber }]}>
              Ngưỡng {formatNumber(threshold, 0)}%
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    teaser: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    teaserIcon: {
      width: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    teaserText: {
      flex: 1,
      gap: 1,
    },
    teaserTitle: {
      fontFamily: font.semibold,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink,
    },
    teaserSub: {
      ...typo.caption,
      color: colors.faint,
    },
    teaserLink: {
      ...typo.micro,
      color: colors.greenStrong,
    },
    subtitle: {
      ...typo.caption,
      color: colors.faint,
      marginTop: -6,
    },
    zoneChips: {
      gap: 6,
      paddingVertical: 2,
    },
    zoneChip: {
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.lineSoft,
      backgroundColor: colors.surfaceSunken,
    },
    zoneChipActive: {
      borderColor: colors.green,
      backgroundColor: colors.green,
    },
    zoneChipText: {
      ...typo.caption,
      color: colors.muted,
    },
    zoneChipTextActive: {
      color: colors.white,
    },
    rangeRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: -4,
    },
    rangeChip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSunken,
    },
    rangeChipActive: {
      backgroundColor: colors.greenSoft,
    },
    rangeText: {
      ...typo.caption,
      color: colors.muted,
    },
    rangeTextActive: {
      color: colors.greenStrong,
    },
    body: {
      flexGrow: 0,
    },
    bodyContent: {
      gap: 8,
      paddingBottom: 4,
    },
    card: {
      gap: 6,
      padding: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.lineSoft,
      backgroundColor: colors.surfaceSunken,
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    cardIcon: {
      width: 24,
      height: 24,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    cardTitle: {
      flex: 1,
      ...typo.smallStrong,
      color: colors.ink,
    },
    cardValue: {
      fontFamily: typo.metric.fontFamily,
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.3,
    },
    chart: {
      height: CHART_HEIGHT,
      justifyContent: "center",
    },
    dot: {
      position: "absolute",
      width: 7,
      height: 7,
      borderRadius: 999,
      borderWidth: 1.4,
      borderColor: colors.surfaceSunken,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      ...typo.caption,
      color: colors.faint,
    },
    cardFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    footText: {
      ...typo.caption,
      color: colors.faint,
    },
    historyLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
    },
    historyText: {
      ...typo.caption,
      color: colors.greenStrong,
    },
  });
