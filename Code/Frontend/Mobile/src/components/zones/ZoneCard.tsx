import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, type DimensionValue } from "react-native";

import type { LiveZone } from "../../api/types";
import { colors, radius, spacing } from "../../theme";
import { formatNumber, moistureLabel } from "../../utils/format";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

export function ZoneCard({
  zone,
  onTogglePump,
  disabled,
}: {
  zone: LiveZone;
  onTogglePump: (zoneId: string) => void;
  disabled: boolean;
}) {
  const moisture = zone.moisture;
  const status = moistureLabel(moisture, zone.threshold);
  const fillWidth = `${Math.max(3, Math.min(100, moisture ?? 0))}%` as DimensionValue;

  return (
    <Card style={[styles.card, { borderLeftColor: zone.color }]}>
      <View style={styles.topRow}>
        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <View style={[styles.dot, { backgroundColor: zone.color }]} />
            <Text style={styles.name}>{zone.name}</Text>
          </View>
          <Text style={styles.crop}>
            {zone.id} · {zone.crop}
          </Text>
        </View>
        <Badge
          label={status}
          tone={moisture === null ? "neutral" : moisture < zone.threshold ? "warning" : "success"}
        />
      </View>

      <View style={styles.bar}>
        <View style={[styles.barFill, { width: fillWidth, backgroundColor: zone.color }]} />
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Độ ẩm đất</Text>
          <Text style={styles.statValue}>
            {moisture === null ? "--" : `${formatNumber(moisture, 0)}%`}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Ngưỡng tưới</Text>
          <Text style={styles.statValue}>{formatNumber(zone.threshold, 0)}%</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Ngưỡng dừng</Text>
          <Text style={styles.statValue}>{formatNumber(zone.stopThreshold, 0)}%</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.pumpState}>
          <Ionicons
            name={zone.pump ? "water" : "water-outline"}
            size={14}
            color={zone.pump ? colors.blue : colors.faint}
          />
          <Text style={[styles.pumpText, zone.pump && styles.pumpTextOn]}>
            {zone.pump ? "Đang tưới" : "Đang nghỉ"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${zone.pump ? "Dừng" : "Tưới"} ${zone.name}`}
          disabled={disabled}
          onPress={() => onTogglePump(zone.id)}
          style={[
            styles.pumpButton,
            zone.pump && styles.pumpButtonOn,
            disabled && styles.disabled,
          ]}
        >
          <Text style={[styles.pumpButtonText, zone.pump && styles.pumpButtonTextOn]}>
            {zone.pump ? "Dừng" : "Tưới"}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 3,
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  nameBlock: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    fontSize: 14.5,
    fontWeight: "600",
    color: colors.ink,
  },
  crop: {
    fontSize: 11.5,
    color: colors.faint,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.lineSoft,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  stats: {
    flexDirection: "row",
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 10.5,
    color: colors.faint,
  },
  statValue: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.inkSoft,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  pumpState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pumpText: {
    fontSize: 11.5,
    color: colors.faint,
  },
  pumpTextOn: {
    color: colors.blue,
    fontWeight: "600",
  },
  pumpButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pumpButtonOn: {
    borderColor: colors.green,
    backgroundColor: colors.greenSoft,
  },
  pumpButtonText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.inkSoft,
  },
  pumpButtonTextOn: {
    color: colors.greenStrong,
  },
  disabled: {
    opacity: 0.5,
  },
});
