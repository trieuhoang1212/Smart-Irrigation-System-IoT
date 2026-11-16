import type { Zone } from "../garden-data";

export type SearchPageKey = "overview" | "analysis" | "history" | "activity" | "garden";

export type SearchItem = {
  id: string;
  label: string;
  hint: string;
  page: SearchPageKey;
  keywords: string[];
  zoneId?: string;
};

export const SEARCH_ITEMS: SearchItem[] = [
  {
    id: "overview-board",
    label: "Sơ đồ ô trồng",
    hint: "Chọn ô để xem chi tiết bên phải",
    page: "overview",
    keywords: ["sơ đồ", "ô trồng", "vùng trồng", "chọn ô", "garden board"],
  },
  {
    id: "overview-weather",
    label: "Thời tiết ngoài vườn",
    hint: "Nhiệt độ, độ ẩm không khí và ngưỡng hoãn mưa",
    page: "overview",
    keywords: ["thời tiết", "nhiệt độ", "độ ẩm không khí", "mưa", "weather"],
  },
  {
    id: "overview-tank",
    label: "Mực nước bồn",
    hint: "Khoảng cách cảm biến và cảnh báo cạn bồn",
    page: "overview",
    keywords: ["bồn nước", "bồn", "mực nước", "tank", "cảm biến siêu âm"],
  },
  {
    id: "overview-health",
    label: "Sức khỏe khu vườn",
    hint: "Ô nào đang khô, ô nào quá ẩm",
    page: "overview",
    keywords: ["sức khỏe", "tổng quan", "ô khô", "cảnh báo"],
  },
  {
    id: "overview-pump",
    label: "Điều khiển bơm & chế độ",
    hint: "Bật tắt bơm, chuyển Tự động / Thủ công",
    page: "overview",
    keywords: ["bơm", "máy bơm", "pump", "chế độ", "tự động", "thủ công"],
  },
  {
    id: "overview-water",
    label: "Thông số nước tưới",
    hint: "Lưu lượng và mục tiêu lít mỗi lượt",
    page: "overview",
    keywords: ["lưu lượng", "lít", "nước tưới", "mục tiêu", "flow", "target"],
  },
  {
    id: "overview-advice",
    label: "Khuyến nghị tưới",
    hint: "Gợi ý ngưỡng theo loại đất và mùa",
    page: "overview",
    keywords: ["khuyến nghị", "gợi ý", "ngưỡng tưới", "đất", "mùa"],
  },
  {
    id: "overview-chart",
    label: "Diễn biến độ ẩm 6 giờ",
    hint: "Biểu đồ nhanh và hoạt động gần đây",
    page: "overview",
    keywords: ["biểu đồ", "độ ẩm", "6 giờ", "hoạt động gần đây"],
  },
  {
    id: "overview-detail",
    label: "Chi tiết ô đang chọn",
    hint: "Cây trồng, đất và lần tưới gần nhất",
    page: "overview",
    keywords: ["chi tiết", "cây", "đất", "lần tưới"],
  },
  {
    id: "overview-connection",
    label: "Kết nối thiết bị",
    hint: "Trạng thái ESP32, MQTT và lần cập nhật cuối",
    page: "overview",
    keywords: ["kết nối", "thiết bị", "esp32", "mqtt", "offline", "mất kết nối"],
  },
  {
    id: "analysis-score",
    label: "Điểm sức khỏe cây",
    hint: "Thang 100 điểm theo độ ẩm, thời tiết, nguồn nước",
    page: "analysis",
    keywords: ["điểm", "chấm điểm", "sức khỏe", "score"],
  },
  {
    id: "analysis-chart",
    label: "Diễn biến độ ẩm đất",
    hint: "Xem 24 giờ, 7 ngày hoặc 30 ngày",
    page: "analysis",
    keywords: ["biểu đồ", "độ ẩm", "xu hướng", "24 giờ", "7 ngày", "30 ngày"],
  },
  {
    id: "analysis-stats",
    label: "Chỉ số trong kỳ",
    hint: "Vùng an toàn, khô liên tục, số lần bơm",
    page: "analysis",
    keywords: ["chỉ số", "thống kê", "trung bình", "vùng an toàn"],
  },
  {
    id: "analysis-advice",
    label: "Gợi ý chăm sóc",
    hint: "Khuyến nghị theo dữ liệu cảm biến",
    page: "analysis",
    keywords: ["gợi ý", "chăm sóc", "khuyến nghị"],
  },
  {
    id: "history-chart",
    label: "Biểu đồ cảm biến",
    hint: "Độ ẩm, nhiệt độ và cảm biến mưa",
    page: "history",
    keywords: ["biểu đồ", "lịch sử", "cảm biến", "độ ẩm", "nhiệt độ", "mưa"],
  },
  {
    id: "history-marker",
    label: "Mốc đánh dấu trên biểu đồ",
    hint: "Mở nhật ký quanh một thời điểm",
    page: "history",
    keywords: ["mốc", "đánh dấu", "thời gian", "nhật ký"],
  },
  {
    id: "history-click",
    label: "Chạm biểu đồ để mở nhật ký",
    hint: "Đối chiếu cảm biến với lệnh điều khiển",
    page: "history",
    keywords: ["chạm", "click", "đối chiếu"],
  },
  {
    id: "activity-pump",
    label: "Lệnh bơm",
    hint: "Ai bật/tắt, lúc nào, đã xác nhận chưa",
    page: "activity",
    keywords: ["bơm", "lệnh", "pump", "xác nhận"],
  },
  {
    id: "activity-threshold",
    label: "Thay đổi ngưỡng",
    hint: "Lịch sử chỉnh ngưỡng tưới",
    page: "activity",
    keywords: ["ngưỡng", "cấu hình", "thay đổi"],
  },
  {
    id: "activity-rain",
    label: "Hoãn do mưa",
    hint: "Các lần hệ thống chặn tưới vì mưa",
    page: "activity",
    keywords: ["mưa", "hoãn", "chặn tưới", "weather gate"],
  },
  {
    id: "activity-export",
    label: "Xuất Excel",
    hint: "Tải danh sách đang lọc ra tệp CSV",
    page: "activity",
    keywords: ["excel", "csv", "xuất", "tải", "tệp"],
  },
  {
    id: "activity-cleanup",
    label: "Dọn dữ liệu cũ",
    hint: "Xóa mẫu cảm biến và lệnh cũ theo số ngày",
    page: "activity",
    keywords: ["xóa", "dọn", "dữ liệu cũ", "retention"],
  },
  {
    id: "garden-profile",
    label: "Hồ sơ ô trồng",
    hint: "Đổi tên cây, nhóm cây và ảnh nhận diện",
    page: "garden",
    keywords: ["hồ sơ", "cây", "tên", "ảnh", "nhóm cây"],
  },
  {
    id: "garden-soil",
    label: "Loại đất",
    hint: "Chọn đất để nhận khuyến nghị tưới",
    page: "garden",
    keywords: ["đất", "soil", "phù sa"],
  },
  {
    id: "garden-notes",
    label: "Ghi chú canh tác",
    hint: "Ngày trồng, ngày thu hoạch, ghi chú",
    page: "garden",
    keywords: ["ghi chú", "ngày trồng", "thu hoạch"],
  },
  {
    id: "garden-save",
    label: "Lưu cấu hình vùng",
    hint: "Đồng bộ thay đổi xuống thiết bị",
    page: "garden",
    keywords: ["lưu", "cấu hình", "đồng bộ"],
  },
];

export type SearchZone = Pick<Zone, "id" | "name" | "crop" | "group">;

const ZONE_HINT: Record<SearchPageKey, string> = {
  overview: "Chuyển sang ô này để xem chi tiết",
  analysis: "Chuyển sang ô này để phân tích",
  history: "Chuyển sang ô này để xem biểu đồ",
  activity: "Lọc nhật ký theo ô này",
  garden: "Mở hồ sơ ô này",
};

export function zoneSearchItems(zones: SearchZone[], page: SearchPageKey): SearchItem[] {
  return zones.map((zone) => ({
    id: `zone-${zone.id}`,
    label: `${zone.id} · ${zone.name}`,
    hint: ZONE_HINT[page],
    page,
    keywords: [zone.id, zone.name, zone.crop, zone.group],
    zoneId: zone.id,
  }));
}

// Bỏ dấu để gõ "ca chua" vẫn tìm ra "Cà chua".
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function scoreItem(item: SearchItem, query: string): number {
  const q = normalizeText(query).trim();
  if (!q) return 0;

  const label = normalizeText(item.label);
  const keywords = item.keywords.map(normalizeText).join(" ");
  const hint = normalizeText(item.hint);

  if (label.startsWith(q)) return 4;
  if (label.includes(q)) return 3;
  if (keywords.includes(q)) return 2.5;
  if (hint.includes(q)) return 1.5;

  const tokens = q.split(/\s+/).filter(Boolean);
  const combined = `${label} ${keywords} ${hint}`;
  if (tokens.length > 1 && tokens.every((token) => combined.includes(token))) return 1;

  return 0;
}
