import type { TextStyle } from "react-native";

// Lexend nạp trong app/_layout.tsx; tên family do @expo-google-fonts đặt sẵn.
export const font = {
  regular: "Lexend_400Regular",
  medium: "Lexend_500Medium",
  semibold: "Lexend_600SemiBold",
  bold: "Lexend_700Bold",
  extrabold: "Lexend_800ExtraBold",
} as const;

export const typo = {
  display: {
    fontFamily: font.extrabold,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.9,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.6,
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
    fontFamily: font.bold,
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: -0.8,
  },
  zoneValue: {
    fontFamily: font.bold,
    fontSize: 20,
    lineHeight: 23,
    letterSpacing: -0.6,
  },
  modeLabel: {
    fontFamily: font.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
} satisfies Record<string, TextStyle>;
