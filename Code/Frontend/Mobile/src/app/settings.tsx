import { GardenSettings } from "@/components/garden/GardenSettings";
import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";
import { useGarden } from "@/providers/GardenProvider";

export default function SettingsScreen() {
  const { deviceOnline, lastTelemetryAt } = useGarden();

  return (
    <Screen>
      <PageHeader
        title="Cài đặt"
        showSettings={false}
        status={{ online: deviceOnline, at: lastTelemetryAt }}
      />

      <GardenSettings />
    </Screen>
  );
}
