import type { Zone } from "../garden-data";

export type ZoneStatusTone = "ok" | "dry" | "watering" | "offline";

export function zoneStatus(zone: Zone): { tone: ZoneStatusTone; label: string } {
  if (!zone.online) return { tone: "offline", label: "Chưa có dữ liệu" };
  if (zone.pump) return { tone: "watering", label: "Đang tưới" };
  if (zone.moisture !== null && zone.moisture < zone.threshold) {
    return { tone: "dry", label: "Cần tưới" };
  }
  return { tone: "ok", label: "Đủ ẩm" };
}
