import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../providers/ThemeProvider";
import { font, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { tickHaptic } from "../../utils/haptics";
import { AppIcon, type AppIconName } from "../ui/AppIcon";

type TabMeta = {
  icon: AppIconName;
};

const TAB_SPRING = { damping: 18, stiffness: 230, mass: 0.7 };
// Icon nhích lên rồi nảy về; giữ biên độ nhỏ để không phá nhịp thanh tab.
const BOUNCE_SPRING = { damping: 9, stiffness: 300, mass: 0.5 };

const TAB_META: Record<string, TabMeta> = {
  index: { icon: "grid" },
  analysis: { icon: "activity" },
  history: { icon: "chart" },
  activity: { icon: "clock" },
  garden: { icon: "edit" },
};

function TabItem({
  label,
  meta,
  focused,
  onPress,
  onLongPress,
}: {
  label: string;
  meta: TabMeta;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const progress = useSharedValue(focused ? 1 : 0);
  const bounce = useSharedValue(0);

  useEffect(() => {
    progress.set(withSpring(focused ? 1 : 0, TAB_SPRING));
    if (!focused) return;

    bounce.set(
      withSequence(
        withTiming(1, { duration: 70, easing: Easing.out(Easing.quad) }),
        withSpring(0, BOUNCE_SPRING),
      ),
    );
  }, [bounce, focused, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.92 + progress.value * 0.08 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 0.94 + progress.value * 0.1 + bounce.value * 0.12 },
      { translateY: bounce.value * -1.5 },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
    >
      <Animated.View style={[styles.itemPill, pillStyle]} />

      <Animated.View style={iconStyle}>
        <AppIcon
          name={meta.icon}
          variant={focused ? "filled" : "outline"}
          size={19}
          color={focused ? colors.white : colors.muted}
        />
      </Animated.View>

      <Text
        numberOfLines={1}
        style={[styles.label, focused && styles.labelActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function GlassTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
}: BottomTabBarProps) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.wrap,
          { bottom: Math.max(insets.bottom, 10) + 6 },
        ]}
      >
        <View style={styles.bar}>
          {state.routes
            // Cài đặt mở từ nút bánh răng ở đầu trang, không chiếm chỗ trên thanh tab.
            .filter((route) => Boolean(TAB_META[route.name]))
            .map((route) => {
              const focused = state.routes[state.index]?.key === route.key;
              const options = descriptors[route.key].options;
              const label =
                typeof options.title === "string" ? options.title : route.name;
              const meta = TAB_META[route.name] ?? TAB_META.index;

              const onPress = () => {
                const event = emitter.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  tickHaptic();
                  navigateToTab(route.key);
                }
              };

              const onLongPress = () => {
                emitter.emit({
                  type: "tabLongPress",
                  target: route.key,
                });
              };

              return (
                <TabItem
                  key={route.key}
                  label={label}
                  meta={meta}
                  focused={focused}
                  onPress={onPress}
                  onLongPress={onLongPress}
                />
              );
            })}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 14,
      right: 14,
      borderRadius: 14,
    },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      padding: 5,
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    item: {
      flex: 1,
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      borderRadius: 10,
    },
    itemPill: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: 10,
      backgroundColor: colors.green,
    },
    label: {
      fontFamily: font.semibold,
      fontSize: 9.5,
      lineHeight: 12,
      letterSpacing: -0.1,
      paddingHorizontal: 1,
      textAlign: "center",
      color: colors.muted,
    },
    labelActive: {
      color: colors.white,
    },
  });
