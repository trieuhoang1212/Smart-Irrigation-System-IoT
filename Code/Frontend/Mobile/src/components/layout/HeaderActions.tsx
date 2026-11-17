import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../../providers/ThemeProvider";
import type { Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { AppIcon } from "../ui/AppIcon";

// Hai nút này đi theo mọi trang để Cài đặt và đổi sáng/tối luôn trong tầm tay.
export function HeaderActions({ showSettings = true }: { showSettings?: boolean }) {
  const styles = useThemedStyles(createStyles);
  const { colors, isDark, toggle } = useTheme();
  const router = useRouter();
  const spin = useSharedValue(0);

  const themeIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const rotate = () => {
    spin.set(withTiming(spin.get() + 180, { duration: 420 }));
    toggle();
  };

  return (
    <View style={styles.row}>
      {showSettings ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở Cài đặt"
          onPress={() => router.navigate("/settings")}
          hitSlop={4}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <AppIcon
            name="settings"
            variant="outline"
            size={16}
            color={colors.inkSoft}
          />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"
        }
        onPress={rotate}
        hitSlop={4}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Animated.View style={themeIconStyle}>
          <AppIcon
            name={isDark ? "sun" : "moon"}
            variant="outline"
            size={17}
            color={colors.inkSoft}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    button: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      opacity: 0.65,
    },
  });
