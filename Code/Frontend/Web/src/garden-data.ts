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
  color: string;
  online: boolean;
};

export type GardenConfigResponse = {
  deviceId: string;
  zones: Array<Omit<Zone, "moisture" | "pump" | "online">>;
};

export function zonesFromConfig(config: GardenConfigResponse): Zone[] {
  return config.zones.map((zone) => ({
    ...zone,
    moisture: null,
    pump: false,
    online: false,
  }));
}
