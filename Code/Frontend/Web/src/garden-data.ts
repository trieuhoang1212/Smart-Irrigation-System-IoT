export const CROP_GROUPS = [
  "Rau ăn lá",
  "Rau ăn quả",
  "Cây lấy củ",
  "Cây gia vị",
  "Cây hoa cảnh",
  "Cây ăn quả / thân gỗ",
  "Sen đá / Xương rồng",
  "Cây trong nhà",
  "Hoa lan",
  "Khác",
] as const;

export type CropGroup = (typeof CROP_GROUPS)[number];

export type WaterWindowHint = { label: string; start: string; end: string; note: string };

// Khung giờ tưới tham khảo theo nhóm cây; bơm vẫn chạy theo độ ẩm, chưa hẹn giờ.
export const GROUP_WATER_HINTS: Record<CropGroup, WaterWindowHint> = {
  "Rau ăn lá": {
    label: "Sáng sớm",
    start: "05:30",
    end: "07:30",
    note: "Tưới sáng để lá khô trước tối, tránh nấm và thối nhũn.",
  },
  "Rau ăn quả": {
    label: "Sáng sớm hoặc chiều mát",
    start: "05:30",
    end: "07:30",
    note: "Có thể tưới thêm 16:00–17:30 khi đất khô; tránh tưới tối.",
  },
  "Cây lấy củ": {
    label: "Sáng sớm",
    start: "05:30",
    end: "07:00",
    note: "Tưới sáng giúp đất ẩm đều cả ngày.",
  },
  "Cây gia vị": {
    label: "Sáng sớm",
    start: "05:30",
    end: "07:30",
    note: "Tưới sáng để lá khô trước tối, tránh nấm và thối nhũn.",
  },
  "Cây hoa cảnh": {
    label: "Sáng sớm",
    start: "06:00",
    end: "08:00",
    note: "Chỉ tưới vào gốc, tránh làm ướt cánh hoa.",
  },
  "Cây ăn quả / thân gỗ": {
    label: "Sáng sớm hoặc chiều mát",
    start: "05:30",
    end: "07:30",
    note: "Có thể tưới 16:00–17:30 để đất giữ ẩm qua đêm.",
  },
  "Sen đá / Xương rồng": {
    label: "Chiều mát",
    start: "16:30",
    end: "18:00",
    note: "Tưới chiều mát để cây hấp thụ tốt, tránh luộc rễ.",
  },
  "Cây trong nhà": {
    label: "Buổi sáng",
    start: "08:00",
    end: "10:00",
    note: "Tưới sáng để nước kịp khô trước khi đóng cửa bật điều hòa.",
  },
  "Hoa lan": {
    label: "Sáng sớm",
    start: "06:00",
    end: "08:00",
    note: "Tưới sáng để lá khô nhanh, tránh thối ngọn.",
  },
  Khác: {
    label: "Sáng sớm",
    start: "05:30",
    end: "07:30",
    note: "Tưới sáng là an toàn nhất cho phần lớn cây trồng.",
  },
};

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
    window: { label: string; start: string; end: string } | null;
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
  overTarget: boolean;
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
    overTarget: false,
    online: false,
    growth: zone.growth ?? null,
    photoUrl: zone.photoUrl ?? null,
    plantedAt: zone.plantedAt ?? null,
    harvestDays: zone.harvestDays ?? null,
    notes: zone.notes ?? "",
  }));
}
