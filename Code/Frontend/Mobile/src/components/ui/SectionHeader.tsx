import { StyleSheet, Text, View } from "react-native";

import { typo } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import type { Palette } from "../../theme";

export function SectionHeader({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    title: {
      ...typo.section,
      color: colors.ink,
    },
    hint: {
      ...typo.micro,
      color: colors.faint,
    },
  });
