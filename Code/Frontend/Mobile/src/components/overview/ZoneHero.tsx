import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line } from "react-native-svg";

import type { LiveZone } from "../../api/types";
import { useTheme } from "../../providers/ThemeProvider";
import { font, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatNumber } from "../../utils/format";
import { AppIcon } from "../ui/AppIcon";
import { Panel } from "../ui/Panel";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 164;
const STROKE = 12;
const START = 150;
const SWEEP = 240;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC = (CIRCUMFERENCE * SWEEP) / 360;
const CENTER = SIZE / 2;

export function ZoneHero({
  zone,
  onOpen,
}: {
  zone: LiveZone | null;
  onOpen: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const moisture = zone?.moisture ?? null;
  const percent = Math.max(0, Math.min(100, moisture ?? 0));

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(percent / 100, { duration: 720 }));
  }, [percent, progress]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC * (1 - progress.value),
  }));

  if (!zone) {
    return (
      <Panel title="Khu vực" hint="Chưa có dữ liệu">
        <Text style={styles.empty}>Chưa có khu vườn nào được cấu hình.</Text>
      </Panel>
    );
  }

  const needsWater = moisture !== null && moisture < zone.threshold;
  const tone =
    moisture === null
      ? colors.faint
      : zone.pump
        ? colors.blue
        : needsWater
          ? colors.amber
          : colors.green;

  const status =
    moisture === null
      ? "Không có dữ liệu"
      : zone.pump
        ? "Đang tưới"
        : needsWater
          ? "Cần tưới"
          : "Đủ ẩm";

  const softTone =
    moisture === null
      ? colors.surfaceSunken
      : zone.pump
        ? colors.blueSoft
        : needsWater
          ? colors.amberSoft
          : colors.greenSoft;

  const tickAngle = START + (SWEEP * zone.threshold) / 100;
  const tickRad = (tickAngle * Math.PI) / 180;
  const tick = {
    x1: CENTER + Math.cos(tickRad) * (RADIUS - 9),
    y1: CENTER + Math.sin(tickRad) * (RADIUS - 9),
    x2: CENTER + Math.cos(tickRad) * (RADIUS + 7),
    y2: CENTER + Math.sin(tickRad) * (RADIUS + 7),
  };

  return (
    <Panel
      title={zone.name}
      style={styles.panel}
      action={
        <View style={[styles.statusPill, { backgroundColor: softTone }]}>
          <View style={[styles.statusDot, { backgroundColor: tone }]} />
          <Text style={[styles.statusText, { color: tone }]}>{status}</Text>
        </View>
      }
      footer={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xem chi tiết ${zone.name}`}
          onPress={onOpen}
          style={({ pressed }) => [
            styles.openRow,
            pressed && styles.openRowPressed,
          ]}
        >
          <Text style={styles.openText}>Xem chi tiết và chỉnh ngưỡng</Text>
          <AppIcon
            name="chevronRight"
            variant="outline"
            size={14}
            color={colors.greenStrong}
          />
        </Pressable>
      }
    >
      <View style={styles.stage}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={colors.line}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${ARC} ${CIRCUMFERENCE}`}
            strokeLinecap="round"
            transform={`rotate(${START} ${CENTER} ${CENTER})`}
          />

          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={tone}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${ARC} ${CIRCUMFERENCE}`}
            strokeLinecap="round"
            transform={`rotate(${START} ${CENTER} ${CENTER})`}
            animatedProps={arcProps}
          />

          <Line
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={colors.inkSoft}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </Svg>

        <View style={styles.center}>
          <Text style={styles.gaugeLabel}>Độ ẩm đất</Text>

          {moisture === null ? (
            <View style={styles.valuePlaceholder} />
          ) : (
            <View style={styles.valueRow}>
              <Text style={[styles.value, { color: tone }]}>
                {formatNumber(moisture, 0)}
              </Text>
              <Text style={[styles.unit, { color: tone }]}>%</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="Ngưỡng tưới" value={`${formatNumber(zone.threshold, 0)}%`} />
        <View style={styles.statDivider} />
        <Stat
          label="Lưu lượng"
          value={`${formatNumber(zone.flowLitersPerHour, 0)} L/giờ`}
        />
        <View style={styles.statDivider} />
        <Stat label="Mỗi lần" value={`${formatNumber(zone.targetLiters, 1)} L`} />
      </View>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    panel: {
      borderRadius: 16,
    },
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
      gap: 1,
    },
    gaugeLabel: {
      ...typo.micro,
      color: colors.faint,
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    value: {
      fontFamily: font.display,
      fontSize: 40,
      lineHeight: 46,
      letterSpacing: -1.6,
      fontVariant: ["tabular-nums"],
    },
    unit: {
      fontFamily: font.semibold,
      fontSize: 15,
      lineHeight: 24,
      marginTop: 4,
      marginLeft: 1,
    },
    valuePlaceholder: {
      width: 46,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.lineSoft,
      marginVertical: 20,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
    },
    statusDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    statusText: {
      ...typo.caption,
      fontFamily: font.semibold,
    },
    stats: {
      flexDirection: "row",
      alignItems: "stretch",
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
      paddingTop: 10,
    },
    stat: {
      flex: 1,
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 4,
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.lineSoft,
    },
    statLabel: {
      ...typo.micro,
      color: colors.faint,
      textAlign: "center",
    },
    statValue: {
      ...typo.smallStrong,
      color: colors.ink,
      fontVariant: ["tabular-nums"],
    },
    openRow: {
      minHeight: 24,
      paddingVertical: 4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    openRowPressed: {
      opacity: 0.6,
    },
    openText: {
      ...typo.caption,
      fontFamily: font.semibold,
      color: colors.greenStrong,
    },
    empty: {
      ...typo.small,
      color: colors.faint,
      textAlign: "center",
      paddingVertical: 18,
    },
  });
