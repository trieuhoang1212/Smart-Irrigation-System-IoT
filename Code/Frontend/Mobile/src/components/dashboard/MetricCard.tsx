import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "../../theme";

export function MetricCard({
  icon,
  label,
  value,
  hint,
  accent = colors.green,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.hint} numberOfLines={1}>
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.ink,
  },
  label: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.muted,
  },
  hint: {
    marginTop: 2,
    fontSize: 10.5,
    color: colors.faint,
  },
});