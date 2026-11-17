import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { spacing, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { AppIcon, type AppIconName } from "../ui/AppIcon";
import { PressableScale } from "../ui/PressableScale";

const SELECT_SPRING = { damping: 16, stiffness: 210, mass: 0.7 };
const ORB = 104;

export function ModeDock() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { mode, setMode, pending, deviceOnline, pump, togglePump } = useGarden();

  const disabled = Boolean(pending) || !deviceOnline;
  const canPump = !disabled && mode === "manual";

  return (
    <View style={styles.card}>
      <View style={styles.ringLarge} />
      <View style={styles.ringSmall} />

      <View style={styles.topRow}>
        <View style={styles.heading}>
          <Text style={styles.kicker}>Chế độ tưới</Text>
          <Text style={styles.headingValue}>
            {mode === "auto" ? "Tự động theo ngưỡng" : "Thủ công từng khu"}
          </Text>
        </View>

        <PressableScale
          onPress={() => void togglePump()}
          disabled={!canPump}
          accessibilityLabel={pump ? "Tắt bơm tổng" : "Bật bơm tổng"}
          innerStyle={[
            styles.pumpPill,
            pump && styles.pumpPillOn,
            !canPump && !pump && styles.pumpPillIdle,
          ]}
        >
          <AppIcon
            name="power"
            size={13}
            color={pump ? colors.white : colors.onDeepSoft}
          />

          <Text style={[styles.pumpText, pump && styles.pumpTextOn]}>
            {pump ? "Bơm đang chạy" : "Bơm tổng tắt"}
          </Text>
        </PressableScale>
      </View>

      <View style={styles.options}>
        <ModeOrb
          label="Tự động"
          hint="Theo ngưỡng"
          icon="auto"
          active={mode === "auto"}
          disabled={disabled}
          onPress={() => {
            if (mode !== "auto") void setMode("auto");
          }}
        />

        <View style={styles.connector}>
          <View style={styles.connectorLine} />
          <View style={styles.connectorDot} />
          <View style={styles.connectorLine} />
        </View>

        <ModeOrb
          label="Thủ công"
          hint="Tự bật bơm"
          icon="manual"
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
          <Text style={styles.caption} numberOfLines={2}>
            {mode === "auto"
              ? "Tự tưới khi độ ẩm đất xuống dưới ngưỡng đã đặt."
              : "Bạn tự bật tắt bơm cho từng khu vườn."}
          </Text>
        )}
      </View>
    </View>
  );
}

function ModeOrb({
  label,
  hint,
  icon,
  active,
  disabled,
  onPress,
}: {
  label: string;
  hint: string;
  icon: AppIconName;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const halo = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    halo.set(withSpring(active ? 1 : 0, SELECT_SPRING));
  }, [active, halo]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * halo.value,
    transform: [{ scale: 0.86 + halo.value * 0.2 }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + halo.value * 0.06 }],
  }));

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={styles.orbSlot}
      innerStyle={[
        styles.orb,
        active && styles.orbActive,
        disabled && styles.orbDisabled,
      ]}
    >
      <Animated.View style={[styles.orbHalo, haloStyle]} />

      <Animated.View style={[styles.orbContent, contentStyle]}>
        <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
          <AppIcon
            name={icon}
            size={25}
            color={active ? colors.white : colors.onDeep}
          />
        </View>

        <Text style={[styles.orbLabel, active && styles.orbLabelActive]}>
          {label}
        </Text>
        <Text style={[styles.orbHint, active && styles.orbHintActive]}>{hint}</Text>
      </Animated.View>
    </PressableScale>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      position: "relative",
      overflow: "hidden",
      padding: 16,
      borderRadius: 14,
      backgroundColor: colors.deep,
      gap: spacing.sm,
    },
    ringLarge: {
      position: "absolute",
      top: -86,
      right: -70,
      width: 210,
      height: 210,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.07)",
    },
    ringSmall: {
      position: "absolute",
      bottom: -54,
      left: -34,
      width: 128,
      height: 128,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.035)",
    },
    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    heading: {
      flex: 1,
      gap: 1,
    },
    kicker: {
      ...typo.micro,
      color: colors.onDeepSoft,
      marginLeft: 1,
    },
    headingValue: {
      ...typo.smallStrong,
      color: colors.onDeep,
    },
    pumpPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 4,
      backgroundColor: "rgba(255,255,255,0.1)",
    },
    pumpPillOn: {
      backgroundColor: colors.green,
    },
    pumpPillIdle: {
      opacity: 0.6,
    },
    pumpText: {
      ...typo.caption,
      color: colors.onDeepSoft,
    },
    pumpTextOn: {
      color: colors.white,
    },
    options: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 4,
    },
    orbSlot: {
      width: ORB,
      height: ORB,
    },
    orb: {
      flex: 1,
      borderRadius: ORB / 2,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      backgroundColor: "rgba(255,255,255,0.055)",
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      overflow: "hidden",
    },
    orbActive: {
      backgroundColor: colors.green,
      borderColor: "rgba(255,255,255,0.3)",
    },
    orbDisabled: {
      opacity: 0.55,
    },
    orbHalo: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: ORB / 2,
      borderWidth: 2,
      borderColor: colors.onDeepSoft,
    },
    orbContent: {
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.08)",
      marginBottom: 3,
    },
    iconWrapActive: {
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    orbLabel: {
      ...typo.smallStrong,
      fontSize: 12.5,
      color: colors.onDeep,
    },
    orbLabelActive: {
      color: colors.white,
    },
    orbHint: {
      ...typo.caption,
      fontSize: 9.5,
      color: colors.onDeepSoft,
    },
    orbHintActive: {
      color: colors.white,
      opacity: 0.75,
    },
    connector: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      maxWidth: 34,
    },
    connectorLine: {
      flex: 1,
      height: 1,
      backgroundColor: "rgba(255,255,255,0.14)",
    },
    connectorDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.32)",
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
