import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../theme";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 3,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
});
