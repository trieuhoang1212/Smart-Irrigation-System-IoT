import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../providers/ThemeProvider";
import { radius, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { AppIcon, type AppIconName } from "./AppIcon";

export type ToastTone = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

export function ToastHost({
  toasts,
  onClose,
}: {
  toasts: ToastItem[];
  onClose: (id: number) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const toneStyles: Record<
    ToastTone,
    { icon: AppIconName; color: string; background: string }
  > = {
    success: {
      icon: "check",
      color: colors.green,
      background: colors.greenSoft,
    },
    error: {
      icon: "error",
      color: colors.red,
      background: colors.redSoft,
    },
    info: {
      icon: "info",
      color: colors.blue,
      background: colors.blueSoft,
    },
  };

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      {toasts.map((toast) => {
        const tone = toneStyles[toast.tone];
        return (
          <View key={toast.id} style={styles.toast}>
            <View style={[styles.iconWrap, { backgroundColor: tone.background }]}>
              <AppIcon name={tone.icon} size={16} color={tone.color} />
            </View>

            <Text style={styles.message}>{toast.message}</Text>

            <Pressable
              accessibilityLabel="Đóng thông báo"
              onPress={() => onClose(toast.id)}
              hitSlop={8}
            >
              <AppIcon name="close" variant="outline" size={16} color={colors.faint} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    host: {
      position: "absolute",
      left: 16,
      right: 16,
      gap: 8,
      zIndex: 20,
      elevation: 12,
    },
    toast: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surfaceRaised,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
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
      ...typo.small,
      color: colors.inkSoft,
    },
  });
