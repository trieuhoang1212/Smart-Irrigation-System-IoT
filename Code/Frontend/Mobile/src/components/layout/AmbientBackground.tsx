import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { useTheme } from "../../providers/ThemeProvider";

// Nền giấy ẩm của khu vườn: hai quầng màu rất nhẹ và một chiếc lá chìm ở góc.
// Không dùng hoạ tiết lặp để màn hình giữ được vẻ tĩnh, không bị "dashboard".
export function AmbientBackground() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const leafSize = Math.min(240, width * 0.68);

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Svg width={width} height={height + 260}>
        <Defs>
          <RadialGradient id="ambientGreen" cx="86%" cy="-4%" r="82%">
            <Stop
              offset="0%"
              stopColor={colors.green}
              stopOpacity={isDark ? 0.22 : 0.13}
            />
            <Stop offset="100%" stopColor={colors.green} stopOpacity={0} />
          </RadialGradient>

          <RadialGradient id="ambientAmber" cx="4%" cy="48%" r="58%">
            <Stop
              offset="0%"
              stopColor={colors.amber}
              stopOpacity={isDark ? 0.12 : 0.08}
            />
            <Stop offset="100%" stopColor={colors.amber} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect width="100%" height="100%" fill="url(#ambientGreen)" />
        <Rect width="100%" height="100%" fill="url(#ambientAmber)" />
      </Svg>

      <Ionicons
        name="leaf"
        size={leafSize}
        color={colors.green}
        allowFontScaling={false}
        style={{
          position: "absolute",
          left: width - leafSize * 0.62,
          top: height * 0.2,
          opacity: isDark ? 0.04 : 0.05,
        }}
      />
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
