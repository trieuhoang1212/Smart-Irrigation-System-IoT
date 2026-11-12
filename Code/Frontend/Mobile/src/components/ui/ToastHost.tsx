import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "../../theme";

export type ToastTone = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

const TONE = {
  success: { icon: "checkmark-circle" as const, color: colors.green, background: colors.greenSoft },
  error: { icon: "alert-circle" as const, color: colors.red, background: colors.redSoft },
  info: { icon: "information-circle" as const, color: colors.blue, background: colors.blueSoft },
};

export function ToastHost({
  toasts,
  onClose,
}: {
  toasts: ToastItem[];
  onClose: (id: number) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      {toasts.map((toast) => {
        const tone = TONE[toast.tone];
        return (
          <View key={toast.id} style={styles.toast}>
            <View style={[styles.iconWrap, { backgroundColor: tone.background }]}>
              <Ionicons name={tone.icon} size={16} color={tone.color} />
            </View>
            <Text style={styles.message}>{toast.message}</Text>
            <Pressable
              accessibilityLabel="Đóng thông báo"
              onPress={() => onClose(toast.id)}
              hitSlop={8}
            >
              <Ionicons name="close" size={16} color={colors.faint} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.sm,
    zIndex: 20,
    elevation: 12,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
  },
});
