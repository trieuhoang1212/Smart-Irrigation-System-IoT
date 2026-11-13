"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import type { Zone } from "../garden-data";
import { formatAge } from "../lib/time";

export type HistorySample = {
  recordedAt: number;
  zoneId: string;
  moisture: number;
  threshold: number;
  stopThreshold: number;
  pump: boolean;
  temperature: number | null;
  humidity: number | null;
  rain: number;
  raining: boolean;
  mode: "auto" | "manual";
};

type RangeKey = "1h" | "24h" | "7d";
type MetricKey = "moisture" | "temperature" | "humidity" | "rain";

const RANGES: Record<RangeKey, { label: string; durationMs: number; bucketMs: number }> = {
  "1h": { label: "1 giờ", durationMs: 60 * 60 * 1000, bucketMs: 30 * 1000 },
  "24h": { label: "24 giờ", durationMs: 24 * 60 * 60 * 1000, bucketMs: 5 * 60 * 1000 },
  "7d": { label: "7 ngày", durationMs: 7 * 24 * 60 * 60 * 1000, bucketMs: 30 * 60 * 1000 },
};

const COMPACT_RANGE = { durationMs: 6 * 60 * 60 * 1000, bucketMs: 2 * 60 * 1000 };

const METRICS: Record<
  MetricKey,
  { label: string; unit: string; color: string; percent: boolean }
> = {
  moisture: { label: "Độ ẩm đất", unit: "%", color: "#4f8a63", percent: true },
  temperature: { label: "Nhiệt độ", unit: "°C", color: "#a5762c", percent: false },
  humidity: { label: "Độ ẩm không khí", unit: "%", color: "#3d6f8c", percent: true },
  rain: { label: "Cảm biến mưa", unit: "%", color: "#6b8b96", percent: true },
};

const CHART = { width: 900, height: 240, left: 48, right: 18, top: 16, bottom: 30 };
const REFRESH_MS = 30_000;
const FOCUS_EDGE_MS = 60 * 60 * 1000;

function formatValue(value: number | null, metric: MetricKey): string {
  if (value === null) return "--";
  const digits = metric === "temperature" ? 1 : 0;
  return `${value.toFixed(digits)}${METRICS[metric].unit}`;
}

function formatAxisTime(timestamp: number, range: RangeKey): string {
  const date = new Date(timestamp);
  if (range === "7d") {
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  }
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function HistoryChart({
  backendUrl,
  deviceId,
  zones,
  activeZone,
  connected,
  onSelectZone,
  liveSample,
  compact = false,
  focusAt = null,
  onPointSelect,
}: {
  backendUrl: string;
  deviceId: string | null;
  zones: Zone[];
  activeZone: string;
  connected: boolean;
  onSelectZone: (zoneId: string) => void;
  liveSample?: HistorySample | null;
  compact?: boolean;
  focusAt?: number | null;
  onPointSelect?: (sample: HistorySample) => void;
}) {
  const [range, setRange] = useState<RangeKey>("24h");
  const [metric, setMetric] = useState<MetricKey>("moisture");
  const [samples, setSamples] = useState<HistorySample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const requestRef = useRef(0);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const kickoff = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  const { durationMs, bucketMs } = compact ? COMPACT_RANGE : RANGES[range];

  const load = useCallback(async () => {
    if (!deviceId) return;

    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);

    try {
      const to = Date.now();
      const from = to - durationMs;
      const params = new URLSearchParams({
        from: String(from),
        to: String(to),
        bucketMs: String(bucketMs),
        zoneId: activeZone,
        limit: "500",
      });

      const response = await fetch(
        `${backendUrl.replace(/\/+$/, "")}/api/devices/${encodeURIComponent(deviceId)}/telemetry/history?${params.toString()}`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const body = (await response.json()) as { samples?: HistorySample[] };
      if (requestId !== requestRef.current) return;

      setSamples(Array.isArray(body.samples) ? body.samples : []);
      setHoverIndex(null);
    } catch {
      if (requestId !== requestRef.current) return;
      setSamples([]);
      setError("Không tải được lịch sử từ Backend.");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [backendUrl, deviceId, activeZone, durationMs, bucketMs]);

  useEffect(() => {
    // Trì hoãn một nhịp để tránh setState đồng bộ ngay trong thân effect.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [connected, load]);

  // Gộp mẫu telemetry vừa nhận để biểu đồ nhích ngay, không chờ lần tải lại 30s.
  const series = useMemo(() => {
    if (!liveSample) return samples;
    if (samples.length === 0) return [liveSample];
    const last = samples[samples.length - 1];
    return liveSample.recordedAt > last.recordedAt ? [...samples, liveSample] : samples;
  }, [samples, liveSample]);

  const chart = useMemo(() => {
    // DHT22 có thể trả null: bỏ điểm lỗi thay vì vẽ thành 0.
    const plotted = series.flatMap((sample) => {
      const value = sample[metric];
      return typeof value === "number" && Number.isFinite(value)
        ? [{ sample, value }]
        : [];
    });
    if (plotted.length === 0) return null;

    const values = plotted.map((entry) => entry.value);

    const config = METRICS[metric];
    let min: number;
    let max: number;

    if (config.percent) {
      min = 0;
      max = 100;
    } else {
      min = Math.floor(Math.min(...values) - 2);
      max = Math.ceil(Math.max(...values) + 2);
      if (max - min < 5) {
        min -= 2;
        max += 2;
      }
    }

    const from = series[0].recordedAt;
    const to = series[series.length - 1].recordedAt;
    const span = Math.max(1, to - from);
    const plotWidth = CHART.width - CHART.left - CHART.right;
    const plotHeight = CHART.height - CHART.top - CHART.bottom;
    const toX = (timestamp: number) =>
      CHART.left + ((timestamp - from) / span) * plotWidth;
    const toY = (value: number) =>
      CHART.top + (1 - (value - min) / (max - min)) * plotHeight;

    const points = plotted.map((entry) => ({
      x: toX(entry.sample.recordedAt),
      y: toY(entry.value),
      sample: entry.sample,
    }));

    const line = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" ");
    const baseline = CHART.top + plotHeight;
    const area = `${line} L${points[points.length - 1].x.toFixed(2)},${baseline.toFixed(2)} L${points[0].x.toFixed(2)},${baseline.toFixed(2)} Z`;

    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const value = max - ((max - min) * index) / 4;
      return { value, y: toY(value) };
    });
    const xTicks = Array.from({ length: 4 }, (_, index) => {
      const timestamp = from + (span * index) / 3;
      return { timestamp, x: toX(timestamp) };
    });

    const threshold = series[series.length - 1].threshold;
    const thresholdY = metric === "moisture" ? toY(threshold) : null;

    // Mốc nhật ký thường rơi giữa hai mẫu (hoặc ngay sau mẫu cuối) nên bám vào mép gần nhất.
    const focusX =
      focusAt !== null &&
      focusAt >= from - FOCUS_EDGE_MS &&
      focusAt <= to + FOCUS_EDGE_MS
        ? toX(Math.min(Math.max(focusAt, from), to))
        : null;
    const focusPoint =
      focusAt !== null && focusX !== null
        ? points.reduce((nearest, point) =>
            Math.abs(point.sample.recordedAt - focusAt) <
            Math.abs(nearest.sample.recordedAt - focusAt)
              ? point
              : nearest,
          )
        : null;

    return {
      config,
      points,
      line,
      area,
      yTicks,
      xTicks,
      threshold,
      thresholdY,
      baseline,
      plotWidth,
      plotHeight,
      focusX,
      focusPoint,
    };
  }, [series, metric, focusAt]);

  // Trên mobile biểu đồ cuộn ngang: đưa mốc nhật ký vào giữa khung nhìn.
  const focusX = chart?.focusX ?? null;
  useEffect(() => {
    const wrap = chartWrapRef.current;
    if (focusX === null || !wrap) return;
    if (wrap.scrollWidth <= wrap.clientWidth + 1) return;
    wrap.scrollLeft = Math.max(
      0,
      (focusX / CHART.width) * wrap.scrollWidth - wrap.clientWidth / 2,
    );
  }, [focusX]);

  const stats = useMemo(() => {
    const values = series
      .map((sample) => sample[metric])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (values.length === 0) return null;
    const sum = values.reduce((total, value) => total + value, 0);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
    };
  }, [series, metric]);

  const hoverPoint =
    hoverIndex !== null && chart ? chart.points[hoverIndex] ?? null : null;

  const nearestPoint = (clientX: number, element: SVGSVGElement) => {
    if (!chart) return null;
    const rect = element.getBoundingClientRect();
    const targetX = ((clientX - rect.left) / rect.width) * CHART.width;

    let nearest = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    chart.points.forEach((point, index) => {
      const distance = Math.abs(point.x - targetX);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = index;
      }
    });
    return { index: nearest, point: chart.points[nearest] };
  };

  const handleMove = (event: PointerEvent<SVGSVGElement>) => {
    const nearest = nearestPoint(event.clientX, event.currentTarget);
    if (nearest) setHoverIndex(nearest.index);
  };

  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!onPointSelect) return;
    const nearest = nearestPoint(event.clientX, event.currentTarget);
    if (nearest) onPointSelect(nearest.point.sample);
  };

  const selectedZone = zones.find((zone) => zone.id === activeZone);
  const livePoint = liveSample && chart
    ? chart.points.find((point) => point.sample.recordedAt === liveSample.recordedAt) ?? null
    : null;

  const chartBlock = (
    <div className="history-chart" ref={chartWrapRef}>
      {chart ? (
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          role="img"
          aria-label={`Biểu đồ ${METRICS[metric].label} của ${activeZone}`}
          className={`history-svg ${onPointSelect ? "clickable" : ""}`}
          onPointerMove={handleMove}
          onPointerDown={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
          onPointerCancel={() => setHoverIndex(null)}
          onClick={handleClick}
        >
          <defs>
            <linearGradient id={`history-fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.config.color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={chart.config.color} stopOpacity="0" />
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
                className="history-axis-text"
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
              className="history-axis-text"
            >
              {formatAxisTime(tick.timestamp, range)}
            </text>
          ))}

          {chart.thresholdY !== null && (
            <g>
              <line
                x1={CHART.left}
                x2={CHART.width - CHART.right}
                y1={chart.thresholdY}
                y2={chart.thresholdY}
                stroke="#b58a3f"
                strokeWidth="1.3"
                strokeDasharray="5 6"
              />
              <text
                x={CHART.width - CHART.right}
                y={chart.thresholdY - 6}
                textAnchor="end"
                className="history-threshold-text"
              >
                Ngưỡng {chart.threshold}%
              </text>
            </g>
          )}

          {chart.focusX !== null && (
            <g className="history-focus-mark">
              <line
                x1={chart.focusX}
                x2={chart.focusX}
                y1={CHART.top}
                y2={chart.baseline}
                stroke="#8a6425"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              <text
                x={chart.focusX + (chart.focusX > CHART.width * 0.72 ? -6 : 6)}
                y={CHART.top + 11}
                textAnchor={chart.focusX > CHART.width * 0.72 ? "end" : "start"}
                className="history-focus-text"
              >
                Mốc nhật ký
              </text>
              {chart.focusPoint && (
                <circle
                  cx={chart.focusPoint.x}
                  cy={chart.focusPoint.y}
                  r="4.5"
                  fill="none"
                  stroke="#8a6425"
                  strokeWidth="2"
                />
              )}
            </g>
          )}

          <path d={chart.area} fill={`url(#history-fill-${metric})`} />
          <path
            d={chart.line}
            fill="none"
            stroke={chart.config.color}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {chart.points.length <= 60 &&
            chart.points.map((point, index) => (
              <circle
                key={`point-${index}`}
                cx={point.x}
                cy={point.y}
                r="2"
                fill={chart.config.color}
              />
            ))}

          {livePoint && (
            <g className="history-live-point">
              <circle
                cx={livePoint.x}
                cy={livePoint.y}
                r="7"
                fill={chart.config.color}
                opacity="0.18"
              />
              <circle
                cx={livePoint.x}
                cy={livePoint.y}
                r="3.5"
                fill={chart.config.color}
                stroke="#fff"
                strokeWidth="1.5"
              />
            </g>
          )}

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
                stroke={chart.config.color}
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>
      ) : (
        <div className={`history-empty ${error ? "error" : ""}`}>
          {loading
            ? "Đang tải lịch sử..."
            : error ??
              (compact
                ? "Chưa có dữ liệu trong 6 giờ qua."
                : "Chưa có dữ liệu trong khoảng này. Dữ liệu sẽ xuất hiện sau khi ESP32 gửi telemetry trong lúc Backend đang chạy.")}
        </div>
      )}

      {hoverPoint && chart && (
        <div
          className="history-tooltip"
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
          <strong>{formatValue(hoverPoint.sample[metric], metric)}</strong>
          <span>
            {new Date(hoverPoint.sample.recordedAt).toLocaleString("vi-VN")}
          </span>
        </div>
      )}
    </div>
  );

  const lastSampleAt = series.length > 0 ? series[series.length - 1].recordedAt : null;
  const isStale =
    lastSampleAt !== null && now !== null && now - lastSampleAt > 5 * 60 * 1000;

  const statsBlock = (
    <div className={`history-stats ${compact ? "compact" : ""}`}>
      {stats && (
        <>
          <span>
            Thấp nhất <strong>{formatValue(stats.min, metric)}</strong>
          </span>
          <span>
            Trung bình <strong>{formatValue(stats.avg, metric)}</strong>
          </span>
          <span>
            Cao nhất <strong>{formatValue(stats.max, metric)}</strong>
          </span>
        </>
      )}
      <span
        className={`history-status ${error ? "error" : ""} ${isStale ? "stale" : ""}`}
      >
        {loading
          ? "Đang cập nhật..."
          : error
            ? "Mất kết nối dữ liệu"
            : lastSampleAt === null
              ? "Chưa có mẫu dữ liệu"
              : `Mẫu cuối ${new Date(lastSampleAt).toLocaleTimeString("vi-VN")}${
                  isStale && now !== null ? ` · đã cũ (${formatAge(lastSampleAt, now)})` : ""
                }`}
      </span>
    </div>
  );

  if (compact) {
    return (
      <>
        {chartBlock}
        {statsBlock}
      </>
    );
  }

  return (
    <section className="panel history-panel" id="history">
      <div className="panel-heading history-heading">
        <div>
          <h2>Lịch sử cảm biến</h2>
          <p>
            {selectedZone
              ? `${selectedZone.id} · ${selectedZone.name}`
              : activeZone}{" "}
            · {RANGES[range].label} gần nhất · {series.length} điểm dữ liệu
          </p>
        </div>
        <div className="history-controls">
          {livePoint && (
            <span className="live-pill">
              <i /> Trực tiếp
            </span>
          )}
          <select
            className="history-zone-select"
            value={activeZone}
            onChange={(event) => onSelectZone(event.target.value)}
            aria-label="Chọn khu vực xem lịch sử"
          >
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.id} · {zone.name}
              </option>
            ))}
          </select>
          <div className="view-switch">
            {(Object.keys(RANGES) as RangeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={range === key ? "selected" : ""}
                aria-pressed={range === key}
                onClick={() => setRange(key)}
              >
                {RANGES[key].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="history-metrics">
        {(Object.keys(METRICS) as MetricKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`history-metric ${metric === key ? "selected" : ""}`}
            aria-pressed={metric === key}
            onClick={() => setMetric(key)}
          >
            <i style={{ background: METRICS[key].color }} />
            {METRICS[key].label}
          </button>
        ))}
      </div>

      {onPointSelect && (
        <p className="history-hint">
          Chạm vào một điểm trên biểu đồ để xem nhật ký quanh mốc thời gian đó.
          <span className="history-scroll-hint">Vuốt ngang để xem đủ biểu đồ.</span>
        </p>
      )}

      {chartBlock}
      {statsBlock}
    </section>
  );
}
