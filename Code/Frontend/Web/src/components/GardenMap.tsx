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
  const anyPumping = zones.some((zone) => zone.online && zone.pump);
  const mapZones = zones.map((zone, index) => ({
    ...zone,
    x: 65 + (index % 2) * 415,
    y: 85 + Math.floor(index / 2) * 155,
    width: 360,
    height: 120,
  }));
  const mapHeight = Math.max(520, 160 + Math.ceil(mapZones.length / 2) * 155);

  const mainPipeX = 445; // Trục đường ống xương cá trung tâm nằm giữa 2 hàng luống
  const mainPipeTop = 60;
  const mainPipeBottom = mapHeight - 55;

  return (
    <div className={`garden-map-container ${view === "map" ? "map-mode" : ""}`}>
      <svg
        viewBox={`0 0 900 ${mapHeight}`}
        role="img"
        aria-label="Sơ đồ 2D khu vườn thông minh"
        className="garden-svg"
      >
        <defs>
          {/* Lớp nền đất tự nhiên sang trọng */}
          <linearGradient id="soil-pattern" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8d5635" />
            <stop offset="25%" stopColor="#7a4628" />
            <stop offset="85%" stopColor="#67391f" />
            <stop offset="100%" stopColor="#552c16" />
          </linearGradient>

          {/* Viền sáng cho luống đất */}
          <linearGradient id="soil-highlight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#aa6d46" />
            <stop offset="50%" stopColor="#bf7e55" />
            <stop offset="100%" stopColor="#aa6d46" />
          </linearGradient>

          {/* Nền bãi cỏ hiện đại nhiều tầng màu */}
          <linearGradient id="grass-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8f8e0" />
            <stop offset="50%" stopColor="#dff3d6" />
            <stop offset="100%" stopColor="#d5eccb" />
          </linearGradient>

          {/* Gradient vỏ ống nhựa kỹ thuật (Industrial Polyethylene) */}
          <linearGradient id="pipe-casing" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1e272e" />
            <stop offset="40%" stopColor="#485460" />
            <stop offset="60%" stopColor="#2f3542" />
            <stop offset="100%" stopColor="#1e272e" />
          </linearGradient>

          {/* Gradient dòng nước bên trong ống khi bật bơm */}
          <linearGradient id="water-core" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00d2d3" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#00d2d3" />
          </linearGradient>

          {/* Khối bụi cỏ tự nhiên */}
          <pattern
            id="grass-tufts"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M10 45 Q 12 30 16 26 Q 18 36 22 45"
              fill="none"
              stroke="#b5dd9f"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M14 45 Q 18 33 24 29 Q 25 38 27 45"
              fill="none"
              stroke="#9ecf86"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="48" cy="18" r="2.5" fill="#fce4a6" opacity="0.6" />
            <circle cx="52" cy="16" r="1.5" fill="#fbc531" opacity="0.7" />
          </pattern>

          {/* Hiệu ứng bóng đổ chân thực */}
          <filter id="bed-shadow" x="-8%" y="-8%" width="120%" height="130%">
            <feDropShadow
              dx="0"
              dy="8"
              stdDeviation="9"
              floodColor="#1e3e23"
              floodOpacity="0.18"
            />
          </filter>

          <filter id="pipe-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="4"
              floodColor="#132a18"
              floodOpacity="0.25"
            />
          </filter>

          <filter id="active-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="8"
              floodColor="#20bf6b"
              floodOpacity="0.45"
            />
          </filter>

          <filter id="water-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="5"
              floodColor="#00d2d3"
              floodOpacity="0.75"
            />
          </filter>
        </defs>

        {/* Nền toàn khu vườn */}
        <rect
          x="12"
          y="12"
          width="876"
          height={mapHeight - 24}
          rx="24"
          fill="url(#grass-bg)"
        />
        <rect
          x="12"
          y="12"
          width="876"
          height={mapHeight - 24}
          rx="24"
          fill="url(#grass-tufts)"
        />

        {/* Lối đi rải sỏi mềm mại uốn lượn */}
        <path
          d={`M 35 450 C 180 390, 220 310, 450 330 S 720 390, 865 240`}
          fill="none"
          stroke="#f1e5cc"
          strokeWidth="38"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d={`M 35 450 C 180 390, 220 310, 450 330 S 720 390, 865 240`}
          fill="none"
          stroke="#d9c39e"
          strokeWidth="2"
          strokeDasharray="8 12"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* ================= HỆ THỐNG ĐƯỜNG ỐNG TƯỚI NGẦM / NỔI KỸ THUẬT (XƯƠNG CÁ) ================= */}
        <g className="irrigation-pipe-system">
          {/* Trục ống chính: Vỏ ống ngoài màu xám than kỹ thuật có bóng đổ */}
          <line
            x1={mainPipeX}
            y1={mainPipeTop}
            x2={mainPipeX}
            y2={mainPipeBottom}
            stroke="url(#pipe-casing)"
            strokeWidth="9"
            strokeLinecap="round"
            filter="url(#pipe-shadow)"
          />

          {/* Khớp nối van điện từ chính (Main Valve Box) ở đầu nguồn */}
          <rect
            x={mainPipeX - 9}
            y={mainPipeTop - 8}
            width="18"
            height="18"
            rx="4"
            fill="#2c3e50"
            stroke="#7f8c8d"
            strokeWidth="2"
          />
          <circle
            cx={mainPipeX}
            cy={mainPipeTop + 1}
            r="4"
            fill={anyPumping ? "#00cec9" : "#95a5a6"}
          />

          {/* Các nhánh rẽ xương cá dẫn tới từng luống */}
          {mapZones.map((zone, idx) => {
            const isLeft = idx % 2 === 0;
            const branchY = zone.y + zone.height / 2;
            const targetX = isLeft ? zone.x + zone.width : zone.x;

            return (
              <g key={`pipe-branch-${zone.id}`}>
                {/* Ống nhánh kim loại / HDPE */}
                <line
                  x1={mainPipeX}
                  y1={branchY}
                  x2={targetX}
                  y2={branchY}
                  stroke="url(#pipe-casing)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />

                {/* Khớp nối chữ T (T-Junction) */}
                <circle
                  cx={mainPipeX}
                  cy={branchY}
                  r="5.5"
                  fill="#2d3436"
                  stroke="#636e72"
                  strokeWidth="1.5"
                />

                {/* Van điện từ / béc phun ở đầu luống */}
                <rect
                  x={isLeft ? targetX - 5 : targetX - 3}
                  y={branchY - 5}
                  width="8"
                  height="10"
                  rx="2"
                  fill="#34495e"
                />

                {/* Dòng nước chảy trong nhánh khi khu vực này đang được tưới */}
                {zone.online && zone.pump && (
                  <line
                    x1={mainPipeX}
                    y1={branchY}
                    x2={targetX}
                    y2={branchY}
                    stroke="url(#water-core)"
                    strokeWidth="2.5"
                    strokeDasharray="8 4"
                    className="branch-pipe-flow"
                    filter="url(#water-glow)"
                  />
                )}
              </g>
            );
          })}

          {/* Dòng nước xung nhịp chạy trong trục ống chính khi máy bơm bật */}
          {anyPumping && (
            <line
              x1={mainPipeX}
              y1={mainPipeTop}
              x2={mainPipeX}
              y2={mainPipeBottom}
              stroke="url(#water-core)"
              strokeWidth="4"
              strokeDasharray="14 8"
              className="active-pipe-flow"
              filter="url(#water-glow)"
            />
          )}
        </g>

        {/* Từng luống cây nông trại */}
        {mapZones.map((zone) => {
          const isSelected = zone.id === activeZone;
          const isWatering = zone.online && zone.pump;

          return (
            <g
              key={zone.id}
              className={`garden-bed ${isSelected ? "selected" : ""} ${isWatering ? "watering" : ""}`}
              onClick={() => onSelect(zone.id)}
            >
              {/* Bóng đổ luống */}
              <rect
                x={zone.x}
                y={zone.y + 6}
                width={zone.width}
                height={zone.height}
                rx="18"
                fill="#1f3b27"
                opacity="0.14"
              />

              {/* Thân luống đất vườn 3D */}
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                rx="16"
                fill="url(#soil-pattern)"
                stroke={isSelected ? "#10ac84" : "#8d5635"}
                strokeWidth={isSelected ? 3.5 : 1.5}
                filter={isSelected ? "url(#active-glow)" : "url(#bed-shadow)"}
                className="soil-bed-rect"
              />

              {/* Rãnh cày tơi xốp trên bề mặt */}
              <rect
                x={zone.x + 8}
                y={zone.y + 6}
                width={zone.width - 16}
                height={4}
                rx="2"
                fill="url(#soil-highlight)"
                opacity="0.65"
              />
              <path
                d={`M${zone.x + 18} ${zone.y + 35} h${zone.width - 36} M${zone.x + 18} ${zone.y + 65} h${zone.width - 36} M${zone.x + 18} ${zone.y + 95} h${zone.width - 36}`}
                stroke="#432211"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.75"
              />

              {/* Cây trồng theo luống với màu sắc và hoạt họa rung rinh */}
              {[...Array(12)].map((_, i) => {
                const col = i % 6;
                const row = Math.floor(i / 6);
                const plantX = zone.x + 36 + col * ((zone.width - 72) / 5);
                const plantY = zone.y + 44 + row * 40;
                const delay = (i * 0.12).toFixed(2);

                return (
                  <g
                    key={i}
                    className="plant-cluster"
                    style={{
                      transformOrigin: `${plantX}px ${plantY}px`,
                      animationDelay: `${delay}s`,
                    }}
                  >
                    {/* Lá cây / cụm quả */}
                    <ellipse
                      cx={plantX}
                      cy={plantY}
                      rx="12"
                      ry="9"
                      fill={zone.color || "#2ed573"}
                      opacity="0.9"
                      className="leaf-blob"
                    />
                    <circle
                      cx={plantX - 4}
                      cy={plantY - 3}
                      r="4"
                      fill="#ffffff"
                      opacity="0.35"
                    />
                    {/* Nhụy / tim hoa lá */}
                    <circle
                      cx={plantX}
                      cy={plantY}
                      r="2.5"
                      fill="#1e3926"
                      opacity="0.4"
                    />
                  </g>
                );
              })}

              {/* Vòi tưới phun sương mini phát hoạt họa hạt nước khi tưới */}
              {isWatering && (
                <g
                  className="sprinkler-spray"
                  transform={`translate(${zone.x + zone.width / 2}, ${zone.y + zone.height / 2})`}
                >
                  <circle
                    cx="0"
                    cy="0"
                    r="42"
                    fill="none"
                    stroke="#22a6b3"
                    strokeWidth="2.5"
                    opacity="0.6"
                    className="spray-ripple-1"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="65"
                    fill="none"
                    stroke="#7ed6df"
                    strokeWidth="1.5"
                    opacity="0.4"
                    className="spray-ripple-2"
                  />
                  <circle
                    cx="-16"
                    cy="-14"
                    r="3"
                    fill="#00d2d3"
                    className="water-drop-p1"
                  />
                  <circle
                    cx="20"
                    cy="-18"
                    r="2.5"
                    fill="#00d2d3"
                    className="water-drop-p2"
                  />
                  <circle
                    cx="15"
                    cy="20"
                    r="3"
                    fill="#00d2d3"
                    className="water-drop-p3"
                  />
                  <circle
                    cx="-22"
                    cy="18"
                    r="2"
                    fill="#00d2d3"
                    className="water-drop-p4"
                  />
                </g>
              )}

              {/* Nhãn tên khu vực thiết kế dạng badge hiện đại */}
              <g transform={`translate(${zone.x + 14}, ${zone.y - 12})`}>
                <rect
                  x="0"
                  y="-14"
                  width="135"
                  height="22"
                  rx="6"
                  fill="#ffffff"
                  filter="drop-shadow(0 2px 5px rgba(0,0,0,0.08))"
                />
                <circle
                  cx="10"
                  cy="-3"
                  r="4.5"
                  fill={zone.online ? "#10ac84" : "#c8d6e5"}
                />
                <text
                  x="20"
                  y="1"
                  fill="#2c3e50"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="var(--font-lexend), sans-serif"
                >
                  {zone.id} · {zone.name}
                </text>
              </g>

              {/* Badge độ ẩm thời gian thực trên mỗi luống */}
              <g
                transform={`translate(${zone.x + zone.width - 70}, ${zone.y - 12})`}
              >
                <rect
                  x="0"
                  y="-14"
                  width="60"
                  height="22"
                  rx="6"
                  fill={zone.moisture !== null && zone.moisture < zone.threshold ? "#ffefe9" : "#ebfbee"}
                  stroke={
                    zone.moisture !== null && zone.moisture < zone.threshold ? "#ff7675" : "#55efc4"
                  }
                  strokeWidth="1"
                />
                <text
                  x="30"
                  y="1"
                  fill={zone.moisture !== null && zone.moisture < zone.threshold ? "#d63031" : "#00b894"}
                  fontSize="11"
                  fontWeight="800"
                  textAnchor="middle"
                  fontFamily="var(--font-lexend), sans-serif"
                >
                  {zone.online ? `${zone.moisture}%` : "--"}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Chú thích map legend cải tiến */}
      <div className="map-legend">
        <span className="legend-item">
          <i className="dot green pulse-dot" /> ESP32 Realtime
        </span>
        <span className="legend-item">
          <i className="dot amber" /> Đất khô (cần tưới)
        </span>
      </div>
    </div>
  );
}
