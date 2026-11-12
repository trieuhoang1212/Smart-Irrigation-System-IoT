import { StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { colors, spacing } from "../../theme";
import { Card } from "../ui/Card";
import { SectionHeader } from "../ui/SectionHeader";

function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" | "off" }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          styles.value,
          tone === "ok" && styles.valueOk,
          tone === "off" && styles.valueOff,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function SystemStatusCard() {
  const { mode, pump, weatherGate, servoAngle } = useGarden();

  return (
    <Card>
      <SectionHeader title="Trạng thái hệ thống" hint="LIVE" />
      <Row label="Chế độ" value={mode === "auto" ? "Tự động" : "Thủ công"} />
      <Row label="Bơm tổng" value={pump ? "Đang bật" : "Đang tắt"} tone={pump ? "ok" : "off"} />
      <Row label="Chặn tưới khi mưa" value={weatherGate ? "Bật" : "Tắt"} />
      <Row label="Góc servo" value={`${servoAngle}°`} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  label: {
    fontSize: 12.5,
    color: colors.muted,
  },
  value: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.ink,
  },
  valueOk: {
    color: colors.greenStrong,
  },
  valueOff: {
    color: colors.faint,
  },
});
