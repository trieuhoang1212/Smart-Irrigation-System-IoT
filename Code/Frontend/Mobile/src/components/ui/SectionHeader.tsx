import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../theme";

export function SectionHeader({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  hint: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: colors.faint,
  },
});
