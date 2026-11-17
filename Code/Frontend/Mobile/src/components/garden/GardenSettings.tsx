import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme, type ThemeMode } from "../../providers/ThemeProvider";
import { font, spacing, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatClock } from "../../utils/format";
import { AppIcon } from "../ui/AppIcon";
import { Toggle } from "../ui/Toggle";
import { GardenSectionHeader } from "./GardenSectionHeader";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Theo máy" },
  { value: "light", label: "Sáng" },
  { value: "dark", label: "Tối" },
];

function ThemePreview({ mode }: { mode: ThemeMode }) {
  const styles = useThemedStyles(createStyles);

  if (mode === "system") {
    return (
      <View style={styles.swatchLight}>
        <View style={styles.swatchHalf} />
      </View>
    );
  }

  return (
    <View style={mode === "dark" ? styles.swatchDark : styles.swatchLight} />
  );
}

export function GardenSettings() {
  const styles = useThemedStyles(createStyles);
  const { mode, setMode, colors } = useTheme();
  const {
    deviceId,
    wsConnected,
    brokerConnected,
    deviceOnline,
    lastTelemetryAt,
    weatherGate,
    toggleWeatherGate,
    pending,
    reloadConfig,
  } = useGarden();

  return (
    <View style={styles.page}>
      <View>
        <GardenSectionHeader index="01" title="Giao diện" />

        <View style={styles.themeList}>
          {THEME_OPTIONS.map((option) => {
            const active = mode === option.value;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`Giao diện ${option.label}`}
                onPress={() => setMode(option.value)}
                style={({ pressed }) => [
                  styles.themeRow,
                  pressed && styles.pressed,
                ]}
              >
                <ThemePreview mode={option.value} />

                <Text
                  style={[
                    styles.themeLabel,
                    active && styles.themeLabelActive,
                  ]}
                >
                  {option.label}
                </Text>

                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.note}>
          “Theo máy” tự đổi theo cài đặt hiển thị của điện thoại.
        </Text>
      </View>

      <View>
        <GardenSectionHeader
          index="02"
          title="An toàn khi mưa"
          hint="Tự động"
        />

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Chặn tưới khi mưa</Text>
            <Text style={styles.note}>
              Thiết bị tự dừng khi cảm biến mưa phát hiện nước.
            </Text>
          </View>

          <Toggle
            label="Chặn tưới khi mưa"
            value={weatherGate}
            disabled={!deviceOnline || Boolean(pending)}
            onChange={() => void toggleWeatherGate()}
          />
        </View>
      </View>

      <View>
        <GardenSectionHeader
          index="03"
          title="Thiết bị"
          hint={deviceOnline ? "Đang kết nối" : "Mất kết nối"}
          tone={deviceOnline ? undefined : "error"}
        />

        <View style={styles.specs}>
          <SpecRow label="Mã thiết bị" value={deviceId} />
          <SpecRow
            label="WebSocket"
            value={wsConnected ? "Đang kết nối" : "Đang kết nối lại"}
            tone={wsConnected ? "ok" : "error"}
          />
          <SpecRow
            label="MQTT"
            value={
              brokerConnected === null ? "--" : brokerConnected ? "OK" : "Lỗi"
            }
            tone={
              brokerConnected === null
                ? undefined
                : brokerConnected
                  ? "ok"
                  : "error"
            }
          />
          <SpecRow
            label="Cập nhật cuối"
            value={formatClock(lastTelemetryAt)}
            tone={deviceOnline ? undefined : "error"}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tải lại cấu hình"
          onPress={reloadConfig}
          style={({ pressed }) => [styles.reload, pressed && styles.pressed]}
        >
          <AppIcon
            name="refresh"
            size={13}
            color={colors.greenStrong}
            variant="outline"
          />
          <Text style={styles.reloadText}>Tải lại cấu hình</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Mở trang Icons8"
        onPress={() => void Linking.openURL("https://icons8.com")}
        style={styles.credit}
      >
        <Text style={styles.creditText}>Biểu tượng · Icons8</Text>
      </Pressable>
    </View>
  );
}

function SpecRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "error";
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.specRow}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text
        style={[
          styles.specValue,
          tone === "ok" && styles.specOk,
          tone === "error" && styles.specError,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    page: {
      gap: 26,
    },
    themeList: {
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    themeRow: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.lineSoft,
    },
    themeLabel: {
      flex: 1,
      fontFamily: font.medium,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink,
    },
    themeLabelActive: {
      fontFamily: font.semibold,
      color: colors.greenStrong,
    },
    swatchLight: {
      width: 20,
      height: 20,
      borderRadius: 999,
      backgroundColor: "#f4f6f1",
      borderWidth: 1,
      borderColor: "#c9d2c8",
      overflow: "hidden",
    },
    swatchDark: {
      width: 20,
      height: 20,
      borderRadius: 999,
      backgroundColor: "#101512",
      borderWidth: 1,
      borderColor: "#33413a",
    },
    swatchHalf: {
      position: "absolute",
      top: 0,
      bottom: 0,
      right: 0,
      width: 10,
      backgroundColor: "#101512",
    },
    radio: {
      width: 17,
      height: 17,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.faint,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: {
      borderColor: colors.green,
    },
    radioDot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor: colors.green,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontFamily: font.medium,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink,
    },
    note: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 17,
      color: colors.muted,
    },
    specs: {
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    specRow: {
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.lineSoft,
    },
    specLabel: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.muted,
    },
    specValue: {
      flexShrink: 1,
      fontFamily: font.medium,
      fontSize: 12,
      lineHeight: 17,
      fontVariant: ["tabular-nums"],
      textAlign: "right",
      color: colors.inkSoft,
    },
    specOk: {
      color: colors.greenStrong,
    },
    specError: {
      color: colors.red,
    },
    reload: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
    },
    reloadText: {
      fontFamily: font.semibold,
      fontSize: 12,
      lineHeight: 17,
      color: colors.greenStrong,
    },
    pressed: {
      opacity: 0.6,
    },
    credit: {
      alignSelf: "center",
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    creditText: {
      fontFamily: font.semibold,
      fontSize: 9.5,
      lineHeight: 12,
      letterSpacing: 0.9,
      textTransform: "uppercase",
      color: colors.faint,
    },
  });
