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
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { LedgerTabs } from "@/components/ui/LedgerTabs";
import { Panel } from "@/components/ui/Panel";
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

const KIND_ICON: Record<ActivityKind, AppIconName> = {
  pump: "water",
  mode: "auto",
  threshold: "sliders",
  weather: "rain",
  other: "more",
};

const STATUS_LABEL = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  timeout: "Không phản hồi",
} as const;

// Nhật ký mở đầu bằng một đoạn ngắn; phần còn lại mở dần để trang không dài.
const INITIAL_VISIBLE = 10;

type DayGroup = {
  key: string;
  label: string;
  events: ActivityEvent[];
};

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayLabel(timestamp: number): string {
  const diff = Math.round(
    (startOfDay(Date.now()) - startOfDay(timestamp)) / 86_400_000,
  );
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Hôm qua";
  return new Date(timestamp).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ActivityScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { deviceId, zones, deviceOnline, lastTelemetryAt } = useGarden();
  const { events, loading, error, reload } = useActivity(deviceId);
  const [kind, setKind] = useState<KindFilter>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const filtered = useMemo(
    () => (kind === "all" ? events : events.filter((event) => event.kind === kind)),
    [events, kind],
  );

  const groups = useMemo<DayGroup[]>(() => {
    const result: DayGroup[] = [];

    for (const event of filtered.slice(0, visibleCount)) {
      const key = String(startOfDay(event.at));
      const current = result[result.length - 1];

      if (current && current.key === key) {
        current.events.push(event);
      } else {
        result.push({ key, label: dayLabel(event.at), events: [event] });
      }
    }

    return result;
  }, [filtered, visibleCount]);

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

  const shown = Math.min(visibleCount, filtered.length);

  return (
    <Screen>
      <PageHeader
        title="Nhật ký"
        status={{ online: deviceOnline, at: lastTelemetryAt }}
      />

      <Panel
        index="01"
        title="Hoạt động"
        hint={`${filtered.length} sự kiện`}
        footer={
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {error && events.length > 0
                ? error
                : `Hiển thị ${shown}/${filtered.length} · Lệnh và thay đổi ngưỡng do Backend ghi lại.`}
            </Text>
            <Pressable accessibilityRole="button" onPress={reload} hitSlop={8}>
              <Text style={styles.reload}>Tải lại</Text>
            </Pressable>
          </View>
        }
      >
        <LedgerTabs
          options={KIND_OPTIONS}
          value={kind}
          onChange={(next) => {
            setKind(next);
            setVisibleCount(INITIAL_VISIBLE);
          }}
        />

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
            {groups.map((group) => (
              <View key={group.key} style={styles.group}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayLabel}>{group.label}</Text>
                  <View style={styles.dayRule} />
                  <Text style={styles.dayCount}>
                    {group.events.length} sự kiện
                  </Text>
                </View>

                {group.events.map((event) => {
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
                        <AppIcon
                          name={KIND_ICON[event.kind]}
                          size={13}
                          color={tone.fg}
                        />
                      </View>

                      <View style={styles.eventBody}>
                        <Text style={styles.eventText}>{event.text}</Text>
                        <Text style={styles.eventMeta} numberOfLines={1}>
                          {zone ? `${zone} · ` : ""}
                          {formatShortTime(event.at)}
                          {status ? " · " : ""}
                          {status ? (
                            <Text style={{ color: status.color }}>
                              {status.label}
                            </Text>
                          ) : null}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}

            {filtered.length > visibleCount ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setVisibleCount(filtered.length)}
                style={({ pressed }) => [
                  styles.more,
                  pressed && styles.morePressed,
                ]}
              >
                <Text style={styles.moreText}>
                  Xem thêm {filtered.length - visibleCount} sự kiện
                </Text>
              </Pressable>
            ) : visibleCount > INITIAL_VISIBLE ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setVisibleCount(INITIAL_VISIBLE)}
                style={({ pressed }) => [
                  styles.more,
                  pressed && styles.morePressed,
                ]}
              >
                <Text style={styles.moreText}>Thu gọn</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </Panel>
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
      gap: 6,
    },
    group: {
      gap: 1,
    },
    dayHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingTop: 6,
      paddingBottom: 2,
    },
    dayLabel: {
      ...typo.micro,
      color: colors.greenStrong,
    },
    dayRule: {
      flex: 1,
      height: 1,
      backgroundColor: colors.lineSoft,
    },
    dayCount: {
      ...typo.caption,
      color: colors.faint,
    },
    event: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.lineSoft,
    },
    iconBox: {
      width: 26,
      height: 26,
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
    more: {
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.lineSoft,
    },
    morePressed: {
      opacity: 0.7,
    },
    moreText: {
      ...typo.smallStrong,
      color: colors.greenStrong,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
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
