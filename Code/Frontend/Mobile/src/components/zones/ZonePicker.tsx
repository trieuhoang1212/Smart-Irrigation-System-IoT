import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LiveZone } from "../../api/types";
import { font, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";

// Chọn khu vườn bằng thẻ gọn, xuống dòng thay vì cắt tên khi có đủ 6 khu.
export function ZonePicker({
  zones,
  value,
  onChange,
}: {
  zones: LiveZone[];
  value: string;
  onChange: (zoneId: string) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      {zones.map((zone) => {
        const active = zone.id === value;

        return (
          <Pressable
            key={zone.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(zone.id)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
            >
              {zone.name}
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
      gap: 7,
    },
    chip: {
      minHeight: 32,
      justifyContent: "center",
      paddingHorizontal: 11,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.green,
      backgroundColor: colors.green,
    },
    label: {
      fontFamily: font.medium,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.muted,
    },
    labelActive: {
      fontFamily: font.semibold,
      color: colors.white,
    },
    pressed: {
      opacity: 0.75,
    },
  });
