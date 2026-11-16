import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.chip, active && styles.active]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingVertical: 2,
    },
    chip: {
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    active: {
      borderColor: colors.green,
      backgroundColor: colors.green,
    },
    label: {
      ...typo.smallStrong,
      color: colors.muted,
    },
    activeLabel: {
      color: colors.white,
    },
  });
