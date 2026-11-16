import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { radius, spacing, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatClock } from "../../utils/format";
import { PressableScale } from "../ui/PressableScale";

export function DashboardHeader({ onOpenSearch }: { onOpenSearch: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { colors, isDark, toggle } = useTheme();
  const { deviceOnline, lastTelemetryAt } = useGarden();

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Ionicons name="leaf" size={15} color={colors.white} />
            </View>

            <Text style={styles.title}>Vườn nhà</Text>
          </View>

          <View style={styles.metaRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: deviceOnline ? colors.green : colors.red },
              ]}
            />

            <Text
              style={[
                styles.meta,
                !deviceOnline && { color: colors.red },
              ]}
              numberOfLines={1}
            >
              {deviceOnline
                ? `Cập nhật ${formatClock(lastTelemetryAt)}`
                : "Thiết bị mất kết nối"}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
          onPress={toggle}
          hitSlop={6}
          style={({ pressed }) => [styles.themeButton, pressed && styles.pressed]}
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={18}
            color={colors.inkSoft}
          />
        </Pressable>
      </View>

      <PressableScale
        onPress={onOpenSearch}
        accessibilityLabel="Tìm kiếm khu vườn và trang"
        innerStyle={styles.search}
      >
        <Ionicons name="search" size={16} color={colors.faint} />

        <Text style={styles.searchText} numberOfLines={1}>
          Tìm khu vườn, thông số...
        </Text>

        <View style={styles.searchHint}>
          <Text style={styles.searchHintText}>Tìm</Text>
        </View>
      </PressableScale>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    header: {
      gap: spacing.sm,
      paddingTop: spacing.xs,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    titleBlock: {
      flex: 1,
      gap: 3,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    logo: {
      width: 28,
      height: 28,
      borderRadius: 10,
      backgroundColor: colors.green,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      ...typo.title,
      color: colors.ink,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingLeft: 1,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    meta: {
      ...typo.caption,
      color: colors.muted,
    },
    themeButton: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      opacity: 0.7,
    },
    search: {
      height: 42,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    searchText: {
      flex: 1,
      ...typo.small,
      color: colors.faint,
    },
    searchHint: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSunken,
    },
    searchHintText: {
      ...typo.caption,
      color: colors.muted,
    },
  });
