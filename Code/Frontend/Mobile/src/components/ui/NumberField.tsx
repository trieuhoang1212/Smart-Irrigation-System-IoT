import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";

import { colors, radius, spacing } from "../../theme";

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

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  labelBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.inkSoft,
  },
  hint: {
    fontSize: 10.5,
    color: colors.faint,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  input: {
    minWidth: 62,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "right",
  },
  unit: {
    minWidth: 34,
    fontSize: 11,
    color: colors.faint,
  },
});
