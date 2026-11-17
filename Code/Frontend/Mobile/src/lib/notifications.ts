import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const NOTIFICATION_CHANNEL_ID = "alerts";

export type PushPermission = "granted" | "denied" | "undetermined" | "unsupported";
export type PushTokenResult =
  | { token: string; reason?: undefined }
  | { token: null; reason: "unsupported" | "projectId" | "error" };

// Hiện banner cả khi app đang mở; thiếu handler thì thông báo bị nuốt.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Android 13+ cần kênh riêng thì thông báo mới hiện và rung đúng.
export async function prepareNotifications(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: "Cảnh báo vườn",
    // 4 = AndroidImportance.HIGH; dùng số để tránh lỗi lint với enum re-export.
    importance: 4,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2F6F4E",
  });
}

export function getProjectId(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;

  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof fromExtra === "string" && fromExtra.trim()) return fromExtra.trim();

  return Constants.easConfig?.projectId ?? null;
}

export async function readPermission(): Promise<PushPermission> {
  if (Platform.OS === "web") return "unsupported";

  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return "granted";
  return settings.canAskAgain ? "undetermined" : "denied";
}

export async function requestPermission(): Promise<PushPermission> {
  if (Platform.OS === "web") return "unsupported";

  const settings = await Notifications.requestPermissionsAsync();
  if (settings.granted) return "granted";
  return settings.canAskAgain ? "undetermined" : "denied";
}

// Token từ xa cần EAS projectId; Expo Go trên Android không lấy được token này.
export async function fetchExpoPushToken(): Promise<PushTokenResult> {
  if (Platform.OS === "web") return { token: null, reason: "unsupported" };

  const projectId = getProjectId();
  if (!projectId) return { token: null, reason: "projectId" };

  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: result.data };
  } catch (error) {
    console.error(
      "Không lấy được Expo push token:",
      error instanceof Error ? error.message : error,
    );
    return { token: null, reason: "error" };
  }
}

// Thông báo cục bộ chạy được cả trong Expo Go, dùng để kiểm tra quyền và kênh.
export async function sendLocalTestNotification(
  title: string,
  body: string,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      ...(Platform.OS === "android"
        ? { channelId: NOTIFICATION_CHANNEL_ID }
        : {}),
    },
    trigger: null,
  });
}
