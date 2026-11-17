import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

type Glyph = ComponentProps<typeof Ionicons>["name"];

// Bộ icon Ionicons (MIT, đi kèm @expo/vector-icons): nét bo tròn, cùng một
// lưới 24px và có cặp bản đặc/nét nên tab đang chọn nhìn đậm hơn hẳn.
const ICONS = {
  leaf: ["leaf", "leaf-outline"],
  search: ["search", "search-outline"],
  close: ["close", "close-outline"],
  sun: ["sunny", "sunny-outline"],
  moon: ["moon", "moon-outline"],
  power: ["power", "power-outline"],
  auto: ["sync", "sync-outline"],
  manual: ["hand-left", "hand-left-outline"],
  temperature: ["thermometer", "thermometer-outline"],
  humidity: ["cloud", "cloud-outline"],
  rain: ["rainy", "rainy-outline"],
  water: ["water", "water-outline"],
  chart: ["stats-chart", "stats-chart-outline"],
  activity: ["pulse", "pulse-outline"],
  clock: ["time", "time-outline"],
  settings: ["settings", "settings-outline"],
  grid: ["grid", "grid-outline"],
  chevronRight: ["chevron-forward", "chevron-forward-outline"],
  check: ["checkmark", "checkmark-outline"],
  error: ["alert-circle", "alert-circle-outline"],
  info: ["information-circle", "information-circle-outline"],
  edit: ["create", "create-outline"],
  sliders: ["options", "options-outline"],
  more: ["ellipsis-horizontal", "ellipsis-horizontal-outline"],
  help: ["help-circle", "help-circle-outline"],
  cancel: ["close-circle", "close-circle-outline"],
  refresh: ["refresh", "refresh-outline"],
  camera: ["camera", "camera-outline"],
  trash: ["trash", "trash-outline"],
} as const satisfies Record<string, readonly [Glyph, Glyph]>;

export type AppIconName = keyof typeof ICONS;
export type AppIconVariant = "outline" | "filled";

export function AppIcon({
  name,
  size = 18,
  color,
  variant = "filled",
  style,
}: {
  name: AppIconName;
  size?: number;
  color: string;
  variant?: AppIconVariant;
  style?: StyleProp<ViewStyle>;
}) {
  const [solid, line] = ICONS[name];

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Ionicons
        name={variant === "outline" ? line : solid}
        size={size}
        color={color}
        allowFontScaling={false}
        includeFontPadding={false}
      />
    </View>
  );
}
