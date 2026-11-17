import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { radius, spacing, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { AppIcon, type AppIconName } from "../ui/AppIcon";

type PageTarget = "/analysis" | "/history" | "/activity" | "/garden" | "/settings";

type SearchEntry = {
  id: string;
  group: "Khu vườn" | "Trang";
  title: string;
  subtitle: string;
  icon: AppIconName;
  keywords: string[];
  target: { kind: "zone"; zoneId: string } | { kind: "page"; path: PageTarget };
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function scoreEntry(entry: SearchEntry, query: string): number {
  const title = normalize(entry.title);
  if (title.startsWith(query)) return 3;
  if (title.includes(query)) return 2;
  if (entry.keywords.some((keyword) => normalize(keyword).includes(query))) return 1;
  return 0;
}

export function SearchSheet({
  visible,
  onClose,
  onSelectZone,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectZone: (zoneId: string) => void;
  onNavigate: (path: PageTarget) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { zones } = useGarden();

  const [query, setQuery] = useState("");
  // Lịch sử tìm kiếm giữ trong phiên, đủ dùng cho demo và không cần lưu máy.
  const [recent, setRecent] = useState<string[]>([]);

  const entries = useMemo<SearchEntry[]>(() => {
    const zoneEntries: SearchEntry[] = zones.map((zone) => ({
      id: `zone-${zone.id}`,
      group: "Khu vườn",
      title: zone.name,
      subtitle: `${zone.id} · ${zone.crop}`,
      icon: "leaf",
      keywords: [zone.crop, zone.group, zone.id, "khu vườn", "khu vực"],
      target: { kind: "zone", zoneId: zone.id },
    }));

    const pageEntries: SearchEntry[] = [
      {
        id: "page-analysis",
        group: "Trang",
        title: "Phân tích cây trồng",
        subtitle: "Sức khỏe đất, ngưỡng an toàn và gợi ý xử lý",
        icon: "activity",
        keywords: ["phân tích", "chẩn đoán", "sức khỏe", "cây trồng", "ngưỡng"],
        target: { kind: "page", path: "/analysis" },
      },
      {
        id: "page-history",
        group: "Trang",
        title: "Lịch sử dữ liệu",
        subtitle: "Độ ẩm đất, nhiệt độ, thời tiết theo thời gian",
        icon: "chart",
        keywords: ["lịch sử", "biểu đồ", "nhiệt độ", "độ ẩm", "mưa"],
        target: { kind: "page", path: "/history" },
      },
      {
        id: "page-activity",
        group: "Trang",
        title: "Nhật ký hoạt động",
        subtitle: "Lệnh bơm, đổi chế độ và thay đổi ngưỡng",
        icon: "clock",
        keywords: ["nhật ký", "lịch sử lệnh", "hoạt động", "bơm", "thay đổi"],
        target: { kind: "page", path: "/activity" },
      },
      {
        id: "page-garden",
        group: "Trang",
        title: "Khu vườn",
        subtitle: "Hồ sơ cây trồng và thông số tưới",
        icon: "edit",
        keywords: [
          "khu vườn",
          "hồ sơ",
          "cây trồng",
          "ảnh",
          "nhóm cây",
          "ngày trồng",
          "ngưỡng",
          "lưu lượng",
        ],
        target: { kind: "page", path: "/garden" },
      },
      {
        id: "page-settings",
        group: "Trang",
        title: "Cài đặt",
        subtitle: "Giao diện, an toàn khi mưa và thiết bị",
        icon: "settings",
        keywords: [
          "cài đặt",
          "giao diện",
          "sáng",
          "tối",
          "chặn mưa",
          "thiết bị",
          "websocket",
          "mqtt",
        ],
        target: { kind: "page", path: "/settings" },
      },
    ];

    return [...zoneEntries, ...pageEntries];
  }, [zones]);

  const needle = normalize(query);

  const results = useMemo(() => {
    if (!needle) return entries;
    return entries
      .map((entry) => ({ entry, score: scoreEntry(entry, needle) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.entry);
  }, [entries, needle]);

  const groups: { title: string; items: SearchEntry[] }[] = [
    { title: "Khu vườn", items: results.filter((item) => item.group === "Khu vườn") },
    { title: "Trang", items: results.filter((item) => item.group === "Trang") },
  ].filter((group) => group.items.length > 0);

  const remember = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setRecent((current) =>
      [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, 4),
    );
  };

  const select = (entry: SearchEntry) => {
    remember(query);
    if (entry.target.kind === "zone") {
      onSelectZone(entry.target.zoneId);
    } else {
      onNavigate(entry.target.path);
    }
    onClose();
  };

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        accessibilityLabel="Đóng tìm kiếm"
        style={styles.backdrop}
        onPress={close}
      />

      <View style={[styles.panel, { marginTop: insets.top + 10 }]}>
        <View style={styles.searchRow}>
          <AppIcon name="search" variant="outline" size={17} color={colors.faint} />

          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm khu vườn, thông số..."
            placeholderTextColor={colors.faint}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
          />

          <Pressable accessibilityLabel="Đóng" onPress={close} hitSlop={10}>
            <AppIcon name="close" variant="outline" size={19} color={colors.muted} />
          </Pressable>
        </View>

        {!needle && recent.length > 0 ? (
          <View style={styles.recentRow}>
            <Text style={styles.recentLabel}>Gần đây</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.recentChips}>
                {recent.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setQuery(item)}
                    style={styles.recentChip}
                  >
                    <Text style={styles.recentChipText}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.results}
        >
          {groups.length === 0 ? (
            <Text style={styles.empty}>
              Không tìm thấy khu vườn hay trang phù hợp.
            </Text>
          ) : (
            groups.map((group) => (
              <View key={group.title} style={styles.group}>
                <Text style={styles.groupTitle}>{group.title}</Text>

                {group.items.map((entry) => (
                  <Pressable
                    key={entry.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${entry.title}, ${entry.subtitle}`}
                    onPress={() => select(entry)}
                    style={({ pressed }) => [
                      styles.result,
                      pressed && styles.resultPressed,
                    ]}
                  >
                    <View style={styles.resultIcon}>
                      <AppIcon name={entry.icon} size={16} color={colors.green} />
                    </View>

                    <View style={styles.resultText}>
                      <Text style={styles.resultTitle} numberOfLines={1}>
                        {entry.title}
                      </Text>
                      <Text style={styles.resultSubtitle} numberOfLines={1}>
                        {entry.subtitle}
                      </Text>
                    </View>

                    <AppIcon
                      name="chevronRight"
                      variant="outline"
                      size={14}
                      color={colors.faint}
                    />
                  </Pressable>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    backdrop: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.overlay,
    },
    panel: {
      marginHorizontal: 12,
      maxHeight: "72%",
      padding: 12,
      gap: 10,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surfaceRaised,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.2,
      shadowRadius: 30,
      elevation: 16,
    },
    searchRow: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.canvas,
    },
    input: {
      flex: 1,
      ...typo.body,
      color: colors.ink,
      paddingVertical: 8,
      outlineWidth: 0,
      outlineColor: "transparent",
    },
    recentRow: {
      gap: 6,
    },
    recentLabel: {
      ...typo.micro,
      color: colors.faint,
      paddingHorizontal: 2,
    },
    recentChips: {
      flexDirection: "row",
      gap: 6,
    },
    recentChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSunken,
    },
    recentChipText: {
      ...typo.caption,
      color: colors.inkSoft,
    },
    results: {
      flexGrow: 0,
    },
    group: {
      gap: 4,
      paddingBottom: 8,
    },
    groupTitle: {
      ...typo.micro,
      color: colors.faint,
      paddingHorizontal: 2,
      paddingVertical: 4,
    },
    result: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 9,
      borderRadius: 12,
    },
    resultPressed: {
      backgroundColor: colors.surfaceSunken,
    },
    resultIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.greenSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    resultText: {
      flex: 1,
      gap: 1,
    },
    resultTitle: {
      ...typo.bodyStrong,
      color: colors.ink,
    },
    resultSubtitle: {
      ...typo.caption,
      color: colors.muted,
    },
    empty: {
      ...typo.small,
      color: colors.faint,
      textAlign: "center",
      paddingVertical: spacing.lg,
    },
  });
