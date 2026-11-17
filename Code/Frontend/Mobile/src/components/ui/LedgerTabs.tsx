import { Pressable, StyleSheet, Text, View } from "react-native";

import { font, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";

type Option<T extends string> = {
  value: T;
  label: string;
};

// Tab gạch chân dùng cho các bộ lọc nhỏ; thay cho chip bo tròn.
export function LedgerTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
            >
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
      borderBottomWidth: 1,
      borderBottomColor: colors.lineSoft,
    },
    tab: {
      flex: 1,
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 2,
      marginBottom: -1,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: {
      borderBottomColor: colors.green,
    },
    label: {
      fontFamily: font.medium,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.muted,
    },
    labelActive: {
      fontFamily: font.semibold,
      color: colors.greenStrong,
    },
  });
