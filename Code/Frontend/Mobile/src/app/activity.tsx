import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { Card } from "@/components/ui/Card";
import { ChipRow } from "@/components/ui/ChipRow";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  useActivity,
  type ActivityEvent,
  type ActivityKind,
} from "@/hooks/useActivity";
import { useGarden } from "@/providers/GardenProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { typo, type Palette } from "@/theme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { formatShortTime } from "@/utils/format";

type KindFilter = ActivityKind | "all";

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Mọi loại" },
  { value: "pump", label: "Bơm" },
  { value: "mode", label: "Chế độ" },
  { value: "threshold", label: "Ngưỡng" },
  { value: "weather", label: "Hoãn mưa" },
];

const KIND_ICON: Record<ActivityKind, keyof typeof Ionicons.glyphMap> = {
  pump: "water-outline",
  mode: "sync-outline",
  threshold: "options-outline",
  weather: "rainy-outline",
  other: "ellipse-outline",
};

const STATUS_LABEL = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  timeout: "Không phản hồi",
} as const;

export default function ActivityScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { deviceId, zones } = useGarden();
  const { events, loading, error, reload } = useActivity(deviceId);
  const [kind, setKind] = useState<KindFilter>("all");

  const filtered = useMemo(
    () => (kind === "all" ? events : events.filter((event) => event.kind === kind)),
    [events, kind],
  );

  const kindColors = (event: ActivityEvent) => {
    switch (event.kind) {
      case "pump":
        return { bg: colors.blueSoft, fg: colors.blue };
      case "mode":
        return { bg: colors.greenSoft, fg: colors.greenStrong };
      case "threshold":
        return { bg: colors.amberSoft, fg: colors.amber };
      case "weather":
        return { bg: colors.blueSoft, fg: colors.blue };
      default:
        return { bg: colors.surfaceSunken, fg: colors.muted };
    }
  };

  const zoneName = (zoneId: string | null) =>
    zoneId ? (zones.find((zone) => zone.id === zoneId)?.name ?? zoneId) : null;

  return (
    <Screen>
      <PageHeader
        title="Nhật ký"
        subtitle="Lệnh điều khiển và thay đổi ngưỡng gần đây."
      />

      <Card>
        <SectionHeader
          title="Hoạt động"
          hint={`${filtered.length} SỰ KIỆN · TỰ LÀM MỚI 15 GIÂY`}
        />

        <ChipRow options={KIND_OPTIONS} value={kind} onChange={setKind} />

        {loading && events.length === 0 ? (
          <View style={styles.state}>
            <ActivityIndicator size="small" color={colors.green} />
            <Text style={styles.stateText}>Đang tải nhật ký...</Text>
          </View>
        ) : error && events.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={reload} hitSlop={8}>
              <Text style={styles.retry}>Thử lại</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.stateText}>
              {events.length === 0
                ? "Chưa có lệnh hoặc thay đổi ngưỡng nào."
                : "Không có sự kiện thuộc loại này."}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((event) => {
              const tone = kindColors(event);
              const status = event.status
                ? {
                    label: STATUS_LABEL[event.status],
                    color:
                      event.status === "confirmed"
                        ? colors.greenStrong
                        : event.status === "timeout"
                          ? colors.red
                          : colors.amber,
                  }
                : null;
              const zone = zoneName(event.zoneId);

              return (
                <View key={event.id} style={styles.event}>
                  <View style={[styles.iconBox, { backgroundColor: tone.bg }]}>
                    <Ionicons
                      name={KIND_ICON[event.kind]}
                      size={14}
                      color={tone.fg}
                    />
                  </View>

                  <View style={styles.eventBody}>
                    <Text style={styles.eventText}>{event.text}</Text>
                    <Text style={styles.eventMeta} numberOfLines={1}>
                      {zone ? `${zone} · ` : ""}
                      {formatShortTime(event.at, true)} ·{" "}
                      {formatShortTime(event.at)}
                      {status ? " · " : ""}
                      {status ? (
                        <Text style={{ color: status.color }}>{status.label}</Text>
                      ) : null}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {error && events.length > 0
              ? error
              : "Lệnh do người dùng gửi và các lần đổi ngưỡng được Backend ghi lại."}
          </Text>
          <Pressable accessibilityRole="button" onPress={reload} hitSlop={8}>
            <Text style={styles.reload}>Tải lại</Text>
          </Pressable>
        </View>
      </Card>
    </Screen>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    state: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 20,
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
    list: {
      gap: 2,
    },
    event: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: colors.lineSoft,
    },
    iconBox: {
      width: 28,
      height: 28,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    eventBody: {
      flex: 1,
      gap: 2,
    },
    eventText: {
      ...typo.smallStrong,
      color: colors.ink,
    },
    eventMeta: {
      ...typo.caption,
      color: colors.faint,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingTop: 10,
    },
    footerText: {
      ...typo.caption,
      flex: 1,
      color: colors.faint,
    },
    reload: {
      ...typo.smallStrong,
      color: colors.green,
    },
  });
