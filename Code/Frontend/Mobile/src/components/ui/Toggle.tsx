import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { tickHaptic } from "../../utils/haptics";

const TRACK_WIDTH = 40;
const TRACK_HEIGHT = 24;
const KNOB = 18;
const TRAVEL = TRACK_WIDTH - KNOB - 6;

export function Toggle({
  value,
  onChange,
  disabled = false,
  label,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  const styles = useThemedStyles(createStyles);
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 160 });
  }, [progress, value]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        tickHaptic();
        onChange(!value);
      }}
      style={[styles.track, value && styles.trackOn, disabled && styles.disabled]}
    >
      <Animated.View style={[styles.knob, knobStyle]} />
    </Pressable>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    track: {
      width: TRACK_WIDTH,
      height: TRACK_HEIGHT,
      borderRadius: 999,
      padding: 3,
      justifyContent: "center",
      backgroundColor: colors.line,
    },
    trackOn: {
      backgroundColor: colors.green,
    },
    knob: {
      width: KNOB,
      height: KNOB,
      borderRadius: 999,
      backgroundColor: colors.white,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    disabled: {
      opacity: 0.45,
    },
  });
