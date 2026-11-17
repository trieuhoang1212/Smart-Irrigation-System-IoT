import { usePathname, useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  type StyleProp,
  type ViewStyle,
} from "react-native";
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
// Khoảng trống giữ lại phía trên thanh tab khi bàn phím mở.
const KEYBOARD_CLEARANCE = 112;

const PULL_LIMIT = 54;
const PULL_SPRING = { damping: 22, stiffness: 260, mass: 0.8 };

const SWIPE_LIMIT = 26;
const SWIPE_DISTANCE = 54;
const SWIPE_VELOCITY = 520;
const SWIPE_SPRING = { damping: 24, stiffness: 280, mass: 0.7 };

const TAB_ORDER = ["/", "/analysis", "/history", "/activity", "/garden"] as const;

type SwipeDirection = "left" | "right";

// Ô nhập báo khi được focus để Screen đưa nó lên trên bàn phím. Cần riêng
// tín hiệu này vì chuyển focus khi bàn phím đã mở không phát lại
// keyboardDidShow.
const KeepInputVisibleContext = createContext<() => void>(() => {});

export function useKeepInputVisible() {
  return useContext(KeepInputVisibleContext);
}

/**
 * Trang cuộn chuẩn. Khi truyền `onPullUp`, kéo tiếp lên lúc đã tới cuối
 * trang sẽ đẩy cả nội dung lên một nhịp rồi mở thêm nội dung phía dưới —
 * không tranh cử chỉ cuộn thường vì chỉ kích hoạt ở đáy trang.
 *
 * Vuốt ngang chuyển sang tab kế bên. `onSwipe` được gọi trước để màn hình
 * tự xử lý (ví dụ đổi mục con ở Khu vườn); trả về false thì chuyển tab.
 */
export function Screen({
  children,
  contentStyle,
  onPullUp,
  onSwipe,
}: {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  onPullUp?: () => void;
  onSwipe?: (direction: SwipeDirection) => boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const scrollRef = useRef<React.ComponentRef<typeof Animated.ScrollView>>(null);
  const atEnd = useSharedValue(false);
  const pull = useSharedValue(0);
  const swipeX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const scrollHeight = useRef(0);
  const contentHeight = useRef(0);
  const keyboardTop = useRef(0);
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const shiftTab = (step: 1 | -1) => {
    const handled = onSwipe?.(step === 1 ? "left" : "right") ?? false;
    if (handled) return;

    const index = TAB_ORDER.indexOf(pathname as (typeof TAB_ORDER)[number]);
    const next = index + step;
    if (index < 0 || next < 0 || next >= TAB_ORDER.length) return;

    router.navigate(TAB_ORDER[next]);
  };

  // Đưa ô đang gõ lên trên thanh tab nổi. Ô ghi chú nhiều dòng cao dần khi
  // gõ nên phải đo lại mỗi lần nội dung đổi kích thước.
  const ensureInputVisible = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput();
    const node = scrollRef.current;
    if (!input || !node || keyboardTop.current === 0 || scrollHeight.current === 0) {
      return;
    }

    // Edge-to-edge: cửa sổ không co lại khi mở bàn phím nên vùng cuộn vẫn
    // cao hết màn hình. Chừa thêm đúng phần bàn phím che để còn chỗ cuộn ô
    // đang gõ lên trên; khi cửa sổ co thật thì phần chừa này bằng 0.
    const cover = Math.max(
      0,
      Math.round(insets.top + scrollHeight.current - keyboardTop.current),
    );
    setKeyboardInset(cover);

    const clearance = cover > 0 ? 24 : KEYBOARD_CLEARANCE;
    const limit =
      Math.min(scrollHeight.current, keyboardTop.current - insets.top) -
      clearance;

    input.measureInWindow((_x, y, _width, height) => {
      const bottom = y - insets.top + height;
      if (bottom <= limit) return;

      node.scrollTo({
        y: Math.max(0, offsetY.value + bottom - limit + 12),
        animated: true,
      });
    });
  }, [insets.top, offsetY]);

  // Focus sang ô khác khi bàn phím đang mở: đo lại sau khi ổn định rồi đưa
  // ô mới lên. Khi bàn phím chưa mở thì bỏ qua, keyboardDidShow lo sau.
  const keepInputVisible = useCallback(() => {
    focusTimers.current.forEach(clearTimeout);
    focusTimers.current = [
      setTimeout(ensureInputVisible, 120),
      setTimeout(ensureInputVisible, 400),
    ];
  }, [ensureInputVisible]);

  useEffect(
    () => () => {
      focusTimers.current.forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    if (Platform.OS !== "android") return;

    let timers: ReturnType<typeof setTimeout>[] = [];
    const clearTimers = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };

    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      const { height, screenY } = event.endCoordinates;

      // Android edge-to-edge không co cửa sổ khi mở bàn phím nên screenY có
      // thể trả về đáy màn hình; chiều cao bàn phím thì luôn đúng. Lấy giá
      // trị nhỏ hơn để mép bàn phím không bị tính thấp hơn thực tế.
      const screenHeight = Dimensions.get("screen").height;
      keyboardTop.current = Math.min(screenY, screenHeight - height);
      setKeyboardInset(
        Math.max(0, Math.round(screenHeight - keyboardTop.current)),
      );

      clearTimers();

      // Chờ layout co lại theo bàn phím rồi mới đo; kiểm tra lại sau đó
      // vì có máy cập nhật kích thước chậm.
      timers = [
        setTimeout(ensureInputVisible, 140),
        setTimeout(ensureInputVisible, 480),
      ];
    });

    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTop.current = 0;
      setKeyboardInset(0);
      clearTimers();
    });

    return () => {
      clearTimers();
      if (contentTimer.current) clearTimeout(contentTimer.current);
      show.remove();
      hide.remove();
    };
  }, [ensureInputVisible]);

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
      touchStartX.set(event.allTouches[0]?.absoluteX ?? 0);
      touchStartY.set(event.allTouches[0]?.absoluteY ?? 0);
    })
    .onTouchesMove((event, state) => {
      const dx = (event.allTouches[0]?.absoluteX ?? 0) - touchStartX.value;
      const dy = (event.allTouches[0]?.absoluteY ?? 0) - touchStartY.value;

      // Vuốt ngang thuộc về cử chỉ đổi tab.
      if (Math.abs(dx) > Math.abs(dy)) {
        state.fail();
        return;
      }

      if (atEnd.value && dy < -10) {
        state.activate();
        return;
      }

      // Vuốt xuống (hoặc vuốt lên khi chưa tới cuối trang) nhường cho cuộn.
      if (dy > 8 || (!atEnd.value && dy < -8)) state.fail();
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

  const swipe = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-20, 20])
    .onUpdate((event) => {
      swipeX.set(
        Math.max(-SWIPE_LIMIT, Math.min(SWIPE_LIMIT, event.translationX * 0.24)),
      );
    })
    .onEnd((event) => {
      if (
        event.translationX < -SWIPE_DISTANCE ||
        event.velocityX < -SWIPE_VELOCITY
      ) {
        runOnJS(shiftTab)(1);
      } else if (
        event.translationX > SWIPE_DISTANCE ||
        event.velocityX > SWIPE_VELOCITY
      ) {
        runOnJS(shiftTab)(-1);
      }
    })
    .onFinalize(() => {
      swipeX.set(withSpring(0, SWIPE_SPRING));
    });

  const scrollAndGestures = Gesture.Simultaneous(scrollNative, pullUp, swipe);

  const pullStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }, { translateX: swipeX.value }],
  }));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <AmbientBackground />

      <GestureDetector gesture={scrollAndGestures} touchAction="pan-y">
        <KeepInputVisibleContext.Provider value={keepInputVisible}>
          <Animated.ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
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

              // Ô nhiều dòng cao lên khi gõ: giữ ô đang gõ nằm trên bàn phím.
              if (keyboardTop.current === 0) return;

              if (contentTimer.current) clearTimeout(contentTimer.current);
              contentTimer.current = setTimeout(() => {
                contentTimer.current = null;
                ensureInputVisible();
              }, 120);
            }}
          >
            <Animated.View
              style={[
                styles.content,
                {
                  paddingBottom:
                    keyboardInset > 0
                      ? keyboardInset + 24
                      : insets.bottom + TAB_BAR_SPACE,
                },
                pullStyle,
                contentStyle,
              ]}
            >
              {children}
            </Animated.View>
          </Animated.ScrollView>
        </KeepInputVisibleContext.Provider>
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
