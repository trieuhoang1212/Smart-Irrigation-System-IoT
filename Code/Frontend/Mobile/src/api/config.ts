const rawApiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export const API_URL = rawApiUrl.replace(/\/+$/, "");
export const WS_URL = `${API_URL.replace(/^http/, "ws")}/realtime`;
export const DEVICE_ID = "esp32-garden-01";
export const COMMAND_TIMEOUT_MS = 12_000;
