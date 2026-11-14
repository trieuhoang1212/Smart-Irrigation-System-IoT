
import { StyleSheet, Text } from "react-native";

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

      {telemetry === null && (
        <Card style={styles.notice}>
          <Text style={styles.noticeTitle}>
            Chưa có dữ liệu thiết bị
          </Text>

          <Text style={styles.noticeText}>
            Vui lòng kiểm tra kết nối thiết bị và hệ thống.
          </Text>
        </Card>
      )}

      {/* Thông tin môi trường */}
      <MetricsGrid />

      {/* Danh sách khu vườn */}
      <ZoneList />

      {/* Trạng thái hệ thống ở cuối */}
      <SystemStatusCard />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: {
    paddingVertical: spacing.md,
    backgroundColor: colors.amberSoft,
    borderColor: colors.amberSoft,
    gap: spacing.xs,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.amber,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.amber,
  },
});
