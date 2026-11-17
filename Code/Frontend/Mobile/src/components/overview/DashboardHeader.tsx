import { StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { spacing, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatClock } from "../../utils/format";
import { HeaderActions } from "../layout/HeaderActions";
import { AppIcon } from "../ui/AppIcon";
import { PressableScale } from "../ui/PressableScale";

export function DashboardHeader({ onOpenSearch }: { onOpenSearch: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { deviceOnline, lastTelemetryAt } = useGarden();

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <AppIcon name="leaf" size={16} color={colors.white} />
            </View>

            <Text style={styles.title}>Greenflow</Text>
          </View>

          <View style={styles.metaRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: deviceOnline ? colors.green : colors.red },
              ]}
            />

            <Text
              style={[styles.meta, !deviceOnline && { color: colors.red }]}
              numberOfLines={1}
            >
              {deviceOnline
                ? `Cập nhật ${formatClock(lastTelemetryAt)}`
                : "Thiết bị mất kết nối"}
            </Text>
          </View>
        </View>

        <HeaderActions />
      </View>

      <PressableScale
        onPress={onOpenSearch}
        accessibilityLabel="Tìm kiếm khu vườn và trang"
        innerStyle={styles.search}
      >
        <AppIcon name="search" variant="outline" size={16} color={colors.faint} />

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
      borderRadius: 8,
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
    search: {
      height: 42,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    searchText: {
      flex: 1,
      ...typo.small,
      color: colors.muted,
    },
    searchHint: {
      paddingHorizontal: 2,
    },
    searchHintText: {
      ...typo.micro,
      color: colors.faint,
    },
  });
