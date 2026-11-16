import { StyleSheet, Text, View } from "react-native";

import { typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      gap: 4,
      paddingBottom: 2,
    },
    title: {
      ...typo.display,
      color: colors.ink,
    },
    subtitle: {
      ...typo.small,
      color: colors.muted,
    },
  });
