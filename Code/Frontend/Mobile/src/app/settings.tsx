import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { ZoneSettingsForm } from "@/components/settings/ZoneSettingsForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipRow } from "@/components/ui/ChipRow";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Toggle } from "@/components/ui/Toggle";
import { ZonePicker } from "@/components/zones/ZonePicker";
import { useGarden } from "@/providers/GardenProvider";
import { useTheme, type ThemeMode } from "@/providers/ThemeProvider";
import { spacing, typo, type Palette } from "@/theme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { formatClock } from "@/utils/format";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Theo máy" },
  { value: "light", label: "Sáng" },
  { value: "dark", label: "Tối" },
];

export default function SettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors, mode, setMode } = useTheme();
  const params = useLocalSearchParams<{ zone?: string; at?: string }>();

  const {
    deviceId,
    zones,
    loading,
    configError,
    reloadConfig,
    wsConnected,
    brokerConnected,
    deviceOnline,
    lastTelemetryAt,
    weatherGate,
    toggleWeatherGate,
    pending,
  } = useGarden();

  // Điều hướng từ Tổng quan sang kèm ?zone=...; đổi tham số thì đổi khu vực.
  const paramZone = params.zone;
  // `at` đổi mỗi lần bấm "Chỉnh thông số tưới" để mở lại đúng khu vực vừa chọn.
  const paramKey = `${paramZone ?? ""}|${params.at ?? ""}`;
  const [selection, setSelection] = useState<{
    key: string;
    zoneId: string | null;
  }>({ key: paramKey, zoneId: paramZone ?? null });

  if (selection.key !== paramKey) {
    setSelection({ key: paramKey, zoneId: paramZone ?? null });
  }

  const zoneId = selection.zoneId;
  const setZoneId = (next: string | null) => setSelection({ key: paramKey, zoneId: next });

  const zone = zones.find((item) => item.id === zoneId) ?? zones[0];

  return (
    <Screen>
      <PageHeader
        title="Cài đặt"
        subtitle="Giao diện, an toàn khi mưa và thông số tưới."
      />

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
          value={
            brokerConnected === null ? "--" : brokerConnected ? "OK" : "Lỗi"
          }
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

      <Card style={styles.card}>
        <SectionHeader
          title="Thông số tưới"
          hint={zone ? zone.crop.toUpperCase() : undefined}
        />

        {loading && zones.length === 0 ? (
          <View style={styles.state}>
            <ActivityIndicator size="small" color={colors.green} />
            <Text style={styles.stateText}>Đang tải cấu hình khu vườn...</Text>
          </View>
        ) : configError ? (
          <View style={styles.state}>
            <Text style={styles.errorText}>{configError}</Text>
            <Text style={styles.retry} onPress={reloadConfig}>
              Thử lại
            </Text>
          </View>
        ) : (
          <ZonePicker zones={zones} value={zone?.id ?? ""} onChange={setZoneId} />
        )}

        {zone ? <ZoneSettingsForm key={zone.id} zone={zone} embedded /> : null}
      </Card>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Mở trang Icons8"
        onPress={() => void Linking.openURL("https://icons8.com")}
        style={styles.credit}
      >
        <Text style={styles.creditText}>Biểu tượng: Icons8</Text>
      </Pressable>
    </Screen>
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
    state: {
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    stateText: {
      ...typo.small,
      color: colors.faint,
      textAlign: "center",
    },
    errorText: {
      ...typo.small,
      color: colors.red,
      textAlign: "center",
    },
    retry: {
      ...typo.smallStrong,
      color: colors.green,
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
