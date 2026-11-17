import { useRef } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { AmbientBackground } from "./AmbientBackground";

// Chừa chỗ cho thanh tab nổi ở đáy để nội dung cuối không bị khuất.
const TAB_BAR_SPACE = 104;
const PULL_LIMIT = 54;
const PULL_SPRING = { damping: 22, stiffness: 260, mass: 0.8 };

/**
 * Trang cuộn chuẩn. Khi truyền `onPullUp`, kéo tiếp lên lúc đã tới cuối
 * trang sẽ đẩy cả nội dung lên một nhịp rồi mở thêm nội dung phía dưới —
 * không tranh cử chỉ cuộn thường vì chỉ kích hoạt ở đáy trang.
 */
export function Screen({
  children,
  contentStyle,
  onPullUp,
}: {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  onPullUp?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const atEnd = useSharedValue(false);
  const pull = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const scrollHeight = useRef(0);
  const contentHeight = useRef(0);

  const syncAtEnd = () => {
    atEnd.set(
      scrollHeight.current > 0 &&
        offsetY.value + scrollHeight.current >= contentHeight.current - 24,
    );
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      offsetY.set(event.contentOffset.y);
      atEnd.set(
        event.contentOffset.y + event.layoutMeasurement.height >=
          event.contentSize.height - 24,
      );
    },
  });

  // ScrollView có cử chỉ cuộn gốc; chạy song song để kéo lên ở đáy trang
  // không chặn việc cuộn thường.
  const scrollNative = Gesture.Native();
  const pullUp = Gesture.Pan()
    .enabled(Boolean(onPullUp))
    .manualActivation(true)
    .onTouchesDown((event) => {
      touchStartY.set(event.allTouches[0]?.absoluteY ?? 0);
    })
    .onTouchesMove((event, state) => {
      const delta = (event.allTouches[0]?.absoluteY ?? 0) - touchStartY.value;

      if (atEnd.value && delta < -10) {
        state.activate();
        return;
      }

      // Vuốt xuống (hoặc vuốt lên khi chưa tới cuối trang) nhường cho cuộn.
      if (delta > 8 || (!atEnd.value && delta < -8)) state.fail();
    })
    .onUpdate((event) => {
      pull.set(Math.max(-PULL_LIMIT, Math.min(0, event.translationY * 0.4)));
    })
    .onEnd((event) => {
      pull.set(withSpring(0, PULL_SPRING));
      if (event.translationY < -36 || event.velocityY < -700) {
        runOnJS(onPullUp ?? (() => {}))();
      }
    });

  const scrollAndPull = Gesture.Simultaneous(scrollNative, pullUp);

  const pullStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }],
  }));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <AmbientBackground />

      <GestureDetector gesture={scrollAndPull} touchAction="pan-y">
        <Animated.ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={(event) => {
            scrollHeight.current = event.nativeEvent.layout.height;
            syncAtEnd();
          }}
          onContentSizeChange={(_, height) => {
            contentHeight.current = height;
            syncAtEnd();
          }}
        >
          <Animated.View
            style={[
              styles.content,
              { paddingBottom: insets.bottom + TAB_BAR_SPACE },
              pullStyle,
              contentStyle,
            ]}
          >
            {children}
          </Animated.View>
        </Animated.ScrollView>
      </GestureDetector>
    </SafeAreaView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.canvas,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 10,
      gap: 10,
    },
  });
