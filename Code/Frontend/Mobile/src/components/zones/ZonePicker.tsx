import type { LiveZone } from "../../api/types";
import { ChipRow } from "../ui/ChipRow";

export function ZonePicker({
  zones,
  value,
  onChange,
}: {
  zones: LiveZone[];
  value: string;
  onChange: (zoneId: string) => void;
}) {
  return (
    <ChipRow
      options={zones.map((zone) => ({ value: zone.id, label: zone.name }))}
      value={value}
      onChange={onChange}
    />
  );
}
