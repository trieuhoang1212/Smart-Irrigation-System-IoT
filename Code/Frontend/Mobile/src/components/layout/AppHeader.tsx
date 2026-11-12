import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { colors, radius, spacing } from "../../theme";
import { formatClock } from "../../utils/format";

export function AppHeader() {
  const { deviceOnline, lastTelemetryAt, wsConnected, brokerConnected } = useGarden();

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <View style={styles.brandRow}>
            <Ionicons name="leaf" size={14} color={colors.green} />
            <Text style={styles.brand}>GREENFLOW</Text>
          </View>
          <Text style={styles.title}>Tưới thông minh</Text>
          <Text style={styles.subtitle}>Vườn rau củ quả · 6 khu</Text>
        </View>

        <View style={[styles.status, deviceOnline ? styles.statusOnline : styles.statusOffline]}>
          <View style={[styles.dot, deviceOnline ? styles.dotOnline : styles.dotOffline]} />
          <Text style={[styles.statusText, deviceOnline ? styles.textOnline : styles.textOffline]}>
            {deviceOnline ? "Online" : "Offline"}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>Cập nhật {formatClock(lastTelemetryAt)}</Text>
        <Text style={styles.meta}>
          <Text style={wsConnected ? styles.metaOk : styles.metaError}>
            {wsConnected ? "Realtime" : "Đang kết nối lại"}
          </Text>
          {"  ·  MQTT "}
          <Text style={brokerConnected === false ? styles.metaError : styles.metaOk}>
            {brokerConnected === null ? "--" : brokerConnected ? "OK" : "Lỗi"}
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  brand: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.green,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusOnline: {
    borderColor: colors.greenSoft,
    backgroundColor: colors.greenSoft,
  },
  statusOffline: {
    borderColor: colors.redSoft,
    backgroundColor: colors.redSoft,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: colors.green,
  },
  dotOffline: {
    backgroundColor: colors.red,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  textOnline: {
    color: colors.greenStrong,
  },
  textOffline: {
    color: colors.red,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  meta: {
    fontSize: 11.5,
    color: colors.muted,
  },
  metaOk: {
    color: colors.greenStrong,
  },
  metaError: {
    color: colors.red,
  },
});
