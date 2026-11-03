export type Zone = {
  id: string;
  name: string;
  crop: string;
  group: string;
  moisture: number;
  pump: boolean;
  threshold: number;
  stopThreshold: number;
  method: string;
  duration: number;
  pumpSeconds: number;
  flowLitersPerHour: number;
  targetLiters: number;
  wateredLiters: number;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  online: boolean;
};

// Cấu hình 6 khu vực cây trồng duy nhất của khu vườn
export const initialZones: Zone[] = [
  {
    id: "T001",
    name: "Rau muống",
    crop: "Chịu ẩm liên tục",
    group: "Vườn rau củ quả",
    threshold: 60,
    stopThreshold: 80,
    method: "Phun sương",
    duration: 3,
    pumpSeconds: 45,
    flowLitersPerHour: 48,
    targetLiters: 0.8,
    moisture: 68,
    pump: false,
    wateredLiters: 0,
    color: "#2ed573",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    online: false,
  },
  {
    id: "T002",
    name: "Cà chua",
    crop: "Tránh nứt quả (Cảm biến ESP32)",
    group: "Vườn rau củ quả",
    threshold: 45,
    stopThreshold: 65,
    method: "Tưới nhỏ giọt",
    duration: 6,
    pumpSeconds: 90,
    flowLitersPerHour: 60,
    targetLiters: 1.5,
    moisture: 52,
    pump: false,
    wateredLiters: 0,
    color: "#ff4757",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    online: false,
  },
  {
    id: "T003",
    name: "Cà rốt",
    crop: "Đất tơi xốp, không ngập",
    group: "Vườn rau củ quả",
    threshold: 35,
    stopThreshold: 55,
    method: "Tưới nhỏ giọt",
    duration: 8,
    pumpSeconds: 120,
    flowLitersPerHour: 60,
    targetLiters: 2.0,
    moisture: 42,
    pump: false,
    wateredLiters: 0,
    color: "#ffa502",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    online: false,
  },
  {
    id: "T004",
    name: "Khoai lang",
    crop: "Chịu hạn tốt",
    group: "Vườn rau củ quả",
    threshold: 30,
    stopThreshold: 50,
    method: "Tưới nhỏ giọt",
    duration: 8,
    pumpSeconds: 120,
    flowLitersPerHour: 60,
    targetLiters: 1.8,
    moisture: 38,
    pump: false,
    wateredLiters: 0,
    color: "#b77a4e",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    online: false,
  },
  {
    id: "T005",
    name: "Dưa leo",
    crop: "Cần nhiều nước khi ra hoa",
    group: "Vườn rau củ quả",
    threshold: 45,
    stopThreshold: 65,
    method: "Tưới nhỏ giọt",
    duration: 6,
    pumpSeconds: 90,
    flowLitersPerHour: 60,
    targetLiters: 1.5,
    moisture: 48,
    pump: false,
    wateredLiters: 0,
    color: "#1e90ff",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    online: false,
  },
  {
    id: "T006",
    name: "Rau xà lách",
    crop: "Nhạy cảm với khô hạn",
    group: "Vườn rau củ quả",
    threshold: 55,
    stopThreshold: 75,
    method: "Phun sương",
    duration: 4,
    pumpSeconds: 60,
    flowLitersPerHour: 48,
    targetLiters: 0.8,
    moisture: 62,
    pump: false,
    wateredLiters: 0,
    color: "#2bcbba",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    online: false,
  },
];

export const plantGroups = ["Tất cả khu vực"] as const;
