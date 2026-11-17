import type { TextStyle } from "react-native";

// Lexend nạp trong app/_layout.tsx; tên family do @expo-google-fonts đặt sẵn.
// Cả app dùng duy nhất một font chữ, phân biệt bằng độ đậm.
export const font = {
  regular: "Lexend_400Regular",
  medium: "Lexend_500Medium",
  semibold: "Lexend_600SemiBold",
  bold: "Lexend_700Bold",
  extrabold: "Lexend_800ExtraBold",
  display: "Lexend_700Bold",
} as const;

export const typo = {
  display: {
    fontFamily: font.display,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.4,
  },
  title: {
    fontFamily: font.display,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.3,
  },
  section: {
    fontFamily: font.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  bodyStrong: {
    fontFamily: font.semibold,
    fontSize: 13,
    lineHeight: 19,
  },
  small: {
    fontFamily: font.regular,
    fontSize: 11.5,
    lineHeight: 16,
  },
  smallStrong: {
    fontFamily: font.semibold,
    fontSize: 11.5,
    lineHeight: 16,
  },
  caption: {
    fontFamily: font.medium,
    fontSize: 10.5,
    lineHeight: 14,
  },
  micro: {
    fontFamily: font.semibold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  metric: {
    fontFamily: font.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  zoneValue: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 25,
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  modeLabel: {
    fontFamily: font.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
} satisfies Record<string, TextStyle>;
