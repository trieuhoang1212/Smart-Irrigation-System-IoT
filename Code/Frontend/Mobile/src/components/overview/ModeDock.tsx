import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { font, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { pressHaptic, tickHaptic } from "../../utils/haptics";
import { AppIcon, type AppIconName } from "../ui/AppIcon";
import { PressableScale } from "../ui/PressableScale";

const SELECT_SPRING = { damping: 16, stiffness: 210, mass: 0.7 };
const ORB = 104;

export function ModeDock() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { mode, setMode, pending, deviceOnline, pump, togglePump } = useGarden();

  const offline = !deviceOnline;
  const disabled = Boolean(pending) || offline;
  const auto = mode === "auto";
  const pumpOn = pump && !auto && !offline;
  const canPump = !disabled && !auto;

  const label = pending
    ? pending
    : offline
      ? "Mất kết nối — không điều khiển được"
      : auto
        ? "Bơm chạy tự động theo ngưỡng"
        : pump
          ? "Bơm đang chạy — chạm để tắt"
          : "Bật bơm tổng";

  return (
    <View style={styles.card}>
      <View style={styles.ringLarge} />
      <View style={styles.ringSmall} />

      <Text style={styles.kicker}>Chế độ tưới</Text>

      <View style={styles.options}>
        <ModeOrb
          label="Tự động"
          hint="Theo ngưỡng"
          icon="auto"
          active={auto}
          disabled={disabled}
          onPress={() => {
            if (!auto) {
              tickHaptic();
              void setMode("auto");
            }
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
          active={!auto}
          disabled={disabled}
          onPress={() => {
            if (auto) {
              tickHaptic();
              void setMode("manual");
            }
          }}
        />
      </View>

      <PressableScale
        onPress={() => {
          pressHaptic();
          void togglePump();
        }}
        disabled={!canPump}
        accessibilityLabel={
          auto
            ? "Bơm chạy tự động theo ngưỡng"
            : pump
              ? "Tắt bơm tổng"
              : "Bật bơm tổng"
        }
        innerStyle={[
          styles.pumpBar,
          pumpOn && styles.pumpBarOn,
          auto && styles.pumpBarAuto,
          offline && styles.pumpBarOffline,
        ]}
      >
        {pending ? (
          <ActivityIndicator size="small" color={colors.onDeep} />
        ) : offline ? (
          <AppIcon name="error" variant="outline" size={15} color={colors.amber} />
        ) : auto ? (
          <AppIcon name="auto" variant="outline" size={15} color={colors.onDeepSoft} />
        ) : pump ? (
          <PumpDot />
        ) : (
          <AppIcon name="power" variant="outline" size={15} color={colors.onDeep} />
        )}

        <Text
          style={[
            styles.pumpLabel,
            pumpOn && styles.pumpLabelOn,
            (auto || offline) && styles.pumpLabelIdle,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </PressableScale>
    </View>
  );
}

function PumpDot() {
  const styles = useThemedStyles(createStyles);
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.set(
      withRepeat(withTiming(1, { duration: 900 }), -1, true),
    );
    return () => {
      pulse.set(0);
    };
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.65,
  }));

  return <Animated.View style={[styles.liveDot, animatedStyle]} />;
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
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.deep,
      gap: 12,
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
    kicker: {
      ...typo.micro,
      color: colors.onDeepSoft,
    },
    options: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
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
      fontSize: 10,
      color: colors.onDeepSoft,
    },
    orbHintActive: {
      color: colors.white,
      opacity: 0.78,
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
    pumpBar: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.16)",
      backgroundColor: "rgba(255,255,255,0.07)",
    },
    pumpBarOn: {
      backgroundColor: colors.green,
      borderColor: "transparent",
    },
    pumpBarAuto: {
      backgroundColor: "rgba(255,255,255,0.035)",
      borderColor: "rgba(255,255,255,0.1)",
    },
    pumpBarOffline: {
      backgroundColor: "rgba(255,255,255,0.035)",
      borderColor: "rgba(255,255,255,0.1)",
    },
    pumpLabel: {
      flexShrink: 1,
      fontFamily: font.semibold,
      fontSize: 12.5,
      lineHeight: 17,
      letterSpacing: -0.1,
      color: colors.onDeep,
    },
    pumpLabelOn: {
      color: colors.white,
    },
    pumpLabelIdle: {
      color: colors.onDeepSoft,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.white,
    },
  });
