"use client";

import { useMemo, useState, type PointerEvent } from "react";
import type { AnalysisSample } from "../lib/analysis";
import type { AnalysisRange } from "../hooks/useZoneHistory";

const CHART = { width: 900, height: 260, left: 46, right: 16, top: 18, bottom: 46 };
const LINE_COLOR = "#3c6f52";

function formatAxisTime(timestamp: number, range: AnalysisRange): string {
  const date = new Date(timestamp);
  if (range === "7d") {
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  }
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function AnalysisChart({
  samples,
  threshold,
  stopThreshold,
  range,
  loading,
  error,
}: {
  samples: AnalysisSample[];
  threshold: number;
  stopThreshold: number;
  range: AnalysisRange;
  loading: boolean;
  error: string | null;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (samples.length === 0) return null;

    const safeLow = Math.min(threshold, stopThreshold);
    const safeHigh = Math.max(threshold, stopThreshold);
    const values = samples.map((sample) => sample.moisture);
    const rawMin = Math.min(...values, safeLow);
    const rawMax = Math.max(...values, safeHigh);

    let min = Math.max(0, Math.floor((rawMin - 8) / 5) * 5);
    let max = Math.min(100, Math.ceil((rawMax + 8) / 5) * 5);
    if (max - min < 20) {
      min = Math.max(0, min - 10);
      max = Math.min(100, max + 10);
    }

    const from = samples[0].recordedAt;
    const to = samples[samples.length - 1].recordedAt;
    const span = Math.max(1, to - from);
    const plotWidth = CHART.width - CHART.left - CHART.right;
    const plotHeight = CHART.height - CHART.top - CHART.bottom;
    const toX = (timestamp: number) => CHART.left + ((timestamp - from) / span) * plotWidth;
    const toY = (value: number) =>
      CHART.top + (1 - (value - min) / (max - min)) * plotHeight;

    const points = samples.map((sample) => ({
      x: toX(sample.recordedAt),
      y: toY(sample.moisture),
      sample,
    }));

    const line = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" ");
    const baseline = CHART.top + plotHeight;
    const area =
      points.length > 1
        ? `${line} L${points[points.length - 1].x.toFixed(2)},${baseline.toFixed(2)} L${points[0].x.toFixed(2)},${baseline.toFixed(2)} Z`
        : "";

    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const value = max - ((max - min) * index) / 4;
      return { value, y: toY(value) };
    });
    const xTicks = Array.from({ length: 4 }, (_, index) => {
      const timestamp = from + (span * index) / 3;
      return { timestamp, x: toX(timestamp) };
    });

    const bandTop = toY(safeHigh);
    const bandBottom = toY(safeLow);

    const pumpRuns: Array<{ x: number; width: number }> = [];
    let runStart: number | null = null;
    samples.forEach((sample) => {
      if (sample.pump && runStart === null) runStart = sample.recordedAt;
      if (!sample.pump && runStart !== null) {
        pumpRuns.push({
          x: toX(runStart),
          width: Math.max(3, toX(sample.recordedAt) - toX(runStart)),
        });
        runStart = null;
      }
    });
    if (runStart !== null) {
      pumpRuns.push({
        x: toX(runStart),
        width: Math.max(3, toX(to) - toX(runStart)),
      });
    }

    return {
      points,
      line,
      area,
      yTicks,
      xTicks,
      baseline,
      bandTop,
      bandBottom,
      safeLow,
      safeHigh,
      pumpRuns,
    };
  }, [samples, threshold, stopThreshold]);

  const hoverPoint =
    hoverIndex !== null && chart ? chart.points[hoverIndex] ?? null : null;

  const handleMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!chart) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const targetX = ratio * CHART.width;

    let nearest = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    chart.points.forEach((point, index) => {
      const distance = Math.abs(point.x - targetX);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = index;
      }
    });
    setHoverIndex(nearest);
  };

  return (
    <div className="analysis-chart">
      {chart ? (
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          role="img"
          aria-label="Biểu đồ độ ẩm đất kèm vùng an toàn và thời điểm bơm chạy"
          className="analysis-chart-svg"
          onPointerMove={handleMove}
          onPointerDown={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
          onPointerCancel={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="analysis-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LINE_COLOR} stopOpacity="0.16" />
              <stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0" />
            </linearGradient>
          </defs>

          {chart.yTicks.map((tick, index) => (
            <g key={`y-${index}`}>
              <line
                x1={CHART.left}
                x2={CHART.width - CHART.right}
                y1={tick.y}
                y2={tick.y}
                stroke="#edf2ee"
                strokeWidth="1"
              />
              <text
                x={CHART.left - 10}
                y={tick.y + 3}
                textAnchor="end"
                className="analysis-axis-text"
              >
                {Math.round(tick.value)}
              </text>
            </g>
          ))}

          {chart.xTicks.map((tick, index) => (
            <text
              key={`x-${index}`}
              x={tick.x}
              y={CHART.height - 8}
              textAnchor={index === 0 ? "start" : index === 3 ? "end" : "middle"}
              className="analysis-axis-text"
            >
              {formatAxisTime(tick.timestamp, range)}
            </text>
          ))}

          <rect
            x={CHART.left}
            y={chart.bandTop}
            width={CHART.width - CHART.left - CHART.right}
            height={Math.max(1, chart.bandBottom - chart.bandTop)}
            fill="#e9f2e6"
          />
          <text
            x={CHART.left + 8}
            y={chart.bandTop - 6}
            className="analysis-band-text"
          >
            Vùng an toàn
          </text>

          <line
            x1={CHART.left}
            x2={CHART.width - CHART.right}
            y1={chart.bandBottom}
            y2={chart.bandBottom}
            stroke="#b58a3f"
            strokeWidth="1.2"
            strokeDasharray="5 6"
          />
          <line
            x1={CHART.left}
            x2={CHART.width - CHART.right}
            y1={chart.bandTop}
            y2={chart.bandTop}
            stroke={LINE_COLOR}
            strokeWidth="1.2"
            strokeDasharray="5 6"
          />
          <text
            x={CHART.width - CHART.right - 2}
            y={chart.bandBottom + 13}
            textAnchor="end"
            className="analysis-limit-text low"
          >
            Tưới {Math.round(chart.safeLow)}%
          </text>
          <text
            x={CHART.width - CHART.right - 2}
            y={chart.bandTop - 5}
            textAnchor="end"
            className="analysis-limit-text"
          >
            Dừng {Math.round(chart.safeHigh)}%
          </text>

          {chart.area && <path d={chart.area} fill="url(#analysis-fill)" />}
          {chart.points.length > 1 && (
            <path
              d={chart.line}
              fill="none"
              stroke={LINE_COLOR}
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {chart.points.length === 1 && (
            <circle cx={chart.points[0].x} cy={chart.points[0].y} r="4" fill={LINE_COLOR} />
          )}

          <g className="analysis-pump-lane">
            <text
              x={CHART.left - 10}
              y={CHART.height - 24}
              textAnchor="end"
              className="analysis-axis-text"
            >
              Bơm
            </text>
            {chart.pumpRuns.map((run, index) => (
              <rect
                key={`pump-${index}`}
                x={run.x}
                y={CHART.height - 29}
                width={run.width}
                height="5"
                rx="2.5"
                fill="#4f8a63"
              />
            ))}
          </g>

          {hoverPoint && (
            <g>
              <line
                x1={hoverPoint.x}
                x2={hoverPoint.x}
                y1={CHART.top}
                y2={chart.baseline}
                stroke="#9fb3a7"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r="4.5"
                fill="#fff"
                stroke={LINE_COLOR}
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>
      ) : (
        <div className={`analysis-chart-empty ${error ? "error" : ""}`}>
          {loading
            ? "Đang tải lịch sử..."
            : error ??
              "Chưa có dữ liệu trong khoảng này. Dữ liệu sẽ xuất hiện sau khi ESP32 gửi telemetry."}
        </div>
      )}

      {hoverPoint && chart && (
        <div
          className="analysis-tooltip"
          style={{
            left: `${(hoverPoint.x / CHART.width) * 100}%`,
            transform:
              hoverPoint.x / CHART.width < 0.2
                ? "translateX(0)"
                : hoverPoint.x / CHART.width > 0.8
                  ? "translateX(-100%)"
                  : "translateX(-50%)",
          }}
        >
          <strong>{Math.round(hoverPoint.sample.moisture)}%</strong>
          <span>
            {new Date(hoverPoint.sample.recordedAt).toLocaleString("vi-VN")}
          </span>
          <em className={hoverPoint.sample.pump ? "on" : ""}>
            {hoverPoint.sample.pump ? "Bơm đang chạy" : "Bơm tắt"}
          </em>
        </div>
      )}
    </div>
  );
}
