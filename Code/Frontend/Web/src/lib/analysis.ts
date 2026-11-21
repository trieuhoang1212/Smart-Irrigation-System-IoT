import {
  GROUP_WATER_HINTS,
  type CropGroup,
  type SoilType,
  type Zone,
} from "../garden-data";

const GROWTH_CARE: Record<string, string> = {
  seedling: "Cây con cần ẩm đều — kiểm tra mặt đất mỗi sáng, tránh để khô quá một ngày.",
  vegetative: "Đang phát triển — giữ ẩm trong vùng an toàn và bón phân loãng sau khi tưới.",
  flowering: "Ra hoa - đậu quả cần nước ổn định — tránh để đất khô hơn 2 ngày.",
  bulking: "Đang hình thành củ — giữ ẩm đều, tránh tưới quá đậm gây nứt củ.",
  mature: "Cây đã trưởng thành — duy trì ngưỡng hiện tại và kiểm tra sâu bệnh ở mặt dưới lá.",
  harvest: "Đang thu hoạch — giảm nhẹ nước để cây tập trung dưỡng chất vào quả/củ.",
  overdue:
    "Đã quá {days} ngày so với dự kiến thu hoạch — kiểm tra lại ngày trồng trong hồ sơ.",
};

const SOIL_CARE: Record<SoilType, string> = {
  "Đất cát":
    "Đất cát thoát nước nhanh — tưới ngắn nhưng đều, ưu tiên buổi sáng.",
  "Đất đỏ bazan":
    "Đất đỏ bazan giữ ẩm khá — kiểm tra độ ẩm trước khi tưới thêm để tránh úng.",
  "Đất phù sa":
    "Đất phù sa giữ ẩm tốt — chỉ tưới khi độ ẩm xuống dưới ngưỡng.",
};

export type AnalysisSample = {
  recordedAt: number;
  moisture: number;
  threshold: number;
  stopThreshold: number;
  pump: boolean;
  temperature: number | null;
  humidity: number | null;
  rain: number;
  raining: boolean;
};

type Season = "Mùa khô" | "Mùa mưa";

type ClimateBand = {
  season: Season;
  low: number;
  high: number;
  humidityLow: number;
  humidityHigh: number;
};

function seasonOf(month: number): Season {
  return month >= 5 && month <= 10 ? "Mùa mưa" : "Mùa khô";
}

/**
 * Dải dễ chịu cho vườn rau: mùa khô chịu nóng tốt hơn nhưng không khí khô,
 * mùa mưa mát hơn nhưng ẩm cao. Đất cát nóng lên nhanh nên hạ trần nhiệt độ,
 * bazan giữ nhiệt hơn phù sa một chút.
 */
function climateBand(soil: SoilType, now: number): ClimateBand {
  const season = seasonOf(new Date(now).getMonth() + 1);
  const base =
    season === "Mùa khô"
      ? { low: 20, high: 35, humidityLow: 30, humidityHigh: 85 }
      : { low: 22, high: 32, humidityLow: 50, humidityHigh: 90 };
  const soilShift = soil === "Đất cát" ? -2 : soil === "Đất đỏ bazan" ? -1 : 0;
  return {
    season,
    low: base.low,
    high: base.high + soilShift,
    humidityLow: base.humidityLow,
    humidityHigh: base.humidityHigh,
  };
}

export type AnalysisStatus = "good" | "watch" | "risk" | "unknown";

export type ScoreComponent = {
  key: "moisture" | "climate" | "water";
  label: string;
  score: number | null;
  max: number;
  note: string;
};

export type ZoneAnalysis = {
  status: AnalysisStatus;
  score: number | null;
  headline: string;
  summary: string;
  safeLow: number;
  safeHigh: number;
  components: ScoreComponent[];
  stats: {
    samples: number;
    inSafePct: number | null;
    currentMoisture: number | null;
    avgMoisture: number | null;
    minMoisture: number | null;
    maxMoisture: number | null;
    longestDryMs: number;
    currentDryMs: number;
    pumpStarts: number;
    lastPumpAt: number | null;
    lastSampleAt: number | null;
  };
  advice: string[];
  care: string[];
};

type AnalyzeInput = {
  samples: AnalysisSample[];
  zone: Zone;
  soil: SoilType;
  mode: "auto" | "manual";
  /** Khoảng gộp của lịch sử, dùng để quy mỗi mẫu ra thời gian đại diện. */
  bucketMs: number;
  tankDistanceCm: number | null;
  tankEmpty: boolean;
  rainBlock: boolean;
};

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "dưới 1 phút";
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function percentText(value: number | null): string {
  return value === null ? "--" : `${Math.round(value)}%`;
}

export function analyzeZone({
  samples,
  zone,
  soil,
  mode,
  bucketMs,
  tankDistanceCm,
  tankEmpty,
  rainBlock,
}: AnalyzeInput): ZoneAnalysis {
  const clean = samples.filter((sample) =>
    Number.isFinite(sample.moisture),
  );

  if (clean.length === 0) {
    return {
      status: "unknown",
      score: null,
      headline: "Chưa đủ dữ liệu",
      summary:
        "Cần ESP32 gửi telemetry để bắt đầu phân tích. Dữ liệu sẽ xuất hiện sau khi Backend nhận mẫu đầu tiên.",
      safeLow: zone.threshold,
      safeHigh: zone.stopThreshold,
      components: [],
      stats: {
        samples: 0,
        inSafePct: null,
        currentMoisture: null,
        avgMoisture: null,
        minMoisture: null,
        maxMoisture: null,
        longestDryMs: 0,
        currentDryMs: 0,
        pumpStarts: 0,
        lastPumpAt: null,
        lastSampleAt: null,
      },
      advice: [
        "Kiểm tra ESP32 đã gửi telemetry chưa và Backend có đang chạy không.",
      ],
      care: [],
    };
  }

  const latest = clean[clean.length - 1];
  const safeLow = Math.min(zone.threshold, zone.stopThreshold);
  const safeHigh = Math.max(zone.threshold, zone.stopThreshold);

  // Mỗi mẫu đại diện cho khoảng thời gian tới mẫu kế (tối đa một bucket).
  // Khoảng trống dài hơn 2 bucket là mất telemetry, không cộng vào thời gian
  // quan sát để tỉ lệ % phản ánh thời gian thật thay vì số mẫu.
  const bucket = Math.max(1, bucketMs);
  const weights = clean.map((sample, index) => {
    const next = clean[index + 1];
    if (!next) return bucket;
    const raw = next.recordedAt - sample.recordedAt;
    return raw > bucket * 2 ? bucket : Math.max(0, raw);
  });
  const gapAfter = clean.map((sample, index) => {
    const next = clean[index + 1];
    return next ? next.recordedAt - sample.recordedAt > bucket * 2 : false;
  });
  const totalMs = weights.reduce((total, weight) => total + weight, 0);
  const safeMs = clean.reduce(
    (total, sample, index) =>
      sample.moisture >= safeLow && sample.moisture <= safeHigh
        ? total + weights[index]
        : total,
    0,
  );
  const inSafePct = totalMs > 0 ? (safeMs / totalMs) * 100 : 0;

  const moistureValues = clean.map((sample) => sample.moisture);
  const avgMoisture =
    totalMs > 0
      ? clean.reduce(
          (total, sample, index) => total + sample.moisture * weights[index],
          0,
        ) / totalMs
      : latest.moisture;
  const minMoisture = Math.min(...moistureValues);
  const maxMoisture = Math.max(...moistureValues);

  const isDry = latest.moisture < safeLow;
  const isWet = latest.moisture > safeHigh;

  let longestDryMs = 0;
  let dryRunMs = 0;
  clean.forEach((sample, index) => {
    if (sample.moisture < safeLow) {
      dryRunMs += weights[index];
      longestDryMs = Math.max(longestDryMs, dryRunMs);
    } else {
      dryRunMs = 0;
    }
    if (gapAfter[index]) dryRunMs = 0;
  });

  let currentDryMs = 0;
  if (isDry) {
    for (let index = clean.length - 1; index >= 0; index -= 1) {
      if (clean[index].moisture >= safeLow) break;
      currentDryMs += weights[index];
      if (index > 0 && gapAfter[index - 1]) break;
    }
  }

  let pumpStarts = 0;
  let lastPumpAt: number | null = null;
  clean.forEach((sample, index) => {
    const previous = index > 0 ? clean[index - 1] : null;
    if (sample.pump && (!previous || !previous.pump)) pumpStarts += 1;
    if (sample.pump) lastPumpAt = sample.recordedAt;
  });

  const band = climateBand(soil, Date.now());
  // Khí hậu là trạng thái hiện tại, không tích luỹ như độ ẩm đất: chấm theo
  // mẫu DHT22 mới nhất để kéo slider trên Wokwi là điểm đổi ngay.
  const latestClimate = [...clean]
    .reverse()
    .find(
      (sample) =>
        typeof sample.temperature === "number" && Number.isFinite(sample.temperature),
    );
  let climateScore: number | null = null;
  let climateNote = "Thiếu dữ liệu DHT22 — không chấm";
  if (latestClimate) {
    const temperature = latestClimate.temperature as number;
    const temperatureOk = temperature >= band.low && temperature <= band.high;
    const humidityOk =
      typeof latestClimate.humidity === "number"
        ? latestClimate.humidity >= band.humidityLow &&
          latestClimate.humidity <= band.humidityHigh
        : true;
    climateScore = temperatureOk && humidityOk ? 25 : 0;
    const temperatureText = (Math.round(temperature * 10) / 10).toString();
    const humidityText =
      typeof latestClimate.humidity === "number"
        ? `, ${Math.round(latestClimate.humidity)}% RH`
        : "";
    climateNote = `Hiện tại ${temperatureText}°C${humidityText} · ${band.season.toLowerCase()}, ${soil.toLowerCase()}: dải ${band.low}–${band.high}°C, ${band.humidityLow}–${band.humidityHigh}% RH`;
  }

  const moistureScore = totalMs > 0 ? Math.round(60 * (safeMs / totalMs)) : 0;

  let waterScore: number | null;
  let waterNote: string;
  if (tankEmpty) {
    waterScore = 0;
    waterNote = "Bồn đã cạn, bơm đang bị chặn";
  } else if (tankDistanceCm !== null) {
    // Cảm biến đo khoảng cách từ miệng bồn; bồn cao 100 cm nên mức nước
    // xấp xỉ 100 − distance. Chấm theo mức thay vì cho điểm tối đa mọi lúc.
    const waterPercent = Math.max(
      0,
      Math.min(100, Math.round(100 - tankDistanceCm)),
    );
    waterScore = Math.round((15 * waterPercent) / 100);
    waterNote = `Bồn còn khoảng ${waterPercent}% · cách miệng ${Math.round(tankDistanceCm)} cm`;
  } else {
    waterScore = null;
    waterNote = "Thiếu dữ liệu mực nước bồn — không chấm";
  }

  // Chỉ chấm trên nguồn có dữ liệu thật; thiếu cảm biến thì quy đổi về thang 100.
  const scored = [
    { score: moistureScore, max: 60 },
    { score: climateScore, max: 25 },
    { score: waterScore, max: 15 },
  ].filter((item): item is { score: number; max: number } => item.score !== null);
  const knownMax = scored.reduce((total, item) => total + item.max, 0);
  const score = Math.round(
    (scored.reduce((total, item) => total + item.score, 0) / knownMax) * 100,
  );
  const missingSources = 3 - scored.length;

  let status: AnalysisStatus = score >= 80 ? "good" : score >= 55 ? "watch" : "risk";
  if (isWet && status === "good") status = "watch";
  if (status === "good" && missingSources > 0) status = "watch";
  if (isWet && latest.pump) status = "risk";
  if (isDry) {
    if (latest.pump) {
      // Dưới ngưỡng khi bơm đang chạy là hệ thống đang bù nước, không phải nguy cơ.
      status = "watch";
    } else {
      // AUTO có 30 phút để tự bật bơm; MANUAL cần người tưới ngay.
      const needsAction = mode === "manual" || currentDryMs >= 30 * 60 * 1000;
      status = needsAction ? "risk" : "watch";
    }
  }
  if (tankEmpty && isDry) status = "risk";

  const headline =
    isDry && latest.pump
      ? "Đang tưới"
      : status === "good"
        ? "Cây đang ổn"
        : status === "watch"
          ? "Cần chú ý"
          : "Có nguy cơ";

  const summaryParts: string[] = [];
  if (isDry) {
    summaryParts.push(
      latest.pump
        ? `Độ ẩm đất ${percentText(latest.moisture)} dưới ngưỡng tưới ${Math.round(safeLow)}%; bơm đang chạy, chờ đạt ngưỡng dừng ${Math.round(safeHigh)}%.`
        : `Độ ẩm đất ${percentText(latest.moisture)} đang dưới ngưỡng tưới ${Math.round(safeLow)}%.`,
    );
  } else if (isWet) {
    summaryParts.push(
      `Độ ẩm đất ${percentText(latest.moisture)} vượt ngưỡng dừng ${Math.round(safeHigh)}%, đất đang quá ẩm.`,
    );
  } else {
    summaryParts.push(
      `Độ ẩm đất ${percentText(latest.moisture)} nằm trong vùng an toàn ${Math.round(safeLow)}–${Math.round(safeHigh)}%.`,
    );
  }
  if (inSafePct < 60) {
    summaryParts.push(
      `Chỉ ${Math.round(inSafePct)}% thời gian quan sát nằm trong vùng an toàn.`,
    );
  }
  if (tankEmpty) {
    summaryParts.push("Bồn nước đã cạn nên bơm bị chặn.");
  }
  if (status === "good") {
    summaryParts.push("Thời tiết và nguồn nước không có bất thường.");
  }

  const advice: string[] = [];
  if (isDry) {
    advice.push(
      latest.pump
        ? `Bơm đang bù nước (đã khô ${formatDuration(currentDryMs)}) — chờ độ ẩm đạt ngưỡng dừng ${Math.round(safeHigh)}% rồi kiểm tra lại.`
        : mode === "auto"
          ? `Đất khô ${formatDuration(currentDryMs)} dưới ngưỡng ${Math.round(safeLow)}% — chế độ Tự động sẽ bật bơm; nếu quá 30 phút vẫn khô, kiểm tra bơm và đường ống.`
          : `Đất khô ${formatDuration(currentDryMs)} dưới ngưỡng ${Math.round(safeLow)}% — bật bơm thủ công hoặc tăng lượng nước mỗi lần.`,
    );
  }
  if (isWet) {
    advice.push(
      `Độ ẩm ${percentText(latest.moisture)} vượt ngưỡng dừng ${Math.round(safeHigh)}% — tạm ngưng tưới để tránh ngập úng.`,
    );
  }
  if (inSafePct < 60 && !isDry && !isWet) {
    advice.push(
      `Chỉ ${Math.round(inSafePct)}% thời gian đất nằm trong vùng an toàn ${Math.round(safeLow)}–${Math.round(safeHigh)}% — nên xem lại ngưỡng tưới và lượng nước mỗi lần.`,
    );
  }
  if (longestDryMs >= 60 * 60 * 1000 && !isDry) {
    advice.push(
      `Có giai đoạn đất khô liên tục ${formatDuration(longestDryMs)} trong khoảng đang xem.`,
    );
  }
  if (latest.raining && !rainBlock) {
    advice.push(
      `Đang mưa ${percentText(latest.rain)} nhưng chưa bật "Hoãn tưới khi có mưa".`,
    );
  }
  if (
    latestClimate &&
    typeof latestClimate.temperature === "number" &&
    latestClimate.temperature > band.high
  ) {
    advice.push(
      `Nhiệt độ ${Math.round(latestClimate.temperature)}°C cao hơn dải dễ chịu ${band.low}–${band.high}°C (${band.season.toLowerCase()}, ${soil.toLowerCase()}) — cây thoát hơi mạnh, nên tưới sáng sớm hoặc chiều mát.`,
    );
  }
  if (tankEmpty) {
    advice.push("Bồn nước đã cạn — cần châm thêm nước để bơm chạy lại an toàn.");
  }
  if (advice.length === 0) {
    advice.push(
      "Không phát hiện bất thường — tiếp tục theo dõi và tưới theo ngưỡng hiện tại.",
    );
  }

  const hint =
    GROUP_WATER_HINTS[zone.group as CropGroup] ?? GROUP_WATER_HINTS["Khác"];
  const care: string[] = [
    latest.raining
      ? `Đang mưa: tạm hoãn khung tưới ${hint.label.toLowerCase()} (${hint.start}–${hint.end}) đến khi tạm tắt mưa.`
      : `Khung tham khảo cho ${zone.group}: ${hint.label} ${hint.start}–${hint.end}. ${hint.note}`,
  ];
  if (zone.growth) {
    const growthTip = GROWTH_CARE[zone.growth.stage];
    if (growthTip) {
      care.push(
        growthTip.replace("{days}", String(zone.growth.overdueDays)),
      );
    }
  }
  care.push(SOIL_CARE[soil]);
  care.push(
    "Hệ thống tưới theo độ ẩm đất; khung giờ chỉ để tham khảo.",
  );

  return {
    status,
    score,
    headline,
    summary: summaryParts.join(" "),
    safeLow,
    safeHigh,
    components: [
      {
        key: "moisture",
        label: "Độ ẩm trong vùng an toàn",
        score: moistureScore,
        max: 60,
        note: `${Math.round(inSafePct)}% thời gian quan sát`,
      },
      {
        key: "climate",
        label: "Thời tiết dễ chịu",
        score: climateScore,
        max: 25,
        note: climateNote,
      },
      {
        key: "water",
        label: "Nguồn nước",
        score: waterScore,
        max: 15,
        note: waterNote,
      },
    ],
    stats: {
      samples: clean.length,
      inSafePct,
      currentMoisture: latest.moisture,
      avgMoisture,
      minMoisture,
      maxMoisture,
      longestDryMs,
      currentDryMs,
      pumpStarts,
      lastPumpAt,
      lastSampleAt: latest.recordedAt,
    },
    advice: advice.slice(0, 6),
    care,
  };
}
