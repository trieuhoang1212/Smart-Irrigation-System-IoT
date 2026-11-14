
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { colors, radius, spacing } from "../../theme";
import { formatClock } from "../../utils/format";

export function AppHeader() {
  const {
    deviceOnline,
    lastTelemetryAt,
    wsConnected,
    brokerConnected,
  } = useGarden();

  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <View style={styles.brandRow}>
              <Ionicons name="leaf" size={17} color={colors.green} />
              <Text style={styles.brand}>GREENFLOW</Text>
            </View>

            <Text style={styles.title}>Tưới thông minh</Text>
            <Text style={styles.subtitle}>
              Vườn rau củ quả · 6 khu
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở thông báo"
            onPress={() => setShowNotifications(true)}
            style={styles.notificationButton}
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={colors.greenStrong}
            />
          </Pressable>
        </View>

        <View style={styles.connectionRow}>
          <View
            style={[
              styles.status,
              deviceOnline ? styles.statusOnline : styles.statusOffline,
            ]}
          >
            <View
              style={[
                styles.dot,
                deviceOnline ? styles.dotOnline : styles.dotOffline,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                deviceOnline ? styles.textOnline : styles.textOffline,
              ]}
            >
              {deviceOnline ? "Online" : "Offline"}
            </Text>
          </View>

          <Text style={styles.meta}>
            Cập nhật {formatClock(lastTelemetryAt)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            <Text style={wsConnected ? styles.metaOk : styles.metaError}>
              {wsConnected ? "Realtime" : "Đang kết nối lại"}
            </Text>
          </Text>

          <Text style={styles.meta}>
            MQTT{" "}
            <Text
              style={
                brokerConnected === false
                  ? styles.metaError
                  : styles.metaOk
              }
            >
              {brokerConnected === null
                ? "--"
                : brokerConnected
                  ? "OK"
                  : "Lỗi"}
            </Text>
          </Text>
        </View>
      </View>

      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowNotifications(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowNotifications(false)}
        >
          <Pressable
            style={styles.popup}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.popupHeader}>
              <View>
                <Text style={styles.popupTitle}>Thông báo</Text>
                <Text style={styles.popupSubtitle}>
                  Lịch sử hoạt động khu vườn
                </Text>
              </View>

              <Pressable
                onPress={() => setShowNotifications(false)}
                hitSlop={10}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={colors.muted}
                />
              </Pressable>
            </View>

            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="notifications-outline"
                  size={30}
                  color={colors.green}
                />
              </View>

              <Text style={styles.emptyTitle}>
                Chưa có thông báo
              </Text>

              <Text style={styles.emptyText}>
                Các thông báo về tưới nước, độ ẩm và trạng thái
                thiết bị sẽ xuất hiện tại đây.
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
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
    gap: 7,
  },
  brand: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: colors.green,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
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
    fontSize: 12,
    fontWeight: "700",
  },
  textOnline: {
    color: colors.greenStrong,
  },
  textOffline: {
    color: colors.red,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    flexWrap: "wrap",
  },
  meta: {
    fontSize: 12,
    color: colors.muted,
  },
  metaOk: {
    color: colors.greenStrong,
    fontWeight: "600",
  },
  metaError: {
    color: colors.red,
    fontWeight: "600",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "flex-end",
    paddingTop: 65,
    paddingHorizontal: 16,
  },
  popup: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  popupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  popupTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.ink,
  },
  popupSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
  },
});
