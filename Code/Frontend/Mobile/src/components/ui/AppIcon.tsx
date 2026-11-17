import { Image, type ImageStyle, type StyleProp } from "react-native";

// Bộ icon Icons8 (giấy phép free có ghi nguồn trong Cài đặt).
// Dùng ảnh trắng và tô màu bằng tintColor để theo kịp theme sáng/tối.
const ICONS = {
  leaf: {
    outline: require("../../../assets/icons8/leaf.png"),
    filled: require("../../../assets/icons8/leaf-fill.png"),
  },
  search: {
    outline: require("../../../assets/icons8/search.png"),
    filled: require("../../../assets/icons8/search-fill.png"),
  },
  close: {
    outline: require("../../../assets/icons8/multiply.png"),
    filled: require("../../../assets/icons8/multiply-fill.png"),
  },
  sun: {
    outline: require("../../../assets/icons8/sun.png"),
    filled: require("../../../assets/icons8/sun-fill.png"),
  },
  moon: {
    outline: require("../../../assets/icons8/moon.png"),
    filled: require("../../../assets/icons8/moon-fill.png"),
  },
  power: {
    outline: require("../../../assets/icons8/shutdown.png"),
    filled: require("../../../assets/icons8/shutdown-fill.png"),
  },
  auto: {
    outline: require("../../../assets/icons8/synchronize.png"),
    filled: require("../../../assets/icons8/synchronize-fill.png"),
  },
  manual: {
    outline: require("../../../assets/icons8/hand.png"),
    filled: require("../../../assets/icons8/hand-fill.png"),
  },
  temperature: {
    outline: require("../../../assets/icons8/thermometer.png"),
    filled: require("../../../assets/icons8/thermometer-fill.png"),
  },
  humidity: {
    outline: require("../../../assets/icons8/humidity.png"),
    filled: require("../../../assets/icons8/humidity-fill.png"),
  },
  rain: {
    outline: require("../../../assets/icons8/rain.png"),
    filled: require("../../../assets/icons8/rain-fill.png"),
  },
  water: {
    outline: require("../../../assets/icons8/water.png"),
    filled: require("../../../assets/icons8/water-fill.png"),
  },
  chart: {
    outline: require("../../../assets/icons8/combo-chart.png"),
    filled: require("../../../assets/icons8/combo-chart-fill.png"),
  },
  activity: {
    outline: require("../../../assets/icons8/activity.png"),
    filled: require("../../../assets/icons8/activity-fill.png"),
  },
  clock: {
    outline: require("../../../assets/icons8/clock.png"),
    filled: require("../../../assets/icons8/clock-fill.png"),
  },
  settings: {
    outline: require("../../../assets/icons8/settings.png"),
    filled: require("../../../assets/icons8/settings-fill.png"),
  },
  grid: {
    outline: require("../../../assets/icons8/squared-menu.png"),
    filled: require("../../../assets/icons8/squared-menu-fill.png"),
  },
  chevronRight: {
    outline: require("../../../assets/icons8/chevron-right.png"),
    filled: require("../../../assets/icons8/chevron-right-fill.png"),
  },
  check: {
    outline: require("../../../assets/icons8/ok.png"),
    filled: require("../../../assets/icons8/ok-fill.png"),
  },
  error: {
    outline: require("../../../assets/icons8/error.png"),
    filled: require("../../../assets/icons8/error-fill.png"),
  },
  info: {
    outline: require("../../../assets/icons8/info.png"),
    filled: require("../../../assets/icons8/info-fill.png"),
  },
  edit: {
    outline: require("../../../assets/icons8/edit.png"),
    filled: require("../../../assets/icons8/edit-fill.png"),
  },
  sliders: {
    outline: require("../../../assets/icons8/options.png"),
    filled: require("../../../assets/icons8/options-fill.png"),
  },
  more: {
    outline: require("../../../assets/icons8/ellipse.png"),
  },
  help: {
    outline: require("../../../assets/icons8/help.png"),
    filled: require("../../../assets/icons8/help-fill.png"),
  },
  cancel: {
    outline: require("../../../assets/icons8/cancel.png"),
    filled: require("../../../assets/icons8/cancel-fill.png"),
  },
  refresh: {
    outline: require("../../../assets/icons8/refresh.png"),
    filled: require("../../../assets/icons8/refresh-fill.png"),
  },
  camera: {
    outline: require("../../../assets/icons8/camera.png"),
  },
  trash: {
    outline: require("../../../assets/icons8/trash.png"),
  },
} as const;

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
  style?: StyleProp<ImageStyle>;
}) {
  const set = ICONS[name];
  const source =
    variant === "outline" || !("filled" in set) ? set.outline : set.filled;

  return (
    <Image
      source={source}
      accessible={false}
      importantForAccessibility="no"
      resizeMode="contain"
      style={[{ width: size, height: size, tintColor: color }, style]}
    />
  );
}
