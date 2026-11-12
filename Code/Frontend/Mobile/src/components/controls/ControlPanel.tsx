import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useGarden } from "../../providers/GardenProvider";
import { colors, spacing } from "../../theme";
import { Card } from "../ui/Card";
import { SectionHeader } from "../ui/SectionHeader";
import { ModeSwitch } from "./ModeSwitch";
import { PumpButton } from "./PumpButton";
import { WeatherGateToggle } from "./WeatherGateToggle";

export function ControlPanel() {
  const { pending } = useGarden();

  return (
    <Card>
      <SectionHeader title="Điều khiển" hint={pending ? "ĐANG GỬI" : undefined} />
      <View style={styles.stack}>
        <ModeSwitch />
        <PumpButton />
        <WeatherGateToggle />
        {pending && (
          <View style={styles.pending}>
            <ActivityIndicator size="small" color={colors.green} />
            <Text style={styles.pendingText}>{pending}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pendingText: {
    fontSize: 11.5,
    color: colors.muted,
  },
});
