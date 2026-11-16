import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";

import { useTheme } from "../../providers/ThemeProvider";
import { radius, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";

export function NumberField({
  label,
  unit,
  value,
  onChangeText,
  keyboardType = "number-pad",
  hint,
}: {
  label: string;
  unit: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
  hint?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.labelBlock}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          style={styles.input}
          placeholder="--"
          placeholderTextColor={colors.faint}
          selectTextOnFocus
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
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
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    labelBlock: {
      flex: 1,
      gap: 2,
    },
    label: {
      ...typo.smallStrong,
      color: colors.inkSoft,
    },
    hint: {
      ...typo.caption,
      color: colors.faint,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    input: {
      minWidth: 64,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.canvas,
      ...typo.bodyStrong,
      color: colors.ink,
      textAlign: "right",
    },
    unit: {
      minWidth: 34,
      ...typo.caption,
      color: colors.faint,
    },
  });
