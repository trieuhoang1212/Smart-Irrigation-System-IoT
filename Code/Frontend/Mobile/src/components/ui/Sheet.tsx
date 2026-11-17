import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const OPEN_SPRING = { damping: 26, stiffness: 240, mass: 0.9 };
const SETTLE_SPRING = { damping: 28, stiffness: 320, mass: 0.7 };
const CLOSE_MS = 160;
const DISMISS_DISTANCE = 92;
const DISMISS_VELOCITY = 900;
const PANEL_TRAVEL = 460;

/**
 * Bottom sheet nhẹ: mở bằng spring, kéo phần đầu xuống để đóng, đóng 160ms
 * rồi mới tháo khỏi cây React để không bị "nháy" nội dung.
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
  const dragY = useSharedValue(0);

  // Mở lại sau khi đã đóng: giữ panel trong cây React ngay từ render này.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      dragY.set(0);
      progress.set(withSpring(1, OPEN_SPRING));
      return;
    }

    progress.set(
      withTiming(0, { duration: CLOSE_MS }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      }),
    );
  }, [dragY, progress, visible]);

  const drag = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-28, 28])
    .onUpdate((event) => {
      dragY.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (dragY.get() > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        progress.set(
          withTiming(0, { duration: CLOSE_MS }, (finished) => {
            if (finished) runOnJS(onClose)();
          }),
        );
        dragY.set(withTiming(0, { duration: CLOSE_MS }));
        return;
      }

      dragY.set(withSpring(0, SETTLE_SPRING));
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * Math.max(0, 1 - dragY.value / 340),
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - progress.value) * PANEL_TRAVEL + dragY.value },
    ],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
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
          <GestureDetector gesture={drag}>
            <View style={styles.dragArea}>
              <View style={styles.grabber} />

              {title ? <Text style={styles.title}>{title}</Text> : null}
            </View>
          </GestureDetector>

          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
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
    dragArea: {
      gap: 6,
      paddingTop: 2,
      paddingBottom: 4,
    },
    grabber: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.line,
    },
    title: {
      ...typo.title,
      color: colors.ink,
    },
  });
