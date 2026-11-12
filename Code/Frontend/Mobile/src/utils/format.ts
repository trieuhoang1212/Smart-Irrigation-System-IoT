export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "--";
  return value.toFixed(digits);
}

export function formatClock(timestamp: number | null): string {
  if (!timestamp) return "Chưa có dữ liệu";
  return new Date(timestamp).toLocaleTimeString("vi-VN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatShortTime(timestamp: number, withDate = false): string {
  const date = new Date(timestamp);
  if (withDate) {
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  }
  return date.toLocaleTimeString("vi-VN", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

export function moistureLabel(moisture: number | null, threshold: number): string {
  if (moisture === null) return "Chưa có dữ liệu";
  return moisture < threshold ? "Cần tưới" : "Đủ ẩm";
}
