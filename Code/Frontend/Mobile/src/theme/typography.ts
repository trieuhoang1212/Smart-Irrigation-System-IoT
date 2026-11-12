import { TextStyle } from "react-native";

import { colors } from "./colors";

export const text = {
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
  },
  heading: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.ink,
  },
  body: {
    fontSize: 14,
    color: colors.inkSoft,
  },
  small: {
    fontSize: 12,
    color: colors.muted,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.faint,
  },
} satisfies Record<string, TextStyle>;
