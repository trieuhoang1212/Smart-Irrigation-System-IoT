import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../providers/ThemeProvider";
import { radius, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";

export type BadgeTone = "success" | "error" | "warning" | "neutral";

function toneColors(colors: Palette, tone: BadgeTone) {
  switch (tone) {
    case "success":
      return { background: colors.greenSoft, color: colors.greenStrong };
    case "error":
      return { background: colors.redSoft, color: colors.red };
    case "warning":
      return { background: colors.amberSoft, color: colors.amber };
    default:
      return { background: colors.surfaceSunken, color: colors.muted };
  }
}

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const palette = toneColors(colors, tone);

  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const createStyles = (_colors: Palette) =>
  StyleSheet.create({
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    label: {
      ...typo.caption,
    },
  });
