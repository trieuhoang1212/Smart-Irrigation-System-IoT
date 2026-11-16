import { useEffect } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

const REVEAL_SPRING = { damping: 18, stiffness: 165, mass: 0.9 };

/**
 * Vào màn hình theo nhịp so le. Dùng spring thay cho timing để chuyển động
 * có độ "nặng" nhẹ, không bị cứng như một khung hình bật lên.
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
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.set(1);
      return;
    }
    progress.set(withDelay(index * 55, withSpring(1, REVEAL_SPRING)));
  }, [index, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => {
    const value = Math.min(progress.value, 1);
    return {
      opacity: value,
      transform: [{ translateY: (1 - value) * 16 }],
    };
  });

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}
