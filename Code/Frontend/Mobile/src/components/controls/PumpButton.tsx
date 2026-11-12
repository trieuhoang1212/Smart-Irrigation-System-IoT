import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { colors, radius, spacing } from "../../theme";

export function PumpButton() {
  const { mode, pump, togglePump, pending } = useGarden();
  const disabled = mode !== "manual" || Boolean(pending);

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, checked: pump }}
        disabled={disabled}
        onPress={() => void togglePump()}
        style={[styles.button, pump && styles.buttonOn, disabled && styles.disabled]}
      >
        <Ionicons
          name="power"
          size={18}
          color={pump ? colors.white : disabled ? colors.faint : colors.greenStrong}
        />
        <Text style={[styles.label, pump && styles.labelOn, disabled && styles.labelDisabled]}>
          {pump ? "Tắt bơm tổng" : "Bật bơm tổng"}
        </Text>
      </Pressable>
      {mode !== "manual" && (
        <Text style={styles.hint}>Chuyển sang thủ công để điều khiển bơm tổng.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  button: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  buttonOn: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.ink,
  },
  labelOn: {
    color: colors.white,
  },
  labelDisabled: {
    color: colors.faint,
  },
  hint: {
    fontSize: 11,
    color: colors.faint,
  },
});
