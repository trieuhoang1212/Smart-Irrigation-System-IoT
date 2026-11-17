import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../providers/ThemeProvider";
import { font, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { AppIcon } from "../ui/AppIcon";
import { HeaderActions } from "./HeaderActions";

export function PageHeader({
  title,
  subtitle,
  showSettings = true,
}: {
  title: string;
  subtitle?: string;
  showSettings?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <AppIcon name="leaf" size={11} color={colors.white} />
          </View>
          <Text style={styles.kicker}>Greenflow</Text>
        </View>

        <HeaderActions showSettings={showSettings} />
      </View>

      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      gap: 6,
      paddingTop: 2,
      paddingBottom: 2,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    brand: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    logo: {
      width: 22,
      height: 22,
      borderRadius: 6,
      backgroundColor: colors.green,
      alignItems: "center",
      justifyContent: "center",
    },
    kicker: {
      ...typo.micro,
      letterSpacing: 1.4,
      color: colors.muted,
    },
    title: {
      fontFamily: font.display,
      fontSize: 30,
      lineHeight: 35,
      letterSpacing: -0.8,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: font.medium,
      fontSize: 12,
      lineHeight: 17,
      color: colors.muted,
    },
  });
