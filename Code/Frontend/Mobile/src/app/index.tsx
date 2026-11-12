import { StyleSheet, Text } from "react-native";

import { ControlPanel } from "@/components/controls/ControlPanel";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { SystemStatusCard } from "@/components/dashboard/SystemStatusCard";
import { AppHeader } from "@/components/layout/AppHeader";
import { Screen } from "@/components/layout/Screen";
import { Card } from "@/components/ui/Card";
import { ZoneList } from "@/components/zones/ZoneList";
import { useGarden } from "@/providers/GardenProvider";
import { colors, spacing } from "@/theme";

export default function OverviewScreen() {
  const { telemetry } = useGarden();

  return (
    <Screen>
      <AppHeader />
      {telemetry === null ? (
        <Card style={styles.notice}>
          <Text style={styles.noticeText}>
            Chưa nhận được dữ liệu từ ESP32. Kiểm tra thiết bị, MQTT và Backend.
          </Text>
        </Card>
      ) : null}
      <MetricsGrid />
      <ControlPanel />
      <SystemStatusCard />
      <ZoneList />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: {
    paddingVertical: spacing.md,
    backgroundColor: colors.amberSoft,
    borderColor: colors.amberSoft,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.amber,
  },
});
