import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Switch, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { colors, spacing } from "../../theme";

export function WeatherGateToggle() {
  const { weatherGate, toggleWeatherGate, pending } = useGarden();

  return (
    <View style={styles.row}>
      <View style={styles.labelBlock}>
        <View style={styles.titleRow}>
          <Ionicons name="rainy-outline" size={16} color={colors.blue} />
          <Text style={styles.title}>Chặn tưới khi mưa</Text>
        </View>
        <Text style={styles.hint}>Tự dừng tưới khi cảm biến mưa phát hiện nước.</Text>
      </View>
      <Switch
        accessibilityLabel="Chặn tưới khi mưa"
        value={weatherGate}
        disabled={Boolean(pending)}
        onValueChange={() => void toggleWeatherGate()}
        trackColor={{ false: colors.line, true: colors.green }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  labelBlock: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.faint,
  },
});
