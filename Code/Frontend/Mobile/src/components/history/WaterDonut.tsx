import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import type { GardenZone, ZoneWateringSummary } from "../../api/types";
import { useTheme } from "../../providers/ThemeProvider";
import { font, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { Panel } from "../ui/Panel";

const SIZE = 132;
const CENTER = SIZE / 2;
const RADIUS = 50;
const STROKE = 13;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatLiters(value: number): string {
  if (value <= 0) return "0 L";
  if (value >= 10) return `${Math.round(value)} L`;
  return `${value.toFixed(1)} L`;
}

// Chia phần trăm theo largest-remainder để tổng luôn đúng 100% sau làm tròn.
function percentShares(liters: number[]): number[] {
  const total = liters.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return liters.map(() => 0);

  const raw = liters.map((value) => (value / total) * 100);
  const rounded = raw.map(Math.floor);
  let remainder = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const byFraction = raw
    .map((value, index) => ({ index, fraction: value - rounded[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < byFraction.length && remainder > 0; i += 1) {
    rounded[byFraction[i].index] += 1;
    remainder -= 1;
  }
  return rounded;
}

export function WaterDonut({
  zones,
  byZone,
}: {
  zones: GardenZone[];
  byZone: Record<string, ZoneWateringSummary>;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const sliceColors = [
    colors.green,
    colors.blue,
    colors.amber,
    "#8b6cf3",
    "#d97757",
    "#2f9e73",
  ];

  const slices = zones.map((zone, index) => ({
    id: zone.id,
    label: zone.name.trim() || zone.id,
    liters: Math.max(0, byZone[zone.id]?.todayLiters ?? 0),
    color: sliceColors[index % sliceColors.length],
  }));
  const total = slices.reduce((sum, slice) => sum + slice.liters, 0);
  const percents = percentShares(slices.map((slice) => slice.liters));
  const gap = slices.filter((slice) => slice.liters > 0).length > 1 ? 2 : 0;

  const arcs = slices
    .filter((slice) => slice.liters > 0)
    .map((slice, index, active) => {
      const dash = (slice.liters / total) * CIRCUMFERENCE;
      const offset = active
        .slice(0, index)
        .reduce((sum, item) => sum + (item.liters / total) * CIRCUMFERENCE, 0);
      return { ...slice, dash: Math.max(0, dash - gap), offset };
    });

  return (
    <Panel index="04" title="Nước tưới hôm nay" hint="Theo khu">
      <View style={styles.stage}>
        <Svg width={SIZE} height={SIZE} accessibilityLabel="Lượng nước tưới hôm nay theo khu">
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={colors.lineSoft}
            strokeWidth={STROKE}
            fill="none"
          />
          {arcs.map((arc) => (
            <Circle
              key={arc.id}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
              strokeDashoffset={-arc.offset}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          ))}
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <Text style={styles.total}>{formatLiters(total)}</Text>
          <Text style={styles.totalLabel}>hôm nay</Text>
        </View>
      </View>

      {total === 0 ? (
        <Text style={styles.empty}>Chưa có nước tưới trong hôm nay.</Text>
      ) : (
        <View style={styles.legend}>
          {slices.map((slice, index) => (
            <View
              key={slice.id}
              style={[styles.legendRow, slice.liters === 0 && styles.legendRowZero]}
            >
              <View style={[styles.dot, { backgroundColor: slice.color }]} />
              <Text style={styles.legendName} numberOfLines={1}>
                {slice.id} · {slice.label}
              </Text>
              <Text style={styles.legendValue}>{formatLiters(slice.liters)}</Text>
              <Text style={styles.legendPct}>{`${percents[index]}%`}</Text>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    stage: {
      alignSelf: "center",
      width: SIZE,
      height: SIZE,
      justifyContent: "center",
    },
    center: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    total: {
      fontFamily: font.semibold,
      fontSize: 19,
      lineHeight: 24,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
      color: colors.ink,
    },
    totalLabel: {
      ...typo.caption,
      color: colors.faint,
    },
    empty: {
      ...typo.small,
      color: colors.faint,
      textAlign: "center",
    },
    legend: {
      gap: 6,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    legendRowZero: {
      opacity: 0.45,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendName: {
      flex: 1,
      ...typo.small,
      color: colors.inkSoft,
    },
    legendValue: {
      ...typo.smallStrong,
      color: colors.ink,
      fontVariant: ["tabular-nums"],
    },
    legendPct: {
      ...typo.caption,
      width: 34,
      textAlign: "right",
      color: colors.faint,
      fontVariant: ["tabular-nums"],
    },
  });
