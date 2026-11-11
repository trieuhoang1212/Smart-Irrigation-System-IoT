import { config } from "./config.js";

type ZoneConfigTuple = [
  id: string,
  name: string,
  crop: string,
  threshold: number,
  stopThreshold: number,
  method: string,
  duration: number,
  pumpSeconds: number,
  flowLitersPerHour: number,
  targetLiters: number,
  color: string,
];

const zoneRows: ZoneConfigTuple[] = [
  ["T001", "Rau muống", "Chậu ẩm liên tục", 60, 80, "Phun sương", 3, 45, 48, 0.8, "#5f9370"],
  ["T002", "Cà chua", "Tránh nứt quả", 45, 65, "Tưới nhỏ giọt", 6, 90, 60, 1.5, "#b8685c"],
  ["T003", "Cà rốt", "Đất tơi xốp", 35, 55, "Tưới nhỏ giọt", 8, 120, 60, 2, "#c1953f"],
  ["T004", "Khoai lang", "Chịu hạn tốt", 30, 50, "Tưới nhỏ giọt", 8, 120, 60, 1.8, "#9c7452"],
  ["T005", "Dưa leo", "Cần nhiều nước", 45, 65, "Tưới nhỏ giọt", 6, 90, 60, 1.5, "#5f8ea8"],
  ["T006", "Rau xà lách", "Nhạy cảm với khô hạn", 55, 75, "Phun sương", 4, 60, 48, 0.8, "#78a68c"],
];

export const gardenConfig = {
  deviceId: config.deviceId,
  zones: zoneRows.map(
    ([
      id,
      name,
      crop,
      threshold,
      stopThreshold,
      method,
      duration,
      pumpSeconds,
      flowLitersPerHour,
      targetLiters,
      color,
    ]) => ({
      id,
      name,
      crop,
      group: "Vườn rau củ quả",
      threshold,
      stopThreshold,
      method,
      duration,
      pumpSeconds,
      flowLitersPerHour,
      targetLiters,
      color,
    }),
  ),
};
