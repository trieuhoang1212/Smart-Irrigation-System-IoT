"use client";

import { ANALYSIS_RANGES, useZoneHistory } from "../hooks/useZoneHistory";
import type { AnalysisSample } from "../lib/analysis";
import { CloudIcon, RainIcon, ThermometerIcon } from "./icons";
import type { ReactNode } from "react";

type EnvKey = "temperature" | "humidity" | "rain";

const ENV_METRICS: Record<
  EnvKey,
  {
    label: string;
    unit: string;
    color: string;
    percent: boolean;
    digits: number;
    icon: ReactNode;
  }
> = {
  temperature: {
    label: "Nhiệt độ",
    unit: "°C",
    color: "var(--amber)",
    percent: false,
    digits: 1,
    icon: <ThermometerIcon size={15} />,
  },
  humidity: {
    label: "Độ ẩm không khí",
    unit: "%",
    color: "var(--blue)",
    percent: true,
    digits: 0,
    icon: <CloudIcon size={15} />,
  },
  rain: {
    label: "Cảm biến mưa",
    unit: "%",
    color: "var(--blue)",
    percent: true,
    digits: 0,
    icon: <RainIcon size={15} />,
  },
};

type Point = { t: number; v: number };

function formatValue(value: number | null, key: EnvKey): string {
  if (value === null) return "--";
  return `${value.toFixed(ENV_METRICS[key].digits)}${ENV_METRICS[key].unit}`;
}

function pointsFor(samples: AnalysisSample[], key: EnvKey): Point[] {
  return samples.flatMap((sample) => {
    const value = sample[key];
    return typeof value === "number" && Number.isFinite(value)
      ? [{ t: sample.recordedAt, v: value }]
      : [];
  });
}

const SPARK = { width: 260, height: 64, left: 6, right: 6, top: 8, bottom: 8 };

function Sparkline({ points, metric }: { points: Point[]; metric: EnvKey }) {
  const config = ENV_METRICS[metric];
  if (points.length === 0) return null;

  const plotWidth = SPARK.width - SPARK.left - SPARK.right;
  const plotHeight = SPARK.height - SPARK.top - SPARK.bottom;
  const baseline = SPARK.top + plotHeight;

  let min: number;
  let max: number;
  if (config.percent) {
    min = 0;
    max = 100;
  } else {
    const values = points.map((point) => point.v);
    min = Math.floor(Math.min(...values) - 2);
    max = Math.ceil(Math.max(...values) + 2);
    if (max - min < 5) {
      min -= 2;
      max += 2;
    }
  }

  const from = points[0].t;
  const to = points[points.length - 1].t;
  const span = Math.max(1, to - from);
  const toX = (timestamp: number) =>
    SPARK.left + ((timestamp - from) / span) * plotWidth;
  const toY = (value: number) =>
    SPARK.top + (1 - (value - min) / (max - min)) * plotHeight;

  if (points.length === 1) {
    const x = SPARK.left + plotWidth / 2;
    const y = toY(points[0].v);
    return (
      <svg className="env-spark" viewBox={`0 0 ${SPARK.width} ${SPARK.height}`} aria-hidden>
        <circle cx={x} cy={y} r="3" fill={config.color} />
      </svg>
    );
  }

  const coords = points.map((point) => ({ x: toX(point.t), y: toY(point.v) }));
  const line = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${coords[coords.length - 1].x.toFixed(2)},${baseline.toFixed(2)} L${coords[0].x.toFixed(2)},${baseline.toFixed(2)} Z`;
  const gradientId = `env-spark-${metric}`;

  return (
    <svg className="env-spark" viewBox={`0 0 ${SPARK.width} ${SPARK.height}`} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={config.color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={config.color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={config.color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EnvironmentHistory({
  backendUrl,
  deviceId,
  zoneId,
  range,
  connected,
}: {
  backendUrl: string;
  deviceId: string;
  /** Đại diện một khu: cảm biến môi trường dùng chung nên giá trị như nhau. */
  zoneId: string | null;
  range: "1h" | "24h" | "7d";
  connected: boolean;
}) {
  const { samples, loading, error } = useZoneHistory({
    backendUrl,
    deviceId,
    zoneId,
    range,
    connected,
  });

  return (
    <section className="panel environment-panel">
      <div className="panel-heading">
        <div>
          <h2>Môi trường toàn vườn</h2>
          <p>
            Cảm biến dùng chung cho mọi khu · {ANALYSIS_RANGES[range].label}
            {loading ? " · Đang cập nhật..." : ""}
          </p>
        </div>
      </div>

      {error && <p className="environment-error">{error}</p>}

      <div className="environment-grid">
        {(Object.keys(ENV_METRICS) as EnvKey[]).map((key) => {
          const config = ENV_METRICS[key];
          const points = pointsFor(samples, key);
          const latest = points.length > 0 ? points[points.length - 1] : null;
          const values = points.map((point) => point.v);
          const min = values.length > 0 ? Math.min(...values) : null;
          const max = values.length > 0 ? Math.max(...values) : null;

          return (
            <article className="env-metric" key={key}>
              <div className="env-metric-head">
                {config.icon}
                <span>{config.label}</span>
              </div>
              <strong className="env-metric-value">
                {formatValue(latest?.v ?? null, key)}
                {latest && (
                  <small>
                    {new Date(latest.t).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                )}
              </strong>
              {points.length > 0 ? (
                <>
                  <Sparkline points={points} metric={key} />
                  <div className="env-metric-range">
                    <span>
                      Thấp <strong>{formatValue(min, key)}</strong>
                    </span>
                    <span>
                      Cao <strong>{formatValue(max, key)}</strong>
                    </span>
                  </div>
                </>
              ) : (
                <div className="env-metric-empty">
                  {loading ? "Đang tải..." : "Chưa có dữ liệu"}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
