import type { HistorySample, LiveZone, Mode } from "../api/types";
import { formatNumber } from "./format";

export type AnalysisTone = "success" | "warning" | "error" | "neutral";

export type MoistureAnalysis = {
  tone: AnalysisTone;
  headline: string;
  summary: string;
  advice: string[];
  sampleCount: number;
  current: number | null;
  average: number | null;
  min: number | null;
  max: number | null;
  inSafePct: number | null;
  safeLow: number;
  safeHigh: number;
  lastSampleAt: number | null;
};

/**
 * Chỉ kết luận trên số đo còn sống. Khi thiết bị rơi mạng, mẫu cũ chỉ dùng
 * để tham khảo và luôn hiển thị cảnh báo dữ liệu đã cũ.
 */
export function analyzeMoisture({
  samples,
  zone,
  online,
  mode,
  tankEmpty,
  raining,
  rainBlock,
}: {
  samples: HistorySample[];
  zone: LiveZone;
  online: boolean;
  mode: Mode;
  tankEmpty: boolean;
  raining: boolean;
  rainBlock: boolean;
}): MoistureAnalysis {
  const clean = samples.filter((sample) => Number.isFinite(sample.moisture));
  const values = clean.map((sample) => sample.moisture);
  const safeLow = Math.min(zone.threshold, zone.stopThreshold);
  const safeHigh = Math.max(zone.threshold, zone.stopThreshold);
  const current = online ? zone.moisture : null;

  const inSafePct =
    values.length === 0
      ? null
      : (values.filter((value) => value >= safeLow && value <= safeHigh).length /
          values.length) *
        100;

  const average =
    values.length === 0
      ? null
      : values.reduce((total, value) => total + value, 0) / values.length;

  const base = {
    sampleCount: clean.length,
    current,
    average,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    inSafePct,
    safeLow,
    safeHigh,
    lastSampleAt: clean.length ? clean[clean.length - 1].recordedAt : null,
  };

  if (current === null && values.length === 0) {
    return {
      ...base,
      tone: "neutral",
      headline: "Chưa đủ dữ liệu",
      summary:
        "Cần ESP32 gửi telemetry để bắt đầu phân tích. Dữ liệu sẽ xuất hiện sau khi Backend nhận mẫu đầu tiên.",
      advice: ["Kiểm tra ESP32 đã gửi telemetry và Backend đang chạy chưa."],
    };
  }

  if (!online) {
    return {
      ...base,
      tone: "warning",
      headline: "Dữ liệu đã cũ",
      summary:
        "Thiết bị đang mất kết nối. Các số liệu bên dưới là lần cập nhật gần nhất, không dùng để kết luận cây đang ổn.",
      advice: ["Kiểm tra nguồn ESP32 và kết nối Wi-Fi rồi tải lại."],
    };
  }

  const advice: string[] = [];

  if (tankEmpty) advice.push("Bồn đã cạn nước, cần châm thêm trước khi tưới.");
  if (raining && rainBlock) {
    advice.push("Cảm biến đang phát hiện mưa nên thiết bị tạm dừng tưới.");
  }

  let tone: AnalysisTone = "success";
  let headline = "Đang trong ngưỡng an toàn";
  let summary = "";

  if (current === null) {
    tone = "neutral";
    headline = "Chưa có số đo hiện tại";
    summary = `Khu ${zone.name} chưa gửi độ ẩm mới. Lịch sử bên dưới chỉ để tham khảo.`;
  } else if (current < safeLow) {
    tone = "warning";
    headline = "Cần tưới";
    summary = `Độ ẩm ${formatNumber(current, 0)}% thấp hơn ngưỡng tưới ${formatNumber(
      safeLow,
      0,
    )}%.`;
    advice.push(
      mode === "auto"
        ? "Chế độ tự động sẽ tưới khi độ ẩm dưới ngưỡng; kiểm tra bơm và đường ống."
        : "Chuyển sang Tự động hoặc bật bơm khu vực ở chế độ Thủ công.",
    );
  } else if (current > safeHigh) {
    headline = "Đất còn ẩm";
    summary = `Độ ẩm ${formatNumber(current, 0)}% cao hơn ngưỡng dừng ${formatNumber(
      safeHigh,
      0,
    )}%.`;
    advice.push("Tạm dừng tưới đến khi độ ẩm xuống dưới ngưỡng dừng.");
  } else {
    summary = `Độ ẩm ${formatNumber(current, 0)}% nằm giữa ngưỡng tưới ${formatNumber(
      safeLow,
      0,
    )}% và ngưỡng dừng ${formatNumber(safeHigh, 0)}%.`;
    advice.push("Không cần tưới. Tiếp tục theo dõi trong khoảng thời gian đã chọn.");
  }

  if (inSafePct !== null && inSafePct < 60 && values.length >= 4) {
    advice.push(
      `Đất chỉ nằm trong ngưỡng ${formatNumber(inSafePct, 0)}% thời gian; kiểm tra lưu lượng và lịch tưới.`,
    );
  }

  return { ...base, tone, headline, summary, advice };
}
