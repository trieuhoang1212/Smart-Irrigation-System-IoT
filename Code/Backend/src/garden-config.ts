import { config } from "./config.js";

export type ZoneConfigSeed = {
  id: string;
  name: string;
  crop: string;
  group: string;
  threshold: number;
  stopThreshold: number;
  method: string;
  flowLitersPerHour: number;
  targetLiters: number;
  color: string;
};

const zones: ZoneConfigSeed[] = [
  {
    id: "T001",
    name: "Rau muống",
    crop: "Chậu ẩm liên tục",
    group: "Rau ăn lá",
    threshold: 60,
    stopThreshold: 80,
    method: "Phun sương",
    flowLitersPerHour: 48,
    targetLiters: 0.8,
    color: "#5f9370",
  },
  {
    id: "T002",
    name: "Cà chua",
    crop: "Tránh nứt quả",
    group: "Rau ăn quả",
    threshold: 45,
    stopThreshold: 65,
    method: "Tưới nhỏ giọt",
    flowLitersPerHour: 60,
    targetLiters: 1.5,
    color: "#b8685c",
  },
  {
    id: "T003",
    name: "Cà rốt",
    crop: "Đất tơi xốp",
    group: "Cây lấy củ",
    threshold: 35,
    stopThreshold: 55,
    method: "Tưới nhỏ giọt",
    flowLitersPerHour: 60,
    targetLiters: 2,
    color: "#c1953f",
  },
  {
    id: "T004",
    name: "Khoai lang",
    crop: "Chịu hạn tốt",
    group: "Cây lấy củ",
    threshold: 30,
    stopThreshold: 50,
    method: "Tưới nhỏ giọt",
    flowLitersPerHour: 60,
    targetLiters: 1.8,
    color: "#9c7452",
  },
  {
    id: "T005",
    name: "Dưa leo",
    crop: "Cần nhiều nước",
    group: "Rau ăn quả",
    threshold: 45,
    stopThreshold: 65,
    method: "Tưới nhỏ giọt",
    flowLitersPerHour: 60,
    targetLiters: 1.5,
    color: "#5f8ea8",
  },
  {
    id: "T006",
    name: "Rau xà lách",
    crop: "Nhạy cảm với khô hạn",
    group: "Rau ăn lá",
    threshold: 55,
    stopThreshold: 75,
    method: "Phun sương",
    flowLitersPerHour: 48,
    targetLiters: 0.8,
    color: "#78a68c",
  },
];

export const gardenConfig = {
  deviceId: config.deviceId,
  zones,
};
