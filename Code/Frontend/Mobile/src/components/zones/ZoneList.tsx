import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { colors, spacing } from "../../theme";
import { SectionHeader } from "../ui/SectionHeader";
import { ZoneCard } from "./ZoneCard";

export function ZoneList() {
  const { zones, toggleZonePump, pending, loading, configError, reloadConfig } = useGarden();

  return (
    <View>
      <SectionHeader title="Khu vườn" hint={`${zones.length || 6} KHU`} />

      {loading && zones.length === 0 ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.green} />
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
        <View style={styles.list}>
          {zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              disabled={Boolean(pending)}
              onTogglePump={(zoneId) => void toggleZonePump(zoneId)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  state: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
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
