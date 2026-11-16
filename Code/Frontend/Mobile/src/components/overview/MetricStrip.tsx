import { StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { radius, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatNumber } from "../../utils/format";
import { AppIcon, type AppIconName } from "../ui/AppIcon";

const NO_DATA = "Không có dữ liệu";

export function MetricStrip() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { telemetry, deviceOnline } = useGarden();

  const temperature =
    deviceOnline && telemetry?.temperature != null
      ? `${formatNumber(telemetry.temperature, 1)}°`
      : null;

  const humidity =
    deviceOnline && telemetry?.humidity != null
      ? `${formatNumber(telemetry.humidity, 0)}%`
      : null;

  const rain =
    deviceOnline && telemetry ? `${formatNumber(telemetry.rain, 0)}%` : null;

  return (
    <View style={styles.row}>
      <MetricTile
        label="Nhiệt độ"
        icon="temperature"
        accent={colors.amber}
        value={temperature}
      />

      <MetricTile
        label="Độ ẩm khí"
        icon="humidity"
        accent={colors.blue}
        value={humidity}
      />

      <MetricTile
        label="Mưa"
        icon="rain"
        accent={colors.blue}
        value={rain}
        hint={deviceOnline && telemetry ? (telemetry.raining ? "Đang mưa" : "Khô ráo") : undefined}
      />
    </View>
  );
}

function MetricTile({
  label,
  icon,
  accent,
  value,
  hint,
}: {
  label: string;
  icon: AppIconName;
  accent: string;
  value: string | null;
  hint?: string;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.tile}>
      <View style={styles.head}>
        <AppIcon name={icon} size={14} color={accent} />
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <Text
        style={[styles.value, value === null && styles.valueEmpty]}
        numberOfLines={2}
      >
        {value ?? NO_DATA}
      </Text>

      {value !== null && hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 8,
    },
    tile: {
      flex: 1,
      minHeight: 82,
      padding: 11,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      justifyContent: "space-between",
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    label: {
      flex: 1,
      ...typo.caption,
      color: colors.muted,
    },
    value: {
      ...typo.metric,
      color: colors.ink,
    },
    valueEmpty: {
      ...typo.small,
      color: colors.faint,
      lineHeight: 14,
    },
    hint: {
      ...typo.caption,
      color: colors.faint,
    },
  });
