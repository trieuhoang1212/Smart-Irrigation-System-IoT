import { StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatClock } from "../../utils/format";

export function StatusLine() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const {
    deviceOnline,
    wsConnected,
    brokerConnected,
    lastTelemetryAt,
  } = useGarden();

  const brokerLabel =
    brokerConnected === null
      ? "—"
      : brokerConnected
        ? "đã kết nối"
        : "mất kết nối";

  return (
    <View style={styles.row}>
      <Text style={styles.text} numberOfLines={1}>
        MQTT{" "}
        <Text
          style={{
            color:
              brokerConnected === null
                ? colors.faint
                : brokerConnected
                  ? colors.greenStrong
                  : colors.red,
          }}
        >
          {brokerLabel}
        </Text>
        {" · "}
        {wsConnected ? "trực tiếp" : "đang kết nối lại"}
      </Text>

      <Text style={styles.text} numberOfLines={1}>
        {deviceOnline
          ? `Cập nhật ${formatClock(lastTelemetryAt)}`
          : "Chưa có dữ liệu"}
      </Text>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 4,
      paddingTop: 2,
    },
    text: {
      ...typo.caption,
      color: colors.faint,
    },
  });
