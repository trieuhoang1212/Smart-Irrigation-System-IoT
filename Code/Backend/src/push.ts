import Expo, {
  type ExpoPushMessage,
  type ExpoPushTicket,
} from "expo-server-sdk";
import { config } from "./config.js";
import { deletePushTokens, listPushTokens } from "./push-repository.js";

const expo = new Expo(
  config.expoAccessToken ? { accessToken: config.expoAccessToken } : undefined,
);

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type PushResult = {
  targeted: number;
  sent: number;
  invalid: string[];
};

export function isExpoPushToken(token: unknown): token is string {
  return Expo.isExpoPushToken(token);
}

// Gửi cho mọi máy đã đăng ký của thiết bị; lỗi mạng chỉ ghi log, không chặn telemetry.
export async function sendPushToDevice(
  deviceId: string,
  payload: PushPayload,
): Promise<PushResult> {
  const records = await listPushTokens(deviceId);
  if (records.length === 0) return { targeted: 0, sent: 0, invalid: [] };

  const messages: ExpoPushMessage[] = records.map((record) => ({
    to: record.token,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data,
    // Phải trùng tên kênh Android đã tạo trong app, nếu không thông báo bị bỏ qua.
    channelId: "alerts",
  }));

  const invalid: string[] = [];
  let sent = 0;

  for (const chunk of expo.chunkPushNotifications(messages)) {
    let tickets: ExpoPushTicket[];
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error(
        "Expo push request failed:",
        error instanceof Error ? error.message : error,
      );
      continue;
    }

    tickets.forEach((ticket, index) => {
      if (ticket.status === "ok") {
        sent += 1;
        return;
      }

      const token = chunk[index]?.to;
      if (
        ticket.details?.error === "DeviceNotRegistered" &&
        typeof token === "string"
      ) {
        invalid.push(token);
        return;
      }

      console.error(
        `Expo push rejected (${ticket.details?.error ?? "unknown"}): ${ticket.message}`,
      );
    });
  }

  if (invalid.length > 0) await deletePushTokens(invalid);
  return { targeted: records.length, sent, invalid };
}
