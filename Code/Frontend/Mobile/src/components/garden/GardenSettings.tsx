import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme, type ThemeMode } from "../../providers/ThemeProvider";
import { spacing, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatClock } from "../../utils/format";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ChipRow } from "../ui/ChipRow";
import { SectionHeader } from "../ui/SectionHeader";
import { Toggle } from "../ui/Toggle";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Theo máy" },
  { value: "light", label: "Sáng" },
  { value: "dark", label: "Tối" },
];

export function GardenSettings() {
  const styles = useThemedStyles(createStyles);
  const { mode, setMode } = useTheme();
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
    <>
      <Card style={styles.card}>
        <SectionHeader title="Giao diện" hint="SÁNG / TỐI" />

        <ChipRow options={THEME_OPTIONS} value={mode} onChange={setMode} />

        <Text style={styles.hint}>
          “Theo máy” tự đổi theo cài đặt hệ thống của điện thoại.
        </Text>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="An toàn khi mưa" hint="TỰ ĐỘNG" />

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Chặn tưới khi mưa</Text>
            <Text style={styles.hint}>
              Thiết bị tự dừng tưới khi cảm biến mưa phát hiện nước.
            </Text>
          </View>

          <Toggle
            label="Chặn tưới khi mưa"
            value={weatherGate}
            disabled={!deviceOnline || Boolean(pending)}
            onChange={() => void toggleWeatherGate()}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <SectionHeader
          title="Thiết bị"
          hint={deviceOnline ? "ĐANG KẾT NỐI" : "MẤT KẾT NỐI"}
        />

        <InfoRow label="Mã thiết bị" value={deviceId} />

        <InfoRow
          label="WebSocket"
          value={wsConnected ? "Đang kết nối" : "Đang kết nối lại"}
          tone={wsConnected ? "ok" : "error"}
        />

        <InfoRow
          label="MQTT"
          value={brokerConnected === null ? "--" : brokerConnected ? "OK" : "Lỗi"}
          tone={
            brokerConnected === null ? undefined : brokerConnected ? "ok" : "error"
          }
        />

        <InfoRow
          label="Cập nhật cuối"
          value={formatClock(lastTelemetryAt)}
          tone={deviceOnline ? undefined : "error"}
        />

        <Button
          label="Tải lại cấu hình"
          variant="secondary"
          onPress={reloadConfig}
          style={styles.reload}
        />
      </Card>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Mở trang Icons8"
        onPress={() => void Linking.openURL("https://icons8.com")}
        style={styles.credit}
      >
        <Text style={styles.creditText}>Biểu tượng: Icons8</Text>
      </Pressable>
    </>
  );
}

function InfoRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "error";
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          tone === "ok" && { color: colors.greenStrong },
          tone === "error" && { color: colors.red },
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
    card: {
      gap: spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    rowText: {
      flex: 1,
      gap: 3,
    },
    rowTitle: {
      ...typo.bodyStrong,
      color: colors.ink,
    },
    hint: {
      ...typo.caption,
      color: colors.faint,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
      paddingVertical: 7,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    infoLabel: {
      ...typo.small,
      color: colors.muted,
    },
    infoValue: {
      ...typo.smallStrong,
      color: colors.ink,
      flexShrink: 1,
      textAlign: "right",
    },
    reload: {
      marginTop: spacing.sm,
      alignSelf: "flex-start",
    },
    credit: {
      alignSelf: "center",
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    creditText: {
      ...typo.caption,
      color: colors.faint,
    },
  });
