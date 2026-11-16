import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { radius, spacing, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";

const THUMB_SPRING = { damping: 18, stiffness: 230, mass: 0.8 };

export function ModeDock() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const {
    mode,
    setMode,
    pending,
    deviceOnline,
    pump,
    togglePump,
  } = useGarden();

  const [dockWidth, setDockWidth] = useState(0);
  const progress = useSharedValue(mode === "auto" ? 0 : 1);

  useEffect(() => {
    progress.set(withSpring(mode === "auto" ? 0 : 1, THUMB_SPRING));
  }, [mode, progress]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * ((dockWidth - 8) / 2) }],
  }));

  const disabled = Boolean(pending) || !deviceOnline;
  const canPump = !disabled && mode === "manual";

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.kicker}>Chế độ tưới</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pump ? "Tắt bơm tổng" : "Bật bơm tổng"}
          accessibilityState={{ disabled: !canPump, checked: pump }}
          disabled={!canPump}
          onPress={() => void togglePump()}
          style={({ pressed }) => [
            styles.pumpPill,
            pump && styles.pumpPillOn,
            !canPump && !pump && styles.pumpPillIdle,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="power"
            size={12}
            color={pump ? colors.white : colors.onDeepSoft}
          />

          <Text style={[styles.pumpText, pump && styles.pumpTextOn]}>
            {pump ? "Bơm đang chạy" : "Bơm tổng tắt"}
          </Text>
        </Pressable>
      </View>

      <View
        style={styles.dock}
        onLayout={(event) => setDockWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            styles.thumb,
            { width: dockWidth > 0 ? (dockWidth - 8) / 2 : 0 },
            thumbStyle,
          ]}
        />

        <ModeOption
          label="Tự động"
          icon="sync-outline"
          active={mode === "auto"}
          disabled={disabled}
          onPress={() => {
            if (mode !== "auto") void setMode("auto");
          }}
        />

        <ModeOption
          label="Thủ công"
          icon="hand-left-outline"
          active={mode === "manual"}
          disabled={disabled}
          onPress={() => {
            if (mode !== "manual") void setMode("manual");
          }}
        />
      </View>

      <View style={styles.captionRow}>
        {pending ? (
          <>
            <ActivityIndicator size="small" color={colors.onDeep} />
            <Text style={styles.caption} numberOfLines={1}>
              {pending}
            </Text>
          </>
        ) : (
          <Text style={styles.caption} numberOfLines={1}>
            {mode === "auto"
              ? "Tự tưới khi độ ẩm đất xuống dưới ngưỡng"
              : "Bạn tự bật tắt bơm cho từng khu vườn"}
          </Text>
        )}
      </View>
    </View>
  );
}

function ModeOption({
  label,
  icon,
  active,
  disabled,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.option}
    >
      <Ionicons
        name={icon}
        size={17}
        color={active ? colors.deep : colors.onDeepSoft}
      />

      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      padding: 14,
      borderRadius: 20,
      backgroundColor: colors.deep,
      gap: spacing.sm,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    kicker: {
      ...typo.micro,
      color: colors.onDeepSoft,
      marginLeft: 2,
    },
    pumpPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: "rgba(255,255,255,0.1)",
    },
    pumpPillOn: {
      backgroundColor: colors.green,
    },
    pumpPillIdle: {
      opacity: 0.72,
    },
    pumpText: {
      ...typo.caption,
      color: colors.onDeepSoft,
    },
    pumpTextOn: {
      color: colors.white,
    },
    pressed: {
      opacity: 0.75,
    },
    dock: {
      height: 74,
      flexDirection: "row",
      padding: 4,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.08)",
      position: "relative",
    },
    thumb: {
      position: "absolute",
      top: 4,
      bottom: 4,
      left: 4,
      borderRadius: 12,
      backgroundColor: colors.onDeep,
    },
    option: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      zIndex: 1,
    },
    optionLabel: {
      ...typo.modeLabel,
      color: colors.onDeepSoft,
    },
    optionLabelActive: {
      color: colors.deep,
    },
    captionRow: {
      minHeight: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 2,
    },
    caption: {
      ...typo.caption,
      color: colors.onDeepSoft,
    },
  });
