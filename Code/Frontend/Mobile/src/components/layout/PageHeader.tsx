import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../providers/ThemeProvider";
import { font, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatClock } from "../../utils/format";
import { AppIcon } from "../ui/AppIcon";
import { HeaderActions } from "./HeaderActions";

export function PageHeader({
  title,
  showSettings = true,
  status,
  onSearch,
}: {
  title: string;
  showSettings?: boolean;
  status?: { online: boolean; at: number | null };
  onSearch?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const statusText = status
    ? !status.online
      ? "Thiết bị mất kết nối"
      : status.at
        ? `Cập nhật ${formatClock(status.at)}`
        : "Đang chờ dữ liệu"
    : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <AppIcon name="leaf" size={11} color={colors.white} />
          </View>
          <Text style={styles.kicker}>Greenflow</Text>
        </View>

        <View style={styles.actions}>
          {onSearch ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tìm kiếm khu vườn và trang"
              onPress={onSearch}
              hitSlop={4}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <AppIcon
                name="search"
                variant="outline"
                size={16}
                color={colors.inkSoft}
              />
            </Pressable>
          ) : null}

          <HeaderActions showSettings={showSettings} />
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>

      {status && statusText ? (
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: status.online ? colors.green : colors.red },
            ]}
          />
          <Text
            style={[styles.statusText, !status.online && styles.statusTextOff]}
            numberOfLines={1}
          >
            {statusText}
          </Text>
        </View>
      ) : null}
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
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      opacity: 0.65,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 1,
    },
    statusDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    statusText: {
      ...typo.caption,
      color: colors.muted,
    },
    statusTextOff: {
      color: colors.red,
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
  });
