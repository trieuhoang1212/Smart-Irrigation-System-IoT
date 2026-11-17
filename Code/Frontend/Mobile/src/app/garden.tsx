import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { GardenSectionHeader } from "@/components/garden/GardenSectionHeader";
import { ZoneProfileEditor } from "@/components/garden/ZoneProfileEditor";
import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { ZoneSettingsForm } from "@/components/settings/ZoneSettingsForm";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { useGarden } from "@/providers/GardenProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { font, typo, type Palette } from "@/theme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { formatNumber } from "@/utils/format";

type GardenView = "crop" | "irrigation";

const VIEW_OPTIONS: { value: GardenView; label: string; icon: AppIconName }[] = [
  { value: "crop", label: "Cây trồng", icon: "leaf" },
  { value: "irrigation", label: "Tưới", icon: "water" },
];

function parseView(value: string | undefined): GardenView {
  return value === "irrigation" ? value : "crop";
}

export default function GardenScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ zone?: string; at?: string; view?: string }>();

  const {
    zones,
    loading,
    configError,
    reloadConfig,
  } = useGarden();

  // Điều hướng kèm ?zone=...&view=...; đổi tham số thì đổi khu vực và mục.
  const paramKey = `${params.zone ?? ""}|${params.at ?? ""}|${params.view ?? ""}`;
  const [selection, setSelection] = useState<{
    key: string;
    zoneId: string | null;
    view: GardenView;
  }>({
    key: paramKey,
    zoneId: params.zone ?? null,
    view: parseView(params.view),
  });

  if (selection.key !== paramKey) {
    setSelection({
      key: paramKey,
      zoneId: params.zone ?? null,
      view: parseView(params.view),
    });
  }

  const zone = zones.find((item) => item.id === selection.zoneId) ?? zones[0] ?? null;
  const view = selection.view;

  return (
    <Screen>
      <PageHeader
        title="Khu vườn"
        subtitle="Hồ sơ cây trồng và thông số tưới."
      />

      <View style={styles.zoneBlock}>
        <GardenSectionHeader
          index="01"
          title="Khu vực"
          hint={zones.length > 0 ? `${zones.length} khu` : undefined}
        />

        {loading && zones.length === 0 ? (
          <View style={styles.state}>
            <ActivityIndicator size="small" color={colors.green} />
            <Text style={styles.stateText}>Đang tải cấu hình khu vườn...</Text>
          </View>
        ) : configError && zones.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.errorText}>{configError}</Text>
            <Pressable accessibilityRole="button" onPress={reloadConfig} hitSlop={8}>
              <Text style={styles.retry}>Thử lại</Text>
            </Pressable>
          </View>
        ) : zones.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.stateText}>
              Chưa có khu vườn nào được cấu hình trên Backend.
            </Text>
          </View>
        ) : (
          <View style={styles.rail}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.railContent}
            >
              {zones.map((item) => {
                const active = zone?.id === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() =>
                      setSelection((current) => ({ ...current, zoneId: item.id }))
                    }
                    style={[styles.railItem, active && styles.railItemActive]}
                  >
                    <Text style={[styles.railId, active && styles.railIdActive]}>
                      {item.id}
                    </Text>
                    <Text
                      style={[styles.railName, active && styles.railNameActive]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      <Segmented
        value={view}
        onChange={(next) => setSelection((current) => ({ ...current, view: next }))}
      />

      {view === "crop" && zone ? (
        <ZoneProfileEditor
          key={zone.id}
          zone={zone}
          onReload={reloadConfig}
        />
      ) : null}

      {view === "crop" && !zone ? (
        <Text style={styles.stateText}>
          Chọn hoặc tạo khu vườn trước khi chỉnh hồ sơ cây trồng.
        </Text>
      ) : null}

      {view === "irrigation" && zone ? (
        <View style={styles.panel}>
          <GardenSectionHeader
            index="02"
            title="Thông số tưới"
            hint={
              zone.moisture === null
                ? "Chưa có dữ liệu"
                : `Độ ẩm ${formatNumber(zone.moisture, 0)}%`
            }
          />

          <ZoneSettingsForm key={zone.id} zone={zone} />
        </View>
      ) : null}

      {view === "irrigation" && !zone ? (
        <Text style={styles.stateText}>
          Chọn khu vườn trước khi chỉnh thông số tưới.
        </Text>
      ) : null}
    </Screen>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: GardenView;
  onChange: (value: GardenView) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.tabs}>
      {VIEW_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <AppIcon
              name={option.icon}
              variant={active ? "filled" : "outline"}
              size={13}
              color={active ? colors.greenStrong : colors.faint}
            />

            <Text
              style={[styles.tabLabel, active && styles.tabLabelActive]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    zoneBlock: {
      gap: 2,
    },
    rail: {
      borderBottomWidth: 1,
      borderBottomColor: colors.lineSoft,
    },
    railContent: {
      gap: 22,
      paddingRight: 4,
    },
    railItem: {
      gap: 2,
      paddingTop: 2,
      paddingBottom: 9,
      marginBottom: -1,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    railItemActive: {
      borderBottomColor: colors.green,
    },
    railId: {
      fontFamily: font.medium,
      fontSize: 9,
      lineHeight: 11,
      letterSpacing: 0.7,
      color: colors.faint,
    },
    railIdActive: {
      color: colors.green,
    },
    railName: {
      fontFamily: font.semibold,
      fontSize: 14.5,
      lineHeight: 19,
      letterSpacing: -0.2,
      color: colors.inkSoft,
    },
    railNameActive: {
      color: colors.ink,
    },
    tabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.lineSoft,
      marginTop: 2,
    },
    tab: {
      flex: 1,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      marginBottom: -1,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: {
      borderBottomColor: colors.green,
    },
    tabLabel: {
      fontFamily: font.semibold,
      fontSize: 12.5,
      lineHeight: 16,
      letterSpacing: -0.1,
      color: colors.muted,
    },
    tabLabelActive: {
      color: colors.greenStrong,
    },
    panel: {
      gap: 4,
    },
    state: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 14,
    },
    stateText: {
      ...typo.small,
      color: colors.faint,
      textAlign: "center",
      paddingVertical: 6,
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
  });
