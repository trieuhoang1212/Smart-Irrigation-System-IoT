import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { colors, spacing } from "../../theme";
import { SectionHeader } from "../ui/SectionHeader";
import { ZoneCard } from "./ZoneCard";

export function ZoneList() {
  const {
    zones,
    toggleZonePump,
    pending,
    loading,
    configError,
    reloadConfig,
  } = useGarden();

  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);

  const handleExpand = (zoneId: string) => {
    setExpandedZoneId((current) =>
      current === zoneId ? null : zoneId
    );
  };

  return (
    <View>
      <SectionHeader title="Khu vườn" hint={`${zones.length || 6} KHU`} />

      {loading && zones.length === 0 ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.stateText}>
            Đang tải cấu hình khu vườn...
          </Text>
        </View>
      ) : configError ? (
        <View style={styles.state}>
          <Text style={styles.errorText}>{configError}</Text>
          <Text style={styles.retry} onPress={reloadConfig}>
            Thử lại
          </Text>
        </View>
      ) : zones.length === 0 ? (
        <View style={styles.state}>
          <Text style={styles.stateText}>
            Chưa có khu vực vườn nào được cấu hình.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {zones.map((zone) => {
            const expanded = expandedZoneId === zone.id;

            return (
              <View
                key={zone.id}
                style={[
                  styles.gridItem,
                  expanded && styles.expandedItem,
                ]}
              >
                <ZoneCard
                  zone={zone}
                  expanded={expanded}
                  onExpand={() => handleExpand(zone.id)}
                  disabled={Boolean(pending)}
                  onTogglePump={(zoneId) =>
                    void toggleZonePump(zoneId)
                  }
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
  },
  gridItem: {
    width: "50%",
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  expandedItem: {
    width: "100%",
  },
  state: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  stateText: {
    fontSize: 13,
    color: colors.faint,
    textAlign: "center",
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.red,
    textAlign: "center",
  },
  retry: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.green,
  },
});
