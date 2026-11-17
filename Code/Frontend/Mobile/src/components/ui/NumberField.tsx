import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";

import { useTheme } from "../../providers/ThemeProvider";
import { font, type Palette } from "../../theme";
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
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>

      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          style={styles.input}
          placeholder="--"
          placeholderTextColor={colors.faint}
          selectTextOnFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    field: {
      gap: 5,
    },
    head: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 8,
    },
    label: {
      fontFamily: font.medium,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.muted,
    },
    hint: {
      fontFamily: font.semibold,
      fontSize: 9.5,
      lineHeight: 12,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: colors.faint,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    inputRowFocused: {
      borderBottomColor: colors.green,
    },
    input: {
      flex: 1,
      minHeight: 40,
      paddingHorizontal: 0,
      paddingVertical: 8,
      fontFamily: font.regular,
      fontSize: 15,
      lineHeight: 21,
      color: colors.ink,
      outlineWidth: 0,
      outlineColor: "transparent",
    },
    unit: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.faint,
    },
  });
