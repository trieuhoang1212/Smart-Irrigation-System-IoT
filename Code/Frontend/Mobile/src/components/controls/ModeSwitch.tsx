import { Pressable, StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { colors, radius, spacing } from "../../theme";

export function ModeSwitch() {
  const { mode, setMode, pending } = useGarden();
  const disabled = Boolean(pending);

  return (
    <View style={styles.track}>
      {(["auto", "manual"] as const).map((item) => {
        const active = mode === item;
        return (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => void setMode(item)}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {item === "auto" ? "Tự động" : "Thủ công"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.lineSoft,
  },
  option: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm - 2,
    alignItems: "center",
  },
  optionActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  label: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.muted,
  },
  labelActive: {
    color: colors.greenStrong,
  },
});
