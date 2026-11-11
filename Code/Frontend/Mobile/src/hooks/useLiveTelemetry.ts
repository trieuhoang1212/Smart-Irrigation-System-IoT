
import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, DEVICE_ID } from "../api/config";
import type { Telemetry } from "../api/client";

type LiveMessage =
  | {
      type: "telemetry";
      data: Telemetry;
      online: boolean;
    }
  | {
      type: "device-status";
      deviceId: string;
      online: boolean;
    }
  | {
      type: "command-result";
      commandId: string;
      deviceId: string;
      status: "confirmed" | "timeout";
    };

type LiveTelemetryState = {
  telemetry: Telemetry | null;
  online: boolean;
  connected: boolean;
  error: string | null;
};

export function useLiveTelemetry() {
  const [state, setState] = useState<LiveTelemetryState>({
    telemetry: null,
    online: false,
    connected: false,
    error: null,
  });

  const socketRef = useRef<WebSocket | null>(null);

  const updateTelemetry = useCallback((telemetry: Telemetry) => {
    setState((previous) => ({
      ...previous,
      telemetry,
      error: null,
    }));
  }, []);

  useEffect(() => {
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | null = null;

    const wsUrl = API_URL.replace(/^http/, "ws") + "/realtime";

    function connect() {
      if (!active) return;

      try {
        socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (!active) return;

          setState((previous) => ({
            ...previous,
            connected: true,
            error: null,
          }));
        };

        socket.onmessage = (event) => {
          if (!active) return;

          try {
            const message = JSON.parse(event.data) as LiveMessage;

            if (message.type === "telemetry") {
              if (message.data.deviceId !== DEVICE_ID) return;

              setState((previous) => ({
                ...previous,
                telemetry: message.data,
                online: message.online,
                error: null,
              }));
            }

            if (
              message.type === "device-status" &&
              message.deviceId === DEVICE_ID
            ) {
              setState((previous) => ({
                ...previous,
                online: message.online,
              }));
            }

            if (
              message.type === "command-result" &&
              message.deviceId === DEVICE_ID
            ) {
              console.log(
                "Command result:",
                message.commandId,
                message.status
              );
            }
          } catch {
            console.warn("Không thể đọc dữ liệu WebSocket");
          }
        };

        socket.onerror = () => {
          if (!active) return;

          setState((previous) => ({
            ...previous,
            error: "Không thể kết nối WebSocket",
          }));
        };

        socket.onclose = () => {
          if (!active) return;

          setState((previous) => ({
            ...previous,
            connected: false,
          }));

          reconnectTimer = setTimeout(connect, 3000);
        };
      } catch {
        setState((previous) => ({
          ...previous,
          connected: false,
          error: "Không thể khởi tạo WebSocket",
        }));

        reconnectTimer = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      active = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (socket) {
        socket.onclose = null;
        socket.close();
      }

      socketRef.current = null;
    };
  }, []);

  return {
    telemetry: state.telemetry,
    online: state.online,
    connected: state.connected,
    error: state.error,
    updateTelemetry,
  };
}
