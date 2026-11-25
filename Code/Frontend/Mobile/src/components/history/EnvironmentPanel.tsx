import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import type { HistorySample } from "../../api/types";
import { useTheme } from "../../providers/ThemeProvider";
import { font, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { AppIcon, type AppIconName } from "../ui/AppIcon";
import { Panel } from "../ui/Panel";

type EnvKey = "temperature" | "humidity" | "rain";

type EnvMetric = {
  label: string;
  unit: string;
  digits: number;
  percent: boolean;
  icon: AppIconName;
  tone: "amber" | "blue";
};

// Cảm biến môi trường gắn trên một ESP32 nên mọi khu dùng chung một số đo.
const ENV_METRICS: Record<EnvKey, EnvMetric> = {
  temperature: {
    label: "Nhiệt độ",
    unit: "°C",
    digits: 1,
    percent: false,
    icon: "temperature",
    tone: "amber",
  },
  humidity: {
    label: "Độ ẩm khí",
    unit: "%",
    digits: 0,
    percent: true,
    icon: "humidity",
    tone: "blue",
  },
  rain: {
    label: "Mưa",
    unit: "%",
    digits: 0,
    percent: true,
    icon: "rain",
    tone: "blue",
  },
};

const ENV_KEYS: EnvKey[] = ["temperature", "humidity", "rain"];
const SPARK_HEIGHT = 30;

type Point = { t: number; v: number };

function formatEnv(value: number | null, key: EnvKey): string {
  if (value === null) return "—";
  const config = ENV_METRICS[key];
  return `${value.toFixed(config.digits)}${config.unit}`;
}

function pointsFor(samples: HistorySample[], key: EnvKey): Point[] {
  return samples.flatMap((sample) => {
    const value = sample[key];
    return typeof value === "number" && Number.isFinite(value)
      ? [{ t: sample.recordedAt, v: value }]
      : [];
  });
}

export function EnvironmentPanel({
  samples,
  loading,
  error,
}: {
  samples: HistorySample[];
  loading: boolean;
  error: string | null;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const sparkWidth = Math.max(64, Math.floor((width - 82) / 3));

  return (
    <Panel index="03" title="Môi trường chung" hint="Dùng chung">
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        {ENV_KEYS.map((key) => {
          const config = ENV_METRICS[key];
          const color = colors[config.tone];
          const points = pointsFor(samples, key);
          const latest = points.length > 0 ? points[points.length - 1] : null;
          const values = points.map((point) => point.v);

          return (
            <View key={key} style={styles.cell}>
              <View style={styles.head}>
                <AppIcon name={config.icon} size={12} color={color} />
                <Text style={styles.label} numberOfLines={1}>
                  {config.label}
                </Text>
              </View>

              <Text style={styles.value}>{formatEnv(latest?.v ?? null, key)}</Text>

              {points.length > 0 ? (
                <Sparkline
                  points={points}
                  config={config}
                  color={color}
                  width={sparkWidth}
                  gradientId={`env-spark-${key}`}
                />
              ) : (
                <View style={[styles.sparkEmpty, { width: sparkWidth }]}>
                  <Text style={styles.empty}>{loading ? "Đang tải..." : "Chưa có"}</Text>
                </View>
              )}

              <Text style={styles.range} numberOfLines={1}>
                Thấp {formatEnv(values.length > 0 ? Math.min(...values) : null, key)}
              </Text>
              <Text style={styles.range} numberOfLines={1}>
                Cao {formatEnv(values.length > 0 ? Math.max(...values) : null, key)}
              </Text>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}

function Sparkline({
  points,
  config,
  color,
  width,
  gradientId,
}: {
  points: Point[];
  config: EnvMetric;
  color: string;
  width: number;
  gradientId: string;
}) {
  const height = SPARK_HEIGHT;
  const pad = 3;
  const plotWidth = width - pad * 2;
  const plotHeight = height - pad * 2;
  const baseline = pad + plotHeight;

  let min: number;
  let max: number;
  if (config.percent) {
    min = 0;
    max = 100;
  } else {
    const values = points.map((point) => point.v);
    min = Math.floor(Math.min(...values) - 2);
    max = Math.ceil(Math.max(...values) + 2);
    if (max - min < 5) {
      min -= 2;
      max += 2;
    }
  }

  const from = points[0].t;
  const span = Math.max(1, points[points.length - 1].t - from);
  const xAt = (timestamp: number) => pad + ((timestamp - from) / span) * plotWidth;
  const yAt = (value: number) => pad + (1 - (value - min) / (max - min)) * plotHeight;

  if (points.length === 1) {
    return (
      <Svg width={width} height={height}>
        <Circle cx={width / 2} cy={yAt(points[0].v)} r={2.5} fill={color} />
      </Svg>
    );
  }

  const coords = points.map((point) => ({ x: xAt(point.t), y: yAt(point.v) }));
  const line = coords
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${baseline} L ${coords[0].x.toFixed(1)} ${baseline} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#${gradientId})`} />
      <Path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    grid: {
      flexDirection: "row",
      gap: 8,
    },
    cell: {
      flex: 1,
      gap: 2,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    label: {
      flexShrink: 1,
      fontFamily: font.regular,
      fontSize: 10.5,
      lineHeight: 14,
      color: colors.muted,
    },
    value: {
      fontFamily: font.semibold,
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.2,
      fontVariant: ["tabular-nums"],
      color: colors.ink,
    },
    sparkEmpty: {
      height: SPARK_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
    },
    empty: {
      ...typo.caption,
      color: colors.faint,
    },
    range: {
      fontFamily: font.regular,
      fontSize: 9.5,
      lineHeight: 13,
      color: colors.faint,
    },
    error: {
      ...typo.small,
      color: colors.red,
    },
  });
