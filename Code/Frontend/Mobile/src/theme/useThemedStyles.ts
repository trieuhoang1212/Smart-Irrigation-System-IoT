import { useMemo } from "react";
import {
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useTheme } from "../providers/ThemeProvider";
import type { Palette } from "./palette";

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * Tạo StyleSheet theo bảng màu đang dùng. Factory khai báo ở cấp module để
 * danh sách style chỉ được dựng lại khi theme đổi.
 */
export function useThemedStyles<T extends NamedStyles>(
  factory: (colors: Palette) => T,
): T {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)), [factory, colors]);
}
