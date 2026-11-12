import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { ZoneSettingsForm } from "@/components/settings/ZoneSettingsForm";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ZonePicker } from "@/components/zones/ZonePicker";
import { useGarden } from "@/providers/GardenProvider";
import { colors, spacing } from "@/theme";

export default function SettingsScreen() {
  const { zones, loading, configError, reloadConfig } = useGarden();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const zone = zones.find((item) => item.id === zoneId) ?? zones[0];

  return (
    <Screen>
      <PageHeader
        title="Cấu hình tưới"
        subtitle="Điều chỉnh ngưỡng và lượng nước cho từng khu vườn."
      />

      <Card>
        <SectionHeader title="Khu vườn" hint={zone ? zone.crop : undefined} />
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
      </Card>

      {zone ? <ZoneSettingsForm key={zone.id} zone={zone} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  stateText: {
    fontSize: 12,
    color: colors.faint,
  },
  errorText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.red,
    textAlign: "center",
  },
  retry: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.green,
  },
});
