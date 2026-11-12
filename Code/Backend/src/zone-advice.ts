import type { Telemetry } from "./domain.js";
import {
  type CropGroup,
  type SoilType,
  isCropGroup,
} from "./zone-profile-repository.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export type GrowthStage =
  | "seedling"
  | "vegetative"
  | "flowering"
  | "bulking"
  | "mature"
  | "harvest"
  | "overdue";

export type GrowthInfo = {
  stage: GrowthStage;
  label: string;
  day: number;
  totalDays: number;
  progress: number;
  daysLeft: number;
  overdueDays: number;
};

type StageRule = { until: number; stage: GrowthStage; label: string };

// Mỗi nhóm cây có mốc giai đoạn riêng, tính theo tỉ lệ ngày đã trồng / tổng ngày.
const STAGE_RULES: Record<CropGroup, StageRule[]> = {
  "Rau ăn lá": [
    { until: 0.25, stage: "seedling", label: "Cây con" },
    { until: 0.8, stage: "vegetative", label: "Phát triển lá" },
    { until: 1, stage: "harvest", label: "Thu hoạch" },
  ],
  "Rau ăn quả": [
    { until: 0.3, stage: "seedling", label: "Cây con" },
    { until: 0.6, stage: "vegetative", label: "Sinh trưởng" },
    { until: 0.9, stage: "flowering", label: "Ra hoa - đậu quả" },
    { until: 1, stage: "harvest", label: "Thu hoạch" },
  ],
  "Cây lấy củ": [
    { until: 0.25, stage: "seedling", label: "Cây con" },
    { until: 0.55, stage: "vegetative", label: "Phát triển thân lá" },
    { until: 0.85, stage: "bulking", label: "Hình thành củ" },
    { until: 1, stage: "harvest", label: "Thu hoạch" },
  ],
  "Cây gia vị": [
    { until: 0.25, stage: "seedling", label: "Cây con" },
    { until: 0.8, stage: "vegetative", label: "Sinh trưởng" },
    { until: 1, stage: "harvest", label: "Thu hoạch" },
  ],
  Khác: [
    { until: 0.25, stage: "seedling", label: "Cây con" },
    { until: 0.6, stage: "vegetative", label: "Sinh trưởng" },
    { until: 0.9, stage: "mature", label: "Trưởng thành" },
    { until: 1, stage: "harvest", label: "Thu hoạch" },
  ],
};

export function growthFor(
  group: string,
  plantedAt: number | null,
  harvestDays: number | null,
  now = Date.now(),
): GrowthInfo | null {
  if (plantedAt === null || harvestDays === null || harvestDays < 1) return null;
  if (plantedAt > now) return null;

  const day = Math.floor((now - plantedAt) / DAY_MS) + 1;
  const ratio = day / harvestDays;
  const rules = STAGE_RULES[isCropGroup(group) ? group : "Khác"];
  const rule = ratio > 1
    ? { stage: "overdue" as const, label: "Quá ngày thu hoạch" }
    : (rules.find((item) => ratio <= item.until) ?? rules[rules.length - 1]);

  return {
    stage: rule.stage,
    label: rule.label,
    day,
    totalDays: harvestDays,
    progress: Math.max(0, Math.min(100, Math.round(ratio * 100))),
    daysLeft: Math.max(harvestDays - day, 0),
    overdueDays: Math.max(day - harvestDays, 0),
  };
}

export type AdviceZone = {
  group: string;
  soil: SoilType;
  /** Ngưỡng và thời lượng người dùng đang dùng, chỉ để so sánh. */
  threshold: number;
  duration: number;
  /** Cấu hình gốc của vùng; khuyến nghị luôn tính từ đây nên áp dụng nhiều lần không bị cộng dồn. */
  baseThreshold: number;
  baseDuration: number;
};

export type ZoneAdvice = {
  currentThreshold: number;
  currentDuration: number;
  suggestedThreshold: number;
  suggestedDuration: number;
  thresholdDelta: number;
  durationDelta: number;
  window: { start: string; end: string } | null;
  windowNote: string;
  summary: string;
  reasons: string[];
  weather: {
    raining: boolean;
    rain: number;
    temperature: number | null;
    humidity: number | null;
    season: "Mùa khô" | "Mùa mưa";
  };
};

function seasonOf(month: number): "Mùa khô" | "Mùa mưa" {
  return month >= 5 && month <= 10 ? "Mùa mưa" : "Mùa khô";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Khuyến nghị chỉ dựa trên dữ liệu cục bộ: giai đoạn cây, loại đất, cảm biến mưa,
 * DHT22 và mùa theo tháng. Không gọi dự báo online, không tự đổi cấu hình.
 */
export function buildZoneAdvice(
  zone: AdviceZone,
  growth: GrowthInfo | null,
  telemetry: Telemetry | null,
  now = Date.now(),
): ZoneAdvice {
  const month = new Date(now).getMonth() + 1;
  const season = seasonOf(month);
  const weather = {
    raining: telemetry?.raining ?? false,
    rain: telemetry?.rain ?? 0,
    temperature: telemetry?.temperature ?? null,
    humidity: telemetry?.humidity ?? null,
    season,
  };

  let thresholdShift = 0;
  let durationShift = 0;
  const reasons: string[] = [];

  if (growth) {
    switch (growth.stage) {
      case "seedling":
        thresholdShift += 5;
        durationShift += 1;
        reasons.push(`Cây con (ngày ${growth.day}/${growth.totalDays}) cần ẩm đều nên tăng nhẹ`);
        break;
      case "flowering":
        thresholdShift += 6;
        durationShift += 2;
        reasons.push(`Ra hoa - đậu quả (ngày ${growth.day}/${growth.totalDays}) cần nhiều nước hơn`);
        break;
      case "bulking":
        thresholdShift += 5;
        durationShift += 1;
        reasons.push(`Hình thành củ (ngày ${growth.day}/${growth.totalDays}) cần ẩm ổn định`);
        break;
      case "harvest":
        thresholdShift -= 5;
        durationShift -= 1;
        reasons.push(`Đang thu hoạch (ngày ${growth.day}/${growth.totalDays}) nên giảm nước`);
        break;
      case "overdue":
        thresholdShift -= 5;
        durationShift -= 1;
        reasons.push(`Đã quá ${growth.overdueDays} ngày so với dự kiến, kiểm tra lại lịch chăm sóc`);
        break;
      default:
        reasons.push(`Giai đoạn ${growth.label.toLowerCase()} (ngày ${growth.day}/${growth.totalDays})`);
        break;
    }
  } else {
    reasons.push("Chưa đủ ngày trồng và số ngày thu hoạch nên chưa xác định giai đoạn");
  }

  switch (zone.soil) {
    case "Đất cát pha":
      thresholdShift += 8;
      durationShift += 2;
      reasons.push("Đất cát pha thoát nước nhanh nên tưới sớm và lâu hơn");
      break;
    case "Đất sét":
      thresholdShift -= 6;
      durationShift -= 2;
      reasons.push("Đất sét giữ ẩm lâu nên giảm ngưỡng và thời lượng");
      break;
    case "Giá thể":
      thresholdShift += 6;
      durationShift += 1;
      reasons.push("Giá thể nhẹ, thoát nước nhanh nên tăng ngưỡng");
      break;
    default:
      reasons.push("Đất thịt giữ ẩm trung bình (mặc định)");
      break;
  }

  if (weather.raining || weather.rain >= 60) {
    thresholdShift -= 12;
    durationShift -= 2;
    reasons.push(
      `Cảm biến mưa báo ${weather.raining ? "đang mưa" : "độ ẩm cao"} (${weather.rain}%) nên hoãn tưới`,
    );
  } else if (weather.rain >= 30) {
    thresholdShift -= 5;
    reasons.push(`Đất còn ẩm do mưa (${weather.rain}%) nên giảm tưới`);
  }

  if (!weather.raining && weather.humidity !== null && weather.humidity >= 80) {
    thresholdShift -= 3;
    reasons.push(`Độ ẩm không khí ${weather.humidity}% cao nên đất lâu khô`);
  }

  if (weather.temperature !== null && weather.temperature >= 35) {
    thresholdShift += 5;
    durationShift += 1;
    reasons.push(`Nắng nóng ${weather.temperature}°C nên cây mất nước nhanh`);
  }

  if (season === "Mùa khô") {
    thresholdShift += 3;
    reasons.push(`Đang mùa khô (tháng ${month}) nên tưới sớm hơn`);
  } else {
    thresholdShift -= 2;
    reasons.push(`Đang mùa mưa (tháng ${month}) nên giảm nhẹ`);
  }

  if (!telemetry) {
    reasons.push("Chưa có dữ liệu cảm biến thời tiết, chỉ dựa vào mùa và loại đất");
  }

  const suggestedThreshold = clamp(
    Math.round((zone.baseThreshold + thresholdShift) / 5) * 5,
    15,
    85,
  );
  const suggestedDuration = clamp(Math.round(zone.baseDuration + durationShift), 1, 60);

  let window: ZoneAdvice["window"] = null;
  let windowNote = "Khung giờ chỉ là gợi ý; ESP32 vẫn tưới theo ngưỡng đất.";
  if (weather.raining) {
    windowNote = "Tạm hoãn tưới đến khi hết mưa.";
  } else if (weather.temperature !== null && weather.temperature >= 35) {
    window = { start: "05:00", end: "06:30" };
  } else if (season === "Mùa khô") {
    window = { start: "05:30", end: "07:00" };
  } else {
    window = { start: "06:00", end: "07:30" };
  }

  const summary = weather.raining
    ? "Đang mưa, chưa nên tưới. Kiểm tra lại khi tạm tắt mưa."
    : `Gợi ý tưới ở ngưỡng ${suggestedThreshold}% trong ${suggestedDuration} phút, khung ${window?.start}–${window?.end}.`;

  return {
    currentThreshold: zone.threshold,
    currentDuration: zone.duration,
    suggestedThreshold,
    suggestedDuration,
    thresholdDelta: suggestedThreshold - zone.threshold,
    durationDelta: suggestedDuration - zone.duration,
    window,
    windowNote,
    summary,
    reasons,
    weather,
  };
}
