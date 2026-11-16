import Constants from "expo-constants";
import { Platform } from "react-native";

const API_PORT = 3001;

function resolveApiUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (override) return override.replace(/\/+$/, "");

  // Web: backend nằm cùng máy với trang đang mở, chỉ khác cổng.
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }

  // Expo Go/dev client: hostUri có dạng "192.168.1.5:8081".
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host ?? "localhost"}:${API_PORT}`;
}

export const API_URL = resolveApiUrl();
export const WS_URL = `${API_URL.replace(/^http/, "ws")}/realtime`;
export const DEVICE_ID = "esp32-garden-01";
export const COMMAND_TIMEOUT_MS = 12_000;
