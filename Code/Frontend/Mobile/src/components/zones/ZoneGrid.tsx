import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type DimensionValue,
} from "react-native";

import type { LiveZone } from "../../api/types";
import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { spacing, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatNumber } from "../../utils/format";
import { AppIcon } from "../ui/AppIcon";
import { PressableScale } from "../ui/PressableScale";

const COLUMNS = 3;
const GAP = 10;

export function ZoneGrid({
  onSelect,
}: {
  onSelect: (zoneId: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { zones, loading, configError, reloadConfig } = useGarden();
  const { width } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(0);

  // Đo bề rộng thật của lưới thay vì trừ hằng số: lề trong khung Panel
  // làm tròn khác nhau trên từng máy, đoán lệch một chút là ô thứ 3 rớt hàng.
  const inner = gridWidth || width - 58;
  const tileWidth = Math.floor((inner - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <View style={styles.section}>
      {loading && zones.length === 0 ? (
        <View style={styles.state}>
          <ActivityIndicator size="small" color={colors.green} />
          <Text style={styles.stateText}>Đang tải cấu hình khu vườn...</Text>
        </View>
      ) : configError ? (
        <View style={styles.state}>
          <Text style={styles.errorText}>{configError}</Text>
          <Text style={styles.retry} onPress={reloadConfig}>
            Thử lại
          </Text>
        </View>
      ) : zones.length === 0 ? (
        <View style={styles.state}>
          <Text style={styles.stateText}>Chưa có khu vườn nào được cấu hình.</Text>
        </View>
      ) : (
        <View
          style={styles.grid}
          onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
        >
          {zones.map((zone) => (
            <ZoneTile
              key={zone.id}
              zone={zone}
              width={tileWidth}
              onPress={() => onSelect(zone.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ZoneTile({
  zone,
  width,
  onPress,
}: {
  zone: LiveZone;
  width: number;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  const moisture = zone.moisture;
  const needsWater = moisture !== null && moisture < zone.threshold;
  const fillWidth = `${Math.max(0, Math.min(100, moisture ?? 0))}%` as DimensionValue;

  const barColor =
    moisture === null ? colors.line : needsWater ? colors.amber : colors.green;

  const status =
    moisture === null
      ? "không có dữ liệu"
      : zone.pump
        ? "đang tưới"
        : needsWater
          ? "cần tưới"
          : "đủ ẩm";

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${zone.name}, ${status}`}
      style={{ width }}
      innerStyle={styles.tile}
    >
      <View style={styles.tileHead}>
        <Text style={styles.zoneName} numberOfLines={1}>
          {zone.name}
        </Text>

        {zone.pump ? (
          <AppIcon name="water" size={12} color={colors.blue} />
        ) : (
          <View
            style={[
              styles.zoneDot,
              {
                backgroundColor:
                  moisture === null
                    ? colors.line
                    : needsWater
                      ? colors.amber
                      : colors.green,
              },
            ]}
          />
        )}
      </View>

      <Text
        style={[styles.zoneValue, moisture === null && styles.zoneValueEmpty]}
        numberOfLines={1}
      >
        {moisture === null ? "—" : `${formatNumber(moisture, 0)}%`}
      </Text>

      <View style={styles.tileBar}>
        <View
          style={[
            styles.tileBarFill,
            { width: fillWidth, backgroundColor: barColor },
          ]}
        />
      </View>
    </PressableScale>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    section: {
      gap: spacing.sm,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: GAP,
    },
    tile: {
      minHeight: 62,
      padding: 8,
      gap: 2,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.lineSoft,
      backgroundColor: colors.surfaceSunken,
      justifyContent: "space-between",
    },
    tileHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 4,
    },
    zoneName: {
      flex: 1,
      ...typo.smallStrong,
      color: colors.inkSoft,
    },
    zoneDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    zoneValue: {
      ...typo.zoneValue,
      fontSize: 19,
      lineHeight: 22,
      color: colors.ink,
    },
    zoneValueEmpty: {
      ...typo.caption,
      lineHeight: 14,
      color: colors.faint,
    },
    tileBar: {
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.lineSoft,
      overflow: "hidden",
    },
    tileBarFill: {
      height: "100%",
    },
    state: {
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    stateText: {
      ...typo.small,
      color: colors.faint,
      textAlign: "center",
    },
    errorText: {
      ...typo.small,
      color: colors.red,
      textAlign: "center",
    },
    retry: {
      ...typo.smallStrong,
      color: colors.green,
    },
  });
