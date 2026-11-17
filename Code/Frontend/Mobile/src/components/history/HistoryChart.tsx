import { useEffect } from "react";
import { useIsFocused } from "expo-router";
import { useWindowDimensions, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import type { HistoryResponse } from "../../api/types";
import type { RangeKey } from "../../hooks/useHistory";
import { useTheme } from "../../providers/ThemeProvider";
import { typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatShortTime } from "../../utils/format";
import { AnimatedNumber } from "../ui/AnimatedNumber";

export type HistoryMetric = "moisture" | "temperature" | "humidity" | "rain";

export const HISTORY_METRICS: Record<
  HistoryMetric,
  { label: string; unit: string; digits: number }
> = {
  moisture: { label: "Độ ẩm đất", unit: "%", digits: 0 },
  temperature: { label: "Nhiệt độ", unit: "°C", digits: 1 },
  humidity: { label: "Độ ẩm khí", unit: "%", digits: 0 },
  rain: { label: "Cảm biến mưa", unit: "%", digits: 0 },
};

const CHART_HEIGHT = 200;
const PAD = { left: 34, right: 12, top: 14, bottom: 24 };
const AnimatedPath = Animated.createAnimatedComponent(Path);

type SeriesPoint = { time: number; value: number };

function metricColor(metric: HistoryMetric, colors: Palette): string {
  switch (metric) {
    case "temperature":
      return colors.amber;
    case "humidity":
    case "rain":
      return colors.blue;
    default:
      return colors.green;
  }
}

function formatValue(value: number, metric: HistoryMetric): string {
  return `${value.toFixed(HISTORY_METRICS[metric].digits)}${HISTORY_METRICS[metric].unit}`;
}

export function HistoryChart({
  response,
  metric,
  range,
  loading,
  error,
}: {
  response: HistoryResponse;
  metric: HistoryMetric;
  range: RangeKey;
  loading: boolean;
  error: string | null;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(720, Math.max(260, width - 64));
  const lineColor = metricColor(metric, colors);

  const samples = response.samples;
  const series = samples
    .map((sample) => ({ time: sample.recordedAt, value: sample[metric] }))
    .filter(
      (item): item is SeriesPoint =>
        item.value !== null && Number.isFinite(item.value),
    );
  const points = series.map((item) => item.value);

  if (loading && points.length === 0) {
    return (
      <View style={styles.state}>
        <Text style={styles.stateText}>Đang tải lịch sử...</Text>
      </View>
    );
  }

  if (error && points.length === 0) {
    return (
      <View style={styles.state}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (points.length === 0) {
    return (
      <View style={styles.state}>
        <Text style={styles.stateText}>
          Chưa có dữ liệu trong khoảng này. Dữ liệu sẽ xuất hiện sau khi ESP32 gửi telemetry.
        </Text>
      </View>
    );
  }

  return (
    <ChartPlot
      samples={samples}
      series={series}
      points={points}
      metric={metric}
      range={range}
      chartWidth={chartWidth}
      lineColor={lineColor}
    />
  );
}

function ChartPlot({
  samples,
  series,
  points,
  metric,
  range,
  chartWidth,
  lineColor,
}: {
  samples: HistoryResponse["samples"];
  series: SeriesPoint[];
  points: number[];
  metric: HistoryMetric;
  range: RangeKey;
  chartWidth: number;
  lineColor: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const draw = useSharedValue(reduced ? 1 : 0);

  const threshold = metric === "moisture" ? samples[0].threshold : null;
  const scaleValues = threshold === null ? points : [...points, threshold];
  let min = Math.min(...scaleValues);
  let max = Math.max(...scaleValues);

  if (max - min < 1) {
    min -= 5;
    max += 5;
  } else {
    const padding = (max - min) * 0.12;
    min -= padding;
    max += padding;
  }

  const baseline = CHART_HEIGHT - PAD.bottom;
  const innerWidth = chartWidth - PAD.left - PAD.right;
  const xAt = (index: number) =>
    PAD.left +
    (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const yAt = (value: number) =>
    PAD.top + (1 - (value - min) / (max - min)) * (baseline - PAD.top);

  const linePath = points
    .map((value, index) => `${index === 0 ? "M" : "L"} ${xAt(index).toFixed(1)} ${yAt(value).toFixed(1)}`)
    .join(" ");
  const areaPath =
    points.length > 1
      ? `${linePath} L ${xAt(points.length - 1).toFixed(1)} ${baseline} L ${xAt(0).toFixed(1)} ${baseline} Z`
      : "";
  const lineLength = points
    .slice(1)
    .reduce(
      (total, value, index) =>
        total + Math.hypot(xAt(index + 1) - xAt(index), yAt(value) - yAt(points[index])),
      0,
    );

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: lineLength * (1 - draw.value),
  }));

  useEffect(() => {
    if (reduced) {
      draw.set(1);
      return;
    }
    if (!focused) return;
    draw.set(0);
    draw.set(withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
  }, [draw, focused, linePath, reduced]);

  const ticks = [max, (max + min) / 2, min];
  const xLabels = [0, Math.floor((series.length - 1) / 2), series.length - 1]
    .filter((index, position, list) => index >= 0 && list.indexOf(index) === position)
    .map((index) => ({ index, time: series[index].time }));

  const average = points.reduce((sum, value) => sum + value, 0) / points.length;

  return (
    <View style={styles.wrapper}>
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {ticks.map((tick, index) => (
          <Line
            key={`grid-${index}`}
            x1={PAD.left}
            x2={chartWidth - PAD.right}
            y1={yAt(tick)}
            y2={yAt(tick)}
            stroke={colors.lineSoft}
            strokeWidth={1}
          />
        ))}

        {ticks.map((tick, index) => (
          <SvgText
            key={`label-${index}`}
            x={PAD.left - 6}
            y={yAt(tick) + 3}
            textAnchor="end"
            fontSize={9.5}
            fill={colors.faint}
          >
            {tick.toFixed(HISTORY_METRICS[metric].digits)}
          </SvgText>
        ))}

        {areaPath ? <Path d={areaPath} fill="url(#historyFill)" /> : null}

        {threshold !== null && (
          <Line
            x1={PAD.left}
            x2={chartWidth - PAD.right}
            y1={yAt(threshold)}
            y2={yAt(threshold)}
            stroke={colors.amber}
            strokeWidth={1.2}
            strokeDasharray="5 6"
          />
        )}

        <AnimatedPath
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={lineLength > 0 ? `${lineLength}` : undefined}
          animatedProps={lineProps}
        />

        {points.length <= 40 &&
          points.map((value, index) => (
            <Circle
              key={`point-${index}`}
              cx={xAt(index)}
              cy={yAt(value)}
              r={2}
              fill={lineColor}
            />
          ))}

        {xLabels.map((label, index) => (
          <SvgText
            key={`time-${index}`}
            x={xAt(label.index)}
            y={CHART_HEIGHT - 6}
            textAnchor={index === 0 ? "start" : index === xLabels.length - 1 ? "end" : "middle"}
            fontSize={9.5}
            fill={colors.faint}
          >
            {formatShortTime(label.time, range === "7d")}
          </SvgText>
        ))}
      </Svg>

      <View style={styles.stats}>
        <Text style={styles.stat}>
          Thấp nhất{" "}
          <AnimatedNumber
            value={Math.min(...points)}
            format={(value) => formatValue(value, metric)}
            style={styles.statValue}
          />
        </Text>
        <Text style={styles.stat}>
          Cao nhất{" "}
          <AnimatedNumber
            value={Math.max(...points)}
            format={(value) => formatValue(value, metric)}
            style={styles.statValue}
          />
        </Text>
        <Text style={styles.stat}>
          Trung bình{" "}
          <AnimatedNumber
            value={average}
            format={(value) => formatValue(value, metric)}
            style={styles.statValue}
          />
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    wrapper: {
      marginTop: 8,
    },
    state: {
      minHeight: 160,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    stateText: {
      ...typo.small,
      color: colors.faint,
      textAlign: "center",
    },
    errorText: {
      ...typo.small,
      color: colors.red,
      textAlign: "center",
    },
    stats: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 8,
    },
    stat: {
      ...typo.caption,
      color: colors.muted,
    },
    statValue: {
      ...typo.smallStrong,
      color: colors.inkSoft,
    },
  });
