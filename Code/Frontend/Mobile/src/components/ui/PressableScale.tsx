import type { ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const PRESS_SPRING = { damping: 20, stiffness: 320, mass: 0.6 };

/**
 * Bọc nội dung để có phản hồi nhấn nhẹ (scale 0.97) — thay cho hiệu ứng
 * opacity mặc định vốn trông "rẻ" trên nền bento.
 */
export function PressableScale({
  children,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  innerStyle,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.set(withSpring(0.97, PRESS_SPRING));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, PRESS_SPRING));
      }}
      style={style}
    >
      <Animated.View style={[innerStyle, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
