import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { radius, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { clamp } from "../../utils/format";
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
      <View style={styles.tile}>
        <View style={styles.head}>
          <Ionicons name="water-outline" size={13} color={tankTone} />
          <Text style={styles.label}>Bồn nước</Text>
        </View>

        <Text
          style={[styles.value, percent === null && styles.valueEmpty]}
          numberOfLines={1}
        >
          {percent === null ? "Không có dữ liệu" : `${percent}%`}
        </Text>

        <View style={styles.bar}>
          <View
            style={[
              styles.barFill,
              { width: `${percent ?? 0}%`, backgroundColor: tankTone },
            ]}
          />
        </View>

        <Text style={[styles.caption, percent !== null && { color: tankTone }]} numberOfLines={1}>
          {tankStatus}
        </Text>
      </View>

      <View style={styles.tile}>
        <View style={styles.head}>
          <Ionicons name="rainy-outline" size={13} color={colors.blue} />
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
      gap: 8,
    },
    tile: {
      flex: 1,
      minHeight: 92,
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
    headSpacer: {
      flex: 1,
    },
    label: {
      ...typo.caption,
      color: colors.muted,
    },
    value: {
      ...typo.section,
      color: colors.ink,
    },
    valueEmpty: {
      ...typo.small,
      color: colors.faint,
    },
    bar: {
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.lineSoft,
      overflow: "hidden",
    },
    barFill: {
      height: "100%",
      borderRadius: 999,
    },
    caption: {
      ...typo.caption,
      color: colors.faint,
    },
  });
