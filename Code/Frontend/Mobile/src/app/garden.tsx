import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ZoneProfileEditor } from "@/components/garden/ZoneProfileEditor";
import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { ZoneSettingsForm } from "@/components/settings/ZoneSettingsForm";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ZonePicker } from "@/components/zones/ZonePicker";
import { useGarden } from "@/providers/GardenProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { radius, typo, type Palette } from "@/theme";
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

      <Card>
        <SectionHeader
          title="Khu vực"
          hint={zone ? zone.group.toUpperCase() : `${zones.length} KHU`}
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
          <ZonePicker
            zones={zones}
            value={zone?.id ?? ""}
            onChange={(zoneId) =>
              setSelection((current) => ({ ...current, zoneId }))
            }
          />
        )}
      </Card>

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
        <Card>
          <Text style={styles.stateText}>
            Chọn hoặc tạo khu vườn trước khi chỉnh hồ sơ cây trồng.
          </Text>
        </Card>
      ) : null}

      {view === "irrigation" && zone ? (
        <Card>
          <SectionHeader
            title="Thông số tưới"
            hint={
              zone.moisture === null
                ? "CHƯA CÓ DỮ LIỆU"
                : `ĐỘ ẨM ${formatNumber(zone.moisture, 0)}%`
            }
          />

          <ZoneSettingsForm key={zone.id} zone={zone} embedded />
        </Card>
      ) : null}

      {view === "irrigation" && !zone ? (
        <Card>
          <Text style={styles.stateText}>
            Chọn khu vườn trước khi chỉnh thông số tưới.
          </Text>
        </Card>
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
    <View style={styles.segments}>
      {VIEW_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <AppIcon
              name={option.icon}
              variant={active ? "filled" : "outline"}
              size={14}
              color={active ? colors.greenStrong : colors.faint}
            />

            <Text
              style={[styles.segmentLabel, active && styles.segmentLabelActive]}
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
    state: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
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
    segments: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSunken,
    },
    segment: {
      flex: 1,
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: "transparent",
    },
    segmentActive: {
      backgroundColor: colors.greenSoft,
      borderColor: colors.green,
    },
    segmentLabel: {
      ...typo.smallStrong,
      color: colors.muted,
    },
    segmentLabelActive: {
      color: colors.greenStrong,
    },
  });
