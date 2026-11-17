import { StyleSheet, Text, View } from "react-native";

import { font, type Palette } from "../../theme";
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
      gap: 5,
      paddingTop: 2,
      paddingBottom: 4,
    },
    title: {
      fontFamily: font.display,
      fontSize: 32,
      lineHeight: 37,
      letterSpacing: -0.9,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: font.medium,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.muted,
    },
  });
