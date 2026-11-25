"use client";

import { useMemo } from "react";
import type { Zone } from "../garden-data";
import type { ZoneWateringSummary } from "../lib/garden-api";
import { DropletIcon } from "./icons";

const SLICE_COLORS = [
  "var(--green-fill)",
  "var(--blue)",
  "var(--amber)",
  "#8b6cf3",
  "#d97757",
  "#2f9e73",
];

function formatLiters(value: number): string {
  if (value <= 0) return "0 L";
  if (value >= 10) return `${Math.round(value)} L`;
  return `${value.toFixed(1)} L`;
}

export function WaterDonut({
  zones,
  byZone,
}: {
  zones: Zone[];
  byZone: Record<string, ZoneWateringSummary>;
}) {
  const slices = useMemo(
    () =>
      zones.map((zone, index) => ({
        id: zone.id,
        label: zone.name.trim() || zone.id,
        liters: Math.max(0, byZone[zone.id]?.todayLiters ?? 0),
        color: SLICE_COLORS[index % SLICE_COLORS.length],
      })),
    [zones, byZone],
  );

  const total = slices.reduce((sum, slice) => sum + slice.liters, 0);
  // Chia phần trăm theo largest-remainder để tổng luôn đúng 100% sau làm tròn.
  const percents = useMemo(() => {
    if (total <= 0) return slices.map(() => 0);
    const raw = slices.map((slice) => (slice.liters / total) * 100);
    const rounded = raw.map(Math.floor);
    let remainder = 100 - rounded.reduce((sum, value) => sum + value, 0);
    const byFraction = raw
      .map((value, index) => ({ index, fraction: value - rounded[index] }))
      .sort((a, b) => b.fraction - a.fraction);
    for (let i = 0; i < byFraction.length && remainder > 0; i += 1) {
      rounded[byFraction[i].index] += 1;
      remainder -= 1;
    }
    return rounded;
  }, [slices, total]);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.filter((slice) => slice.liters > 0).length > 1 ? 2 : 0;

  let offset = 0;
  const arcs = slices
    .filter((slice) => slice.liters > 0)
    .map((slice) => {
      const dash = (slice.liters / total) * circumference;
      const arc = {
        ...slice,
        dash: Math.max(0, dash - gap),
        offset,
      };
      offset += dash;
      return arc;
    });

  return (
    <section className="panel water-donut-card">
      <div className="panel-heading">
        <div>
          <h2>Nước tưới hôm nay</h2>
          <p>Lượng nước đã bơm theo từng khu.</p>
        </div>
        <span className="card-icon">
          <DropletIcon size={18} />
        </span>
      </div>

      <div className="donut-wrap">
        <svg
          className="donut-svg"
          viewBox="0 0 120 120"
          role="img"
          aria-label="Biểu đồ tròn lượng nước tưới hôm nay theo khu vườn"
        >
          <circle
            className="donut-track"
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="14"
          />
          {arcs.map((arc) => (
            <circle
              key={arc.id}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth="14"
              strokeLinecap="butt"
              strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
              strokeDashoffset={-arc.offset}
              transform="rotate(-90 60 60)"
            />
          ))}
          <text className="donut-total" x="60" y="58">
            {formatLiters(total)}
          </text>
          <text className="donut-caption" x="60" y="73">
            hôm nay
          </text>
        </svg>
      </div>

      {total === 0 ? (
        <p className="donut-empty">Chưa có nước tưới trong hôm nay.</p>
      ) : (
        <ul className="donut-legend">
          {slices.map((slice, index) => (
            <li
              key={slice.id}
              className={`donut-legend-row ${slice.liters === 0 ? "zero" : ""}`}
            >
              <span className="donut-dot" style={{ background: slice.color }} />
              <span className="donut-legend-name">
                {slice.id} · {slice.label}
              </span>
              <span className="donut-legend-value">
                {formatLiters(slice.liters)}
              </span>
              <span className="donut-legend-pct">{`${percents[index]}%`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
