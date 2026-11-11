"use client";

import { useEffect, useRef } from "react";
import type { Zone } from "../garden-data";

export function GardenMap({
  zones,
  activeZone,
  onSelect,
}: {
  zones: Zone[];
  activeZone: string;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedIndex = zones.findIndex((zone) => zone.id === activeZone);

  // Trên mobile sơ đồ rộng hơn khung nhìn: cuộn tới luống đang chọn.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || selectedIndex < 0) return;
    if (container.scrollWidth <= container.clientWidth + 4) return;
    const col = selectedIndex % 2;
    const center = ((55 + col * 455 + 185) / 900) * container.scrollWidth;
    container.scrollTo({
      left: Math.max(0, center - container.clientWidth / 2),
      behavior: "smooth",
    });
  }, [selectedIndex]);

  const anyPumping = zones.some((zone) => zone.online && zone.pump);
  const rows = Math.ceil(zones.length / 2);
  const mapHeight = 96 + rows * 148;
  const beds = zones.map((zone, index) => ({
    zone,
    x: 55 + (index % 2) * 455,
    y: 84 + Math.floor(index / 2) * 148,
    width: 370,
    height: 112,
  }));

  const pipeX = 468;
  const pipeTop = 44;
  const pipeBottom = mapHeight - 52;

  return (
    <div className="garden-map">
      <div className="garden-map-container" ref={containerRef}>
        <svg
        viewBox={`0 0 900 ${mapHeight}`}
        role="img"
        aria-label="Sơ đồ 2D khu vườn thông minh"
        className="garden-svg"
      >
        <rect
          x="8"
          y="8"
          width="884"
          height={mapHeight - 16}
          rx="14"
          fill="#eef2e7"
          stroke="#dfe6d8"
        />

        <g className="pipe-system">
          <line
            x1={pipeX}
            y1={pipeTop}
            x2={pipeX}
            y2={pipeBottom}
            stroke="#a7b1a3"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <rect
            x={pipeX - 7}
            y={pipeTop - 7}
            width="14"
            height="14"
            rx="3"
            fill="#8d998c"
          />
          {beds.map(({ zone, x, width, y, height }) => {
            const branchY = y + height / 2;
            const targetX = x < pipeX ? x + width : x;
            return (
              <g key={`pipe-${zone.id}`}>
                <line
                  x1={pipeX}
                  y1={branchY}
                  x2={targetX}
                  y2={branchY}
                  stroke="#a7b1a3"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <circle cx={pipeX} cy={branchY} r="4.5" fill="#8d998c" />
                {zone.online && zone.pump && (
                  <line
                    x1={pipeX}
                    y1={branchY}
                    x2={targetX}
                    y2={branchY}
                    stroke="#5f8f74"
                    strokeWidth="2.5"
                    strokeDasharray="8 6"
                    className="branch-pipe-flow"
                  />
                )}
              </g>
            );
          })}
          {anyPumping && (
            <line
              x1={pipeX}
              y1={pipeTop}
              x2={pipeX}
              y2={pipeBottom}
              stroke="#5f8f74"
              strokeWidth="3"
              strokeDasharray="12 8"
              className="active-pipe-flow"
            />
          )}
        </g>

        {beds.map(({ zone, x, y, width, height }) => {
          const isSelected = zone.id === activeZone;
          const isWatering = zone.online && zone.pump;
          const isDry =
            zone.online && zone.moisture !== null && zone.moisture < zone.threshold;

          return (
            <g
              key={zone.id}
              className="garden-bed"
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Chọn vùng ${zone.id} ${zone.name}`}
              onClick={() => onSelect(zone.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(zone.id);
              }}
            >
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx="12"
                fill="#d9c8ab"
                stroke={isSelected ? "#4f7a5d" : "#c2b08e"}
                strokeWidth={isSelected ? 2.5 : 1}
              />

              <path
                d={`M${x + 16} ${y + 34} h${width - 32} M${x + 16} ${y + 64} h${width - 32} M${x + 16} ${y + 94} h${width - 32}`}
                stroke="#c8b592"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {Array.from({ length: 12 }, (_, index) => {
                const col = index % 6;
                const row = Math.floor(index / 6);
                const plantX = x + 34 + col * ((width - 68) / 5);
                const plantY = y + 30 + row * 52;
                return (
                  <ellipse
                    key={index}
                    cx={plantX}
                    cy={plantY}
                    rx="10"
                    ry="7"
                    fill={zone.color}
                    opacity={zone.online ? 0.8 : 0.35}
                  />
                );
              })}

              {isWatering && (
                <circle
                  cx={x + width / 2}
                  cy={y + height / 2}
                  r="42"
                  fill="none"
                  stroke="#5f8f74"
                  strokeWidth="1.5"
                  strokeDasharray="5 6"
                  opacity="0.6"
                />
              )}

              <text
                x={x + 14}
                y={y - 12}
                fill="#33463b"
                fontSize="12.5"
                fontWeight="600"
                fontFamily="var(--font-lexend), sans-serif"
              >
                {zone.id} · {zone.name}
              </text>
              <text
                x={x + width - 14}
                y={y - 12}
                textAnchor="end"
                fill={isDry ? "#a06c2b" : "#587764"}
                fontSize="12"
                fontWeight="600"
                fontFamily="var(--font-lexend), sans-serif"
              >
                {zone.online
                  ? `${zone.moisture}%${isWatering ? " · đang tưới" : ""}`
                  : "offline"}
              </text>
            </g>
          );
        })}
      </svg>
      </div>

      <div className="map-legend">
        <span>
          <i className="dot green" /> Dữ liệu trực tiếp
        </span>
        <span>
          <i className="line" /> Đường ống tưới
        </span>
        <span>
          <i className="dot amber" /> Đất khô dưới ngưỡng
        </span>
      </div>

      <p className="map-hint">Vuốt ngang sơ đồ để xem đủ 6 luống.</p>
    </div>
  );
}
