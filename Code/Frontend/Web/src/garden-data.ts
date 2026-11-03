export type Zone = {
  id: string;
  name: string;
  crop: string;
  group: string;
  moisture: number | null;
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

export type GardenConfigResponse = {
  deviceId: string;
  zones: Array<Omit<Zone, "moisture" | "pump" | "wateredLiters" | "x" | "y" | "width" | "height" | "online">>;
};

export function zonesFromConfig(config: GardenConfigResponse): Zone[] {
  return config.zones.map((zone) => ({
    ...zone,
    moisture: null,
    pump: false,
    wateredLiters: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    online: false,
  }));
}
