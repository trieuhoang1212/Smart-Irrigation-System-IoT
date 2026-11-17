import type { GrowthInfo } from "../api/types";

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

type WaterWindow = { label: string; start: string; end: string; note: string };

// Khung giờ tưới tham khảo theo nhóm cây, đồng bộ với Web.
// Hệ thống vẫn tưới theo độ ẩm, chưa hẹn giờ.
export const GROUP_WATER_HINTS: Record<CropGroup, WaterWindow> = {
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

export function initialGroup(group: string): CropGroup {
  return CROP_GROUPS.includes(group as CropGroup) ? (group as CropGroup) : "Khác";
}

export function toDateInput(timestamp: number | null | undefined): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromDateInput(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date.getTime();
}

export function formatDate(timestamp: number | null): string {
  if (timestamp === null) return "Chưa cập nhật";
  return new Date(timestamp).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function harvestDate(
  plantedAt: number | null,
  harvestDays: number | null,
): string | null {
  if (plantedAt === null || harvestDays === null) return null;
  return formatDate(plantedAt + harvestDays * 24 * 60 * 60 * 1000);
}

export function growthSummary(growth: GrowthInfo | null | undefined): string | null {
  if (!growth) return null;

  const base = `Ngày ${growth.day}/${growth.totalDays} · ${growth.label}`;
  if (growth.overdueDays > 0) return `${base} · trễ ${growth.overdueDays} ngày`;
  if (growth.daysLeft > 0) return `${base} · còn ${growth.daysLeft} ngày`;
  return base;
}
