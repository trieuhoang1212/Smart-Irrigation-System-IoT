import { StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { font, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatNumber } from "../../utils/format";
import { AppIcon, type AppIconName } from "../ui/AppIcon";

const NO_DATA = "—";

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
        divider
      />

      <MetricTile
        label="Mưa"
        icon="rain"
        accent={colors.blue}
        value={rain}
        hint={
          deviceOnline && telemetry
            ? telemetry.raining
              ? "Đang mưa"
              : "Khô ráo"
            : undefined
        }
        divider
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
  divider = false,
}: {
  label: string;
  icon: AppIconName;
  accent: string;
  value: string | null;
  hint?: string;
  divider?: boolean;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.tile, divider && styles.tileDivider]}>
      <View style={styles.head}>
        <AppIcon name={icon} size={13} color={accent} />
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
    },
    tile: {
      flex: 1,
      minHeight: 78,
      paddingTop: 11,
      paddingRight: 10,
      gap: 3,
    },
    tileDivider: {
      paddingLeft: 12,
      borderLeftWidth: 1,
      borderLeftColor: colors.lineSoft,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    label: {
      flex: 1,
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.muted,
    },
    value: {
      fontFamily: font.display,
      fontSize: 26,
      lineHeight: 30,
      letterSpacing: -0.4,
      fontVariant: ["tabular-nums"],
      color: colors.ink,
    },
    valueEmpty: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 15,
      letterSpacing: 0,
      color: colors.faint,
    },
    hint: {
      fontFamily: font.regular,
      fontSize: 10.5,
      lineHeight: 14,
      color: colors.faint,
    },
  });
