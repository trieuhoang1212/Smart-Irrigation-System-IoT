import { useIsFocused } from "expo-router";
import { useEffect } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

const REVEAL_SPRING = { damping: 20, stiffness: 220, mass: 0.8 };

// Giữ nhịp so le ngắn để các khung vào gần như cùng lúc nhưng vẫn có thứ tự.
const STAGGER_STEP = 40;

/**
 * Vào màn hình theo nhịp so le. Chạy lại mỗi lần tab được chọn nên nội dung
 * các trang cũng có chuyển động, không chỉ riêng lần mở đầu tiên.
 */
export function Reveal({
  children,
  index = 0,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.set(1);
      return;
    }
    if (!focused) return;

    // Đặt lại rồi chạy lại: lúc này cảnh đang mờ dần vào nên không thấy giật.
    progress.set(0);
    progress.set(withDelay(index * STAGGER_STEP, withSpring(1, REVEAL_SPRING)));
  }, [focused, index, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => {
    const value = Math.min(progress.value, 1);
    return {
      opacity: value,
      transform: [{ translateY: (1 - value) * 10 }],
    };
  });

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}
