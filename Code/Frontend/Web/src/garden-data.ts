export type Zone = {
  id: string;
  name: string;
  crop: string;
  group: string;
  moisture: number;
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

type PlantConfig = Omit<
  Zone,
  | "id"
  | "moisture"
  | "duration"
  | "wateredLiters"
  | "x"
  | "y"
  | "width"
  | "height"
  | "online"
>;

const plants: Array<[string, string, number, number, string, string, string, number, number, number]> = [
  ["Rau muống", "Rau ăn lá", 60, 80, "Chịu ẩm liên tục", "#74b85a", "Phun sương", 45, 48, 0.8],
  ["Cải xanh", "Rau ăn lá", 55, 75, "Đất ẩm đều", "#6cae55", "Phun sương", 60, 48, 0.8],
  ["Cải ngọt", "Rau ăn lá", 55, 75, "Đất ẩm đều", "#62a84e", "Phun sương", 60, 48, 0.8],
  ["Xà lách", "Rau ăn lá", 55, 75, "Nhạy với khô hạn", "#83bd64", "Phun sương", 60, 48, 0.8],
  ["Rau dền", "Rau ăn lá", 50, 70, "Lá dễ héo", "#96bd55", "Phun sương", 60, 48, 0.8],
  ["Húng quế", "Rau ăn lá", 50, 70, "Lá dễ héo", "#4d9d63", "Phun sương", 60, 48, 0.8],
  ["Cà chua", "Rau ăn quả", 45, 65, "Tránh nứt quả", "#e87c58", "Tưới nhỏ giọt", 90, 60, 1.5],
  ["Ớt", "Rau ăn quả", 40, 60, "Tránh úng rễ", "#e56d56", "Tưới nhỏ giọt", 90, 60, 1.2],
  ["Dưa leo", "Rau ăn quả", 45, 65, "Cần nước khi ra hoa", "#76ae55", "Tưới nhỏ giọt", 90, 60, 1.5],
  ["Cà tím", "Rau ăn quả", 40, 60, "Tránh úng rễ", "#76589b", "Tưới nhỏ giọt", 90, 60, 1.2],
  ["Đậu đũa", "Rau ăn quả", 40, 60, "Chịu khô vừa", "#6f9e4e", "Tưới nhỏ giọt", 90, 60, 1.2],
  ["Đậu cove", "Rau ăn quả", 40, 60, "Chịu khô vừa", "#5f9b58", "Tưới nhỏ giọt", 90, 60, 1.2],
  ["Cà rốt", "Cây củ, rễ", 35, 55, "Đất tơi, không ngập", "#e58b50", "Tưới nhỏ giọt", 120, 60, 2],
  ["Củ cải trắng", "Cây củ, rễ", 35, 55, "Tránh thối củ", "#d9d9c2", "Tưới nhỏ giọt", 120, 60, 2],
  ["Khoai lang", "Cây củ, rễ", 30, 50, "Chịu hạn tốt", "#b77a4e", "Tưới nhỏ giọt", 120, 60, 1.8],
  ["Gừng", "Cây củ, rễ", 35, 60, "Ẩm rễ, không đọng nước", "#c49352", "Tưới nhỏ giọt", 120, 60, 1.8],
  ["Nghệ", "Cây củ, rễ", 35, 60, "Ẩm rễ, không đọng nước", "#d4a84e", "Tưới nhỏ giọt", 120, 60, 1.8],
  ["Hành lá", "Cây củ, rễ", 35, 55, "Không quá ẩm", "#67a85a", "Tưới nhỏ giọt", 90, 48, 1],
  ["Xương rồng", "Cây cảnh / đặc biệt", 20, 35, "Để đất khô hẳn", "#8f79c7", "Tưới nhỏ giọt", 30, 30, 0.25],
  ["Sen đá", "Cây cảnh / đặc biệt", 20, 35, "Tưới rất ít", "#759fc0", "Tưới nhỏ giọt", 30, 30, 0.25],
  ["Dương xỉ", "Cây cảnh / đặc biệt", 50, 70, "Ẩm cao, thoáng khí", "#5c9dbe", "Phun sương", 45, 36, 0.6],
  ["Phong lan", "Cây cảnh / đặc biệt", 50, 70, "Ẩm cao, thoáng khí", "#8e79b4", "Phun sương", 45, 36, 0.6],
  ["Cây bonsai", "Cây cảnh / đặc biệt", 40, 60, "Tùy loại gỗ", "#6b8f62", "Tưới nhỏ giọt", 45, 36, 0.6],
];

export const plantGroups = ["Rau ăn lá", "Rau ăn quả", "Cây củ, rễ", "Cây cảnh / đặc biệt"] as const;

export const initialZones: Zone[] = plants.map((plant, index) => {
  const config: PlantConfig = {
    name: plant[0], group: plant[1], threshold: plant[2], stopThreshold: plant[3],
    crop: plant[4], color: plant[5], method: plant[6], pumpSeconds: plant[7],
    flowLitersPerHour: plant[8], targetLiters: plant[9],
  };
  return {
    ...config,
    id: `T${String(index + 1).padStart(3, "0")}`,
    moisture: Math.max(config.threshold + 8, config.stopThreshold - 5),
    duration: Math.ceil(config.pumpSeconds / 15),
    wateredLiters: 0,
    x: 0, y: 0, width: 0, height: 0,
    online: index === 1,
  };
});
