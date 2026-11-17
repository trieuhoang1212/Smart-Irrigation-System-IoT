import { StyleSheet, Text, View } from "react-native";

import { font, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";

// Tiêu đề mục kiểu sổ tay: số thứ tự tùy chọn, tên mục, đường kẻ dẫn tới ghi chú.
export function LedgerHeader({
  index,
  title,
  hint,
  tone,
}: {
  index?: string;
  title: string;
  hint?: string;
  tone?: "error";
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      {index ? <Text style={styles.index}>{index}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.rule} />
      {hint ? (
        <Text style={[styles.hint, tone === "error" && styles.hintError]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingBottom: 8,
    },
    index: {
      fontFamily: font.semibold,
      fontSize: 10.5,
      lineHeight: 14,
      letterSpacing: 0.4,
      fontVariant: ["tabular-nums"],
      color: colors.green,
    },
    title: {
      fontFamily: font.semibold,
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.2,
      color: colors.ink,
    },
    rule: {
      flex: 1,
      height: 1,
      backgroundColor: colors.lineSoft,
    },
    hint: {
      fontFamily: font.semibold,
      fontSize: 9.5,
      lineHeight: 12,
      letterSpacing: 0.9,
      textTransform: "uppercase",
      color: colors.faint,
    },
    hintError: {
      color: colors.red,
    },
  });
