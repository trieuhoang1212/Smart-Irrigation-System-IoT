import { StyleSheet, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { spacing } from "../../theme";
import { formatNumber } from "../../utils/format";
import { MetricCard } from "./MetricCard";

export function MetricsGrid() {
  const { telemetry } = useGarden();
  const raining = telemetry?.raining ?? false;

  return (
    <View style={styles.row}>
      <MetricCard
        icon="thermometer-outline"
        label="Nhiệt độ"
        value={telemetry?.temperature == null ? "--" : `${formatNumber(telemetry.temperature, 1)}°`}
        hint="Cảm biến DHT22"
        accent="#a5762c"
      />
      <MetricCard
        icon="water-outline"
        label="Độ ẩm khí"
        value={telemetry?.humidity == null ? "--" : `${formatNumber(telemetry.humidity, 0)}%`}
        hint="Độ ẩm không khí"
        accent="#3d6f8c"
      />
      <MetricCard
        icon="rainy-outline"
        label="Cảm biến mưa"
        value={raining ? "Có mưa" : "Khô"}
        hint={`Mức mưa ${formatNumber(telemetry?.rain, 0)}%`}
        accent={raining ? "#4f7f91" : "#5f9370"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
