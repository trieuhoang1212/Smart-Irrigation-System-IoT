export const CROP_GROUPS = [
  "Rau ăn lá",
  "Rau ăn quả",
  "Cây lấy củ",
  "Cây gia vị",
  "Khác",
] as const;

export type CropGroup = (typeof CROP_GROUPS)[number];

export const SOIL_TYPES = ["Đất phù sa", "Đất đỏ bazan", "Đất cát"] as const;

export type SoilType = (typeof SOIL_TYPES)[number];

export type GrowthInfo = {
  stage: string;
  label: string;
  day: number;
  totalDays: number;
  progress: number;
  daysLeft: number;
  overdueDays: number;
};

export type ZoneAdvice = {
  zoneId: string;
  growth: GrowthInfo | null;
  advice: {
    currentThreshold: number;
    suggestedThreshold: number;
    thresholdDelta: number;
    window: { start: string; end: string } | null;
    windowNote: string;
    summary: string;
    reasons: string[];
    weather: {
      raining: boolean;
      rain: number;
      temperature: number | null;
      humidity: number | null;
      season: string;
    };
  };
};

export type GardenZoneAdvice = ZoneAdvice & { name: string };

export type GardenAdviceResponse = {
  deviceId: string;
  soil: SoilType;
  zones: GardenZoneAdvice[];
};

export type Zone = {
  id: string;
  name: string;
  crop: string;
  group: string;
  growth: GrowthInfo | null;
  moisture: number | null;
  pump: boolean;
  threshold: number;
  stopThreshold: number;
  method: string;
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
  soil: SoilType;
  zones: Array<Omit<Zone, "moisture" | "pump" | "online">>;
};

export function zonesFromConfig(config: GardenConfigResponse): Zone[] {
  return config.zones.map((zone) => ({
    ...zone,
    moisture: null,
    pump: false,
    online: false,
    growth: zone.growth ?? null,
    photoUrl: zone.photoUrl ?? null,
    plantedAt: zone.plantedAt ?? null,
    harvestDays: zone.harvestDays ?? null,
    notes: zone.notes ?? "",
  }));
}
