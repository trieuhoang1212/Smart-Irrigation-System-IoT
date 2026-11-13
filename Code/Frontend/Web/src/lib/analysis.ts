import type { Zone } from "../garden-data";

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
};

type AnalyzeInput = {
  samples: AnalysisSample[];
  zone: Zone;
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
    };
  }

  const latest = clean[clean.length - 1];
  const safeLow = Math.min(
    Number.isFinite(latest.threshold) ? latest.threshold : zone.threshold,
    Number.isFinite(latest.stopThreshold) ? latest.stopThreshold : zone.stopThreshold,
  );
  const safeHigh = Math.max(
    Number.isFinite(latest.threshold) ? latest.threshold : zone.threshold,
    Number.isFinite(latest.stopThreshold) ? latest.stopThreshold : zone.stopThreshold,
  );

  const inSafeCount = clean.filter(
    (sample) => sample.moisture >= safeLow && sample.moisture <= safeHigh,
  ).length;
  const inSafePct = (inSafeCount / clean.length) * 100;

  const moistureValues = clean.map((sample) => sample.moisture);
  const avgMoisture =
    moistureValues.reduce((total, value) => total + value, 0) / moistureValues.length;
  const minMoisture = Math.min(...moistureValues);
  const maxMoisture = Math.max(...moistureValues);

  const isDry = latest.moisture < safeLow;
  const isWet = latest.moisture > safeHigh;

  let longestDryMs = 0;
  let dryStart: number | null = null;
  for (const sample of clean) {
    if (sample.moisture < safeLow) {
      if (dryStart === null) dryStart = sample.recordedAt;
    } else if (dryStart !== null) {
      longestDryMs = Math.max(longestDryMs, sample.recordedAt - dryStart);
      dryStart = null;
    }
  }
  if (dryStart !== null) {
    longestDryMs = Math.max(longestDryMs, latest.recordedAt - dryStart);
  }

  let currentDryMs = 0;
  if (isDry) {
    let start = latest.recordedAt;
    for (let index = clean.length - 1; index > 0; index -= 1) {
      if (clean[index - 1].moisture < safeLow) {
        start = clean[index - 1].recordedAt;
      } else {
        break;
      }
    }
    currentDryMs = latest.recordedAt - start;
  }

  let pumpStarts = 0;
  let lastPumpAt: number | null = null;
  clean.forEach((sample, index) => {
    const previous = index > 0 ? clean[index - 1] : null;
    if (sample.pump && (!previous || !previous.pump)) pumpStarts += 1;
    if (sample.pump) lastPumpAt = sample.recordedAt;
  });

  const climateSamples = clean.filter(
    (sample) => typeof sample.temperature === "number" && Number.isFinite(sample.temperature),
  );
  let comfortRatio: number | null = null;
  if (climateSamples.length >= 3) {
    const comfortCount = climateSamples.filter((sample) => {
      const temperature = sample.temperature as number;
      const temperatureOk = temperature >= 18 && temperature <= 33;
      const humidityOk =
        typeof sample.humidity === "number"
          ? sample.humidity >= 40 && sample.humidity <= 85
          : true;
      return temperatureOk && humidityOk;
    }).length;
    comfortRatio = comfortCount / climateSamples.length;
  }

  const moistureScore = Math.round(60 * (inSafeCount / clean.length));
  const climateScore = comfortRatio === null ? null : Math.round(25 * comfortRatio);

  let waterScore: number | null;
  let waterNote: string;
  if (tankEmpty) {
    waterScore = 0;
    waterNote = "Bồn đã cạn, bơm đang bị chặn";
  } else if (tankDistanceCm !== null) {
    waterScore = 15;
    waterNote = `Cách miệng bồn ${Math.round(tankDistanceCm)} cm`;
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
  if (isDry && status === "good") status = "watch";
  if (isWet && status === "good") status = "watch";
  if (status === "good" && missingSources > 0) status = "watch";
  if (isDry && !latest.pump && currentDryMs >= 30 * 60 * 1000) status = "risk";
  if (tankEmpty && isDry) status = "risk";

  const headline =
    status === "good" ? "Cây đang ổn" : status === "watch" ? "Cần chú ý" : "Có nguy cơ";

  const summaryParts: string[] = [];
  if (isDry) {
    summaryParts.push(
      `Độ ẩm đất ${percentText(latest.moisture)} đang dưới ngưỡng tưới ${Math.round(safeLow)}%${
        latest.pump ? " và bơm đã chạy." : "."
      }`,
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
      `Chỉ ${Math.round(inSafePct)}% mẫu dữ liệu nằm trong vùng an toàn trong khoảng đang xem.`,
    );
  }
  if (tankEmpty) {
    summaryParts.push("Bồn nước đã cạn nên bơm bị chặn.");
  }
  if (status === "good") {
    summaryParts.push("Thời tiết và nguồn nước không có bất thường.");
  } else if (missingSources > 0) {
    const missing = [
      climateScore === null ? "DHT22" : null,
      waterScore === null ? "mực nước bồn" : null,
    ]
      .filter(Boolean)
      .join(" và ");
    summaryParts.push(
      `Chưa có dữ liệu ${missing} nên điểm chỉ mang tính tham khảo.`,
    );
  }

  const advice: string[] = [];
  if (isDry) {
    advice.push(
      latest.pump
        ? `Đất đang khô ${formatDuration(currentDryMs)} và bơm đã chạy — theo dõi độ ẩm có tăng lại không.`
        : `Đất khô liên tục ${formatDuration(currentDryMs)}, dưới ngưỡng ${Math.round(safeLow)}% — kiểm tra bơm/vòi hoặc tăng lượng nước mỗi lần.`,
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
  if (typeof latest.temperature === "number" && latest.temperature > 33) {
    advice.push(
      `Nhiệt độ ${Math.round(latest.temperature)}°C khá cao — cây thoát hơi mạnh, nên tưới sáng sớm hoặc chiều mát.`,
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
        note: `${Math.round(inSafePct)}% mẫu dữ liệu`,
      },
      {
        key: "climate",
        label: "Thời tiết dễ chịu",
        score: climateScore,
        max: 25,
        note:
          comfortRatio === null
            ? "Thiếu dữ liệu DHT22 — không chấm"
            : `${Math.round(comfortRatio * 100)}% mẫu trong khoảng 18–33°C`,
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
  };
}
