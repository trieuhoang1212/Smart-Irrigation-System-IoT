
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { colors, radius, spacing } from "../../theme";
import { Card } from "../ui/Card";
import { SectionHeader } from "../ui/SectionHeader";

function StatusItem({
  icon,
  label,
  value,
  active,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <View style={styles.item}>
      <View
        style={[
          styles.iconWrap,
          active && styles.iconWrapActive,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={active ? colors.green : colors.faint}
        />
      </View>

      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>

      <Text
        style={[styles.value, active && styles.valueActive]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export function SystemStatusCard() {
  const { mode, pump, weatherGate, servoAngle } = useGarden();

  return (
    <Card style={styles.card}>
      <SectionHeader title="Trạng thái hệ thống" hint="LIVE" />

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <StatusItem
            icon="settings-outline"
            label="Chế độ hoạt động"
            value={mode === "auto" ? "Tự động" : "Thủ công"}
            active={mode === "auto"}
          />
        </View>

        <View style={styles.gridItem}>
          <StatusItem
            icon="water-outline"
            label="Máy bơm tổng"
            value={pump ? "Đang bật" : "Đang tắt"}
            active={pump}
          />
        </View>

        <View style={styles.gridItem}>
          <StatusItem
            icon="rainy-outline"
            label="Chặn tưới khi mưa"
            value={weatherGate ? "Đang bật" : "Đang tắt"}
            active={weatherGate}
          />
        </View>

        <View style={styles.gridItem}>
          <StatusItem
            icon="sync-outline"
            label="Góc servo"
            value={`${servoAngle}°`}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
  },
  gridItem: {
    width: "50%",
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  item: {
    minHeight: 112,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.lineSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  iconWrapActive: {
    backgroundColor: `${colors.green}18`,
  },
  label: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 5,
  },
  value: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  valueActive: {
    color: colors.greenStrong,
  },
});
