import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Image as SvgImage,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { useTheme } from "../../providers/ThemeProvider";

// Nền "vườn lúc sáng sớm": hai quầng màu rất nhẹ, hạt li ti và một chiếc lá
// chìm ở góc để màn hình không còn là một khối màu phẳng.
export function AmbientBackground() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const leafSize = Math.min(220, width * 0.62);

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Svg width={width} height={height + 260}>
        <Defs>
          <RadialGradient id="ambientGreen" cx="82%" cy="0%" r="78%">
            <Stop
              offset="0%"
              stopColor={colors.green}
              stopOpacity={isDark ? 0.34 : 0.2}
            />
            <Stop offset="100%" stopColor={colors.green} stopOpacity={0} />
          </RadialGradient>

          <RadialGradient id="ambientAmber" cx="8%" cy="46%" r="58%">
            <Stop
              offset="0%"
              stopColor={colors.amber}
              stopOpacity={isDark ? 0.18 : 0.14}
            />
            <Stop offset="100%" stopColor={colors.amber} stopOpacity={0} />
          </RadialGradient>

          <Pattern id="ambientDots" width="22" height="22" patternUnits="userSpaceOnUse">
            <Circle
              cx="1.1"
              cy="1.1"
              r="1.1"
              fill={colors.ink}
              fillOpacity={isDark ? 0.14 : 0.08}
            />
          </Pattern>
        </Defs>

        <Rect width="100%" height="100%" fill="url(#ambientGreen)" />
        <Rect width="100%" height="100%" fill="url(#ambientAmber)" />
        <Rect width="100%" height={height} fill="url(#ambientDots)" />

        <SvgImage
          x={width - leafSize * 0.66}
          y={height * 0.16}
          width={leafSize}
          height={leafSize}
          href={require("../../../assets/icons8/leaf-fill.png")}
          opacity={isDark ? 0.05 : 0.06}
          preserveAspectRatio="xMidYMid meet"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
});
