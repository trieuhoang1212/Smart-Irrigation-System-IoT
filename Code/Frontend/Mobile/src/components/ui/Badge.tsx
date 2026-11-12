import { StyleSheet, Text, View } from "react-native";

import { colors, radius } from "../../theme";

type BadgeTone = "success" | "error" | "warning" | "neutral";

const TONES: Record<BadgeTone, { background: string; color: string }> = {
  success: { background: colors.greenSoft, color: colors.greenStrong },
  error: { background: colors.redSoft, color: colors.red },
  warning: { background: colors.amberSoft, color: colors.amber },
  neutral: { background: colors.lineSoft, color: colors.muted },
};

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const palette = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
});
