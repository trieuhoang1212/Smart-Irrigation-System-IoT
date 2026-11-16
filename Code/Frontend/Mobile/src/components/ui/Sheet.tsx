import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Bottom sheet nhẹ: mở bằng trượt lên 220ms, đóng 180ms rồi mới tháo khỏi
 * cây React để không bị "nháy" nội dung.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  // Mở lại sau khi đã đóng: giữ panel trong cây React ngay từ render này.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      progress.set(withTiming(1, { duration: 220 }));
      return;
    }

    progress.set(
      withTiming(0, { duration: 180 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      }),
    );
  }, [progress, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 420 }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <AnimatedPressable
        accessibilityLabel="Đóng bảng"
        onPress={onClose}
        style={[styles.backdrop, backdropStyle]}
      />

      <Animated.View
        style={[
          styles.panel,
          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
          panelStyle,
        ]}
      >
        <View style={styles.grabber} />

        {title ? <Text style={styles.title}>{title}</Text> : null}

        {children}
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    backdrop: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.overlay,
    },
    panel: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: "86%",
      paddingHorizontal: 18,
      paddingTop: 8,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      gap: 12,
    },
    grabber: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.line,
      marginBottom: 4,
    },
    title: {
      ...typo.title,
      color: colors.ink,
    },
  });
