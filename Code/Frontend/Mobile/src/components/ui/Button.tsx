import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "../../providers/ThemeProvider";
import { radius, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  label,
  onPress,
  variant = "secondary",
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const labelColor =
    variant === "primary"
      ? colors.white
      : variant === "danger"
        ? colors.red
        : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    base: {
      minHeight: 44,
      paddingHorizontal: 18,
      borderRadius: radius.pill,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    primary: {
      backgroundColor: colors.green,
      borderColor: colors.green,
    },
    secondary: {
      backgroundColor: colors.surface,
      borderColor: colors.line,
    },
    danger: {
      backgroundColor: colors.redSoft,
      borderColor: colors.redSoft,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
    },
    pressed: {
      opacity: 0.82,
      transform: [{ scale: 0.98 }],
    },
    disabled: {
      opacity: 0.45,
    },
    label: {
      ...typo.bodyStrong,
    },
  });
