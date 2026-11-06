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
  ["T001", "Rau muong", "Chau am lien tuc", 60, 80, "Phun suong", 3, 45, 48, 0.8, "#2ed573"],
  ["T002", "Ca chua", "Tranh nut qua", 45, 65, "Tuoi nho giot", 6, 90, 60, 1.5, "#ff4757"],
  ["T003", "Ca rot", "Dat toi xop", 35, 55, "Tuoi nho giot", 8, 120, 60, 2, "#ffa502"],
  ["T004", "Khoai lang", "Chiu han tot", 30, 50, "Tuoi nho giot", 8, 120, 60, 1.8, "#b77a4e"],
  ["T005", "Dua leo", "Can nhieu nuoc", 45, 65, "Tuoi nho giot", 6, 90, 60, 1.5, "#1e90ff"],
  ["T006", "Rau xa lach", "Nhay cam voi kho han", 55, 75, "Phun suong", 4, 60, 48, 0.8, "#2bcbba"],
];

export const gardenConfig = {
  deviceId: "esp32-garden-01",
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
      group: "Vuon rau cu qua",
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
