import { GardenSettings } from "@/components/garden/GardenSettings";
import { PageHeader } from "@/components/layout/PageHeader";
import { Screen } from "@/components/layout/Screen";

export default function SettingsScreen() {
  return (
    <Screen>
      <PageHeader
        title="Cài đặt"
        subtitle="Giao diện, an toàn khi mưa và thiết bị."
      />

      <GardenSettings />
    </Screen>
  );
}
