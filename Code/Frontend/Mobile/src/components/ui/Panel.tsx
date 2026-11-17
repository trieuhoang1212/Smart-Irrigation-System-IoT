import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { font, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";

type Props = {
  index?: string;
  title?: string;
  hint?: string;
  tone?: "error";
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
};

// Mỗi mục nội dung nằm trong một khung riêng: viền mảnh, nền surface,
// đầu mục có ô số thứ tự để mắt bám được thứ tự đọc.
export function Panel({
  index,
  title,
  hint,
  tone,
  action,
  footer,
  children,
  style,
  bodyStyle,
}: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.panel, style]}>
      {title ? (
        <View style={styles.head}>
          {index ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{index}</Text>
            </View>
          ) : null}

          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          <View style={styles.rule} />

          {hint ? (
            <Text
              style={[styles.hint, tone === "error" && styles.hintError]}
              numberOfLines={1}
            >
              {hint}
            </Text>
          ) : null}

          {action}
        </View>
      ) : null}

      <View style={[styles.body, bodyStyle]}>{children}</View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    panel: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 9,
      borderBottomWidth: 1,
      borderBottomColor: colors.lineSoft,
    },
    chip: {
      width: 20,
      height: 20,
      borderRadius: 6,
      backgroundColor: colors.greenSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    chipText: {
      fontFamily: font.semibold,
      fontSize: 9.5,
      lineHeight: 12,
      letterSpacing: 0.3,
      fontVariant: ["tabular-nums"],
      color: colors.greenStrong,
    },
    title: {
      fontFamily: font.semibold,
      fontSize: 14,
      lineHeight: 18,
      letterSpacing: -0.2,
      color: colors.ink,
    },
    rule: {
      flex: 1,
      height: 1,
      backgroundColor: colors.lineSoft,
    },
    hint: {
      flexShrink: 1,
      fontFamily: font.semibold,
      fontSize: 9.5,
      lineHeight: 12,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.faint,
    },
    hintError: {
      color: colors.red,
    },
    body: {
      padding: 12,
      gap: 10,
    },
    footer: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
  });
