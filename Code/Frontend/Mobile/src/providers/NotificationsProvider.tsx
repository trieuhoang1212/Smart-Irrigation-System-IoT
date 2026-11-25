import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";

import { DEVICE_ID } from "../api/config";
import {
  getPushTokenSummary,
  registerPushToken,
  sendTestPush,
} from "../api/notifications";
import {
  fetchExpoPushToken,
  getProjectId,
  prepareNotifications,
  readPermission,
  requestPermission,
  sendLocalTestNotification,
  type PushPermission,
} from "../lib/notifications";

type ActionResult = { ok: boolean; message: string };

type NotificationsContextValue = {
  supported: boolean;
  permission: PushPermission;
  registeredCount: number | null;
  projectReady: boolean;
  busy: boolean;
  error: string | null;
  enable: () => Promise<ActionResult>;
  sendTest: () => Promise<ActionResult>;
  refresh: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function platformName(): "ios" | "android" {
  return Platform.OS === "ios" ? "ios" : "android";
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const supported = Platform.OS !== "web";
  const [permission, setPermission] = useState<PushPermission>(
    supported ? "undetermined" : "unsupported",
  );
  const [registeredCount, setRegisteredCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projectReady = getProjectId() !== null;

  const refresh = useCallback(async () => {
    try {
      const summary = await getPushTokenSummary(DEVICE_ID);
      setRegisteredCount(summary.count);
    } catch {
      // Backend tạm mất kết nối; giữ trạng thái cũ thay vì báo lỗi ồn ào.
    }
  }, []);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;

    void (async () => {
      try {
        await prepareNotifications();
        const current = await readPermission();
        if (cancelled) return;
        setPermission(current);

        // Đã cấp quyền từ lần trước: đăng ký lại token cho chắc sau khi cài lại app.
        if (current === "granted") {
          const result = await fetchExpoPushToken();
          if (!cancelled && result.token) {
            await registerPushToken(DEVICE_ID, result.token, platformName());
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không kiểm tra được quyền thông báo.");
        }
      }

      if (!cancelled) await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [supported, refresh]);

  const enable = useCallback(async (): Promise<ActionResult> => {
    if (!supported) {
      return {
        ok: false,
        message: "Thông báo chỉ hoạt động trên ứng dụng điện thoại.",
      };
    }

    setBusy(true);
    setError(null);
    try {
      const current = await requestPermission();
      setPermission(current);

      if (current !== "granted") {
        return {
          ok: false,
          message: "Bạn cần cho phép thông báo trong cài đặt của điện thoại",
        };
      }

      const result = await fetchExpoPushToken();
      if (!result.token) {
        return {
          ok: false,
          message:
            result.reason === "projectId"
              ? "Chưa có EAS projectId nên chưa nhận được thông báo từ xa. Thêm extra.eas.projectId vào app.json"
              : "Chưa lấy được mã thông báo. Hãy chạy bản dev build và kiểm tra kết nối mạng",
        };
      }

      await registerPushToken(DEVICE_ID, result.token, platformName());
      await refresh();
      return { ok: true, message: "Đã bật thông báo cho khu vườn" };
    } catch (err) {
      const message =
        err instanceof Error
          ? `Không bật được thông báo: ${err.message}`
          : "Không bật được thông báo.";
      setError(message);
      return { ok: false, message };
    } finally {
      setBusy(false);
    }
  }, [supported, refresh]);

  const sendTest = useCallback(async (): Promise<ActionResult> => {
    if (!supported) {
      return {
        ok: false,
        message: "Thông báo thử chỉ chạy trên ứng dụng điện thoại.",
      };
    }

    if (permission !== "granted") {
      return { ok: false, message: "Bật thông báo trước khi gửi thử." };
    }

    setBusy(true);
    setError(null);
    try {
      // Có máy đã đăng ký thì thử luôn đường máy chủ → Expo; chưa có thì báo cục bộ.
      if (registeredCount && registeredCount > 0) {
        const result = await sendTestPush(DEVICE_ID);
        return result.sent > 0
          ? { ok: true, message: `Đã gửi thử tới ${result.sent} máy.` }
          : {
              ok: false,
              message: "Máy chủ chưa gửi được. Mã thiết bị có thể đã cũ, hãy bật lại thông báo.",
            };
      }

      await sendLocalTestNotification(
        "Greenflow",
        "Thông báo thử: hệ thống tưới đã sẵn sàng.",
      );
      return { ok: true, message: "Đã gửi thông báo thử trên máy này." };
    } catch (err) {
      const message =
        err instanceof Error
          ? `Không gửi được thông báo thử: ${err.message}`
          : "Không gửi được thông báo thử.";
      setError(message);
      return { ok: false, message };
    } finally {
      setBusy(false);
    }
  }, [supported, permission, registeredCount]);

  return (
    <NotificationsContext.Provider
      value={{
        supported,
        permission,
        registeredCount,
        projectReady,
        busy,
        error,
        enable,
        sendTest,
        refresh,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationsProvider");
  return context;
}
