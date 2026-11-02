import type { Zone } from "../garden-data";

export function GardenMap({
  zones,
  activeZone,
  onSelect,
  view,
}: {
  zones: Zone[];
  activeZone: string;
  onSelect: (id: string) => void;
  view: "2d" | "map";
}) {
  const mapZones = zones.map((zone, index) => ({
    ...zone,
    x: 70 + (index % 2) * 405,
    y: 92 + Math.floor(index / 2) * 145,
    width: 350,
    height: 108,
  }));
  const mapHeight = Math.max(500, 165 + Math.ceil(mapZones.length / 2) * 145);

  return (
    <div className={`garden-map ${view === "map" ? "map-mode" : ""}`}>
      <svg
        viewBox={`0 0 900 ${mapHeight}`}
        role="img"
        aria-label="Sơ đồ 2D khu vườn"
      >
        <defs>
          <linearGradient id="soil" x1="0" x2="1">
            <stop offset="0" stopColor="#bb7a4d" />
            <stop offset="1" stopColor="#9b5b39" />
          </linearGradient>
          <pattern id="grass" width="36" height="36" patternUnits="userSpaceOnUse">
            <rect width="36" height="36" fill="#dff2d5" />
            <path
              d="M4 28l5-8m3 10 5-11m12 6 3-7M20 6l3 5"
              stroke="#c7e9bc"
              strokeWidth="2"
            />
          </pattern>
        </defs>
        <rect
          x="15"
          y="15"
          width="870"
          height={mapHeight - 30}
          rx="26"
          fill="url(#grass)"
        />
        <path
          d="M45 338 C180 290 215 270 360 295 S600 315 855 220"
          fill="none"
          stroke="#f8efd9"
          strokeWidth="34"
          opacity=".9"
        />
        <path
          d="M45 338 C180 290 215 270 360 295 S600 315 855 220"
          fill="none"
          stroke="#e9d8b0"
          strokeWidth="2"
          strokeDasharray="8 8"
        />
        {mapZones.map((zone) => {
          const selected = zone.id === activeZone;
          return (
            <g
              key={zone.id}
              className={`garden-zone ${selected ? "selected" : ""}`}
              onClick={() => onSelect(zone.id)}
            >
              <rect
                x={zone.x + 8}
                y={zone.y + 9}
                width={zone.width}
                height={zone.height}
                rx="10"
                fill="#754630"
                opacity=".22"
              />
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                rx="10"
                fill="url(#soil)"
                stroke={selected ? "#123e34" : "#855137"}
                strokeWidth={selected ? 5 : 3}
              />
              <path
                d={`M${zone.x + 22} ${zone.y + 28}h${zone.width - 44}M${zone.x + 22} ${zone.y + 56}h${zone.width - 44}M${zone.x + 22} ${zone.y + 84}h${zone.width - 44}`}
                stroke="#6e3c28"
                strokeWidth="4"
                opacity=".7"
              />
              {[...Array(8)].map((_, index) => (
                <circle
                  key={index}
                  cx={zone.x + 32 + (index % 4) * ((zone.width - 82) / 3)}
                  cy={zone.y + 67 + Math.floor(index / 4) * 24}
                  r="7"
                  fill={zone.color}
                  opacity=".95"
                />
              ))}
              <text
                x={zone.x + 15}
                y={zone.y - 12}
                fill="#315445"
                fontSize="13"
                fontWeight="700"
              >
                Khu {zone.name}
              </text>
              {selected && (
                <circle
                  cx={zone.x + zone.width - 18}
                  cy={zone.y + 18}
                  r="8"
                  fill={zone.online ? "#1eae72" : "#aab5af"}
                  stroke="#fff"
                  strokeWidth="3"
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="map-legend">
        <span>
          <i className="dot green" /> Sensor online
        </span>
        <span>
          <i className="dot amber" /> Needs attention
        </span>
        <span>
          <i className="line" /> Irrigation path
        </span>
      </div>
    </div>
  );
}
