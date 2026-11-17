import { StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { font, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { clamp } from "../../utils/format";
import { AppIcon } from "../ui/AppIcon";
import { Toggle } from "../ui/Toggle";

export function EnvRow() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const {
    telemetry,
    deviceOnline,
    weatherGate,
    toggleWeatherGate,
    pending,
  } = useGarden();

  const distance = deviceOnline ? (telemetry?.tank.distanceCm ?? null) : null;
  const tankEmpty = deviceOnline ? Boolean(telemetry?.tank.empty) : false;
  const percent =
    distance === null
      ? null
      : clamp(Math.round(100 - distance), 0, 100);

  const tankTone =
    percent === null
      ? colors.faint
      : tankEmpty || percent <= 25
        ? colors.red
        : colors.green;

  const tankStatus =
    percent === null
      ? "Chưa có số đo"
      : tankEmpty
        ? "Bồn cạn nước"
        : percent <= 25
          ? "Sắp hết nước"
          : "Đủ nước tưới";

  return (
    <View style={styles.row}>
      <View style={styles.cell}>
        <View style={styles.head}>
          <AppIcon name="water" size={13} color={tankTone} />
          <Text style={styles.label}>Bồn nước</Text>
        </View>

        <Text
          style={[styles.value, percent === null && styles.valueEmpty]}
          numberOfLines={1}
        >
          {percent === null ? "—" : `${percent}%`}
        </Text>

        <View style={styles.bar}>
          <View
            style={[
              styles.barFill,
              { width: `${percent ?? 0}%`, backgroundColor: tankTone },
            ]}
          />
        </View>

        <Text
          style={[styles.caption, percent !== null && { color: tankTone }]}
          numberOfLines={1}
        >
          {tankStatus}
        </Text>
      </View>

      <View style={[styles.cell, styles.cellDivider]}>
        <View style={styles.head}>
          <AppIcon name="rain" size={13} color={colors.blue} />
          <Text style={styles.label}>Chặn mưa</Text>

          <View style={styles.headSpacer} />

          <Toggle
            label="Chặn tưới khi mưa"
            value={weatherGate}
            disabled={!deviceOnline || Boolean(pending)}
            onChange={() => void toggleWeatherGate()}
          />
        </View>

        <Text style={styles.value} numberOfLines={1}>
          {weatherGate ? "Đang bật" : "Đang tắt"}
        </Text>

        <Text style={styles.caption} numberOfLines={2}>
          Tự dừng tưới khi cảm biến phát hiện nước
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    cell: {
      flex: 1,
      gap: 3,
      paddingRight: 10,
    },
    cellDivider: {
      paddingRight: 0,
      paddingLeft: 12,
      borderLeftWidth: 1,
      borderLeftColor: colors.lineSoft,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    headSpacer: {
      flex: 1,
    },
    label: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.muted,
    },
    value: {
      fontFamily: font.semibold,
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.2,
      color: colors.ink,
    },
    valueEmpty: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 20,
      letterSpacing: 0,
      color: colors.faint,
    },
    bar: {
      height: 2,
      backgroundColor: colors.lineSoft,
      overflow: "hidden",
    },
    barFill: {
      height: "100%",
    },
    caption: {
      fontFamily: font.regular,
      fontSize: 10.5,
      lineHeight: 14,
      color: colors.faint,
    },
  });
