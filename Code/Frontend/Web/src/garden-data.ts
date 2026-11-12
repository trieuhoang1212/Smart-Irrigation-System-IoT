export const CROP_GROUPS = [
  "Rau ăn lá",
  "Rau ăn quả",
  "Cây lấy củ",
  "Cây gia vị",
  "Khác",
] as const;

export type CropGroup = (typeof CROP_GROUPS)[number];

export type Zone = {
  id: string;
  name: string;
  crop: string;
  group: string;
  moisture: number | null;
  pump: boolean;
  threshold: number;
  stopThreshold: number;
  method: string;
  duration: number;
  pumpSeconds: number;
  flowLitersPerHour: number;
  targetLiters: number;
  color: string;
  online: boolean;
  photoUrl: string | null;
  plantedAt: number | null;
  harvestDays: number | null;
  notes: string;
};

export type GardenConfigResponse = {
  deviceId: string;
  zones: Array<Omit<Zone, "moisture" | "pump" | "online">>;
};

export function zonesFromConfig(config: GardenConfigResponse): Zone[] {
  return config.zones.map((zone) => ({
    ...zone,
    moisture: null,
    pump: false,
    online: false,
    photoUrl: zone.photoUrl ?? null,
    plantedAt: zone.plantedAt ?? null,
    harvestDays: zone.harvestDays ?? null,
    notes: zone.notes ?? "",
  }));
}
