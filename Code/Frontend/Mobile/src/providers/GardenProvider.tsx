import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ApiError } from "../api/client";
import { sendCommand } from "../api/commands";
import { COMMAND_TIMEOUT_MS, DEVICE_ID, WS_URL } from "../api/config";
import { getGardenConfig, saveZoneConfig } from "../api/garden";
import { getHealth } from "../api/health";
import { getLatestTelemetry } from "../api/telemetry";
import type {
  GardenZone,
  LiveZone,
  Mode,
  RealtimeMessage,
  Telemetry,
  ZoneConfigInput,
} from "../api/types";
import { useToast } from "../providers/ToastProvider";
import { clamp, round1 } from "../utils/format";

type CommandRunner = (label: string, request: { action: string; zoneId?: string }) => Promise<void>;

type GardenContextValue = {
  deviceId: string;
  zones: LiveZone[];
  telemetry: Telemetry | null;
  mode: Mode;
  pump: boolean;
  weatherGate: boolean;
  servoAngle: number;
  deviceOnline: boolean;
  wsConnected: boolean;
  brokerConnected: boolean | null;
  lastTelemetryAt: number | null;
  pending: string | null;
  loading: boolean;
  configError: string | null;
  reloadConfig: () => void;
  setMode: (mode: Mode) => Promise<void>;
  toggleWeatherGate: () => Promise<void>;
  togglePump: () => Promise<void>;
  toggleZonePump: (zoneId: string) => Promise<void>;
  saveZone: (zoneId: string, input: ZoneConfigInput) => Promise<boolean>;
};

const GardenContext = createContext<GardenContextValue | null>(null);

function normalizeTelemetry(data: Telemetry): Telemetry {
  return {
    ...data,
    temperature: data.temperature === null ? null : round1(data.temperature),
    humidity: data.humidity === null ? null : round1(data.humidity),
    rain: round1(data.rain),
    servoAngle:
      typeof data.servoAngle === "number"
        ? clamp(Math.round(data.servoAngle), 0, 180)
        : data.pump
          ? 90
          : 0,
    zones: data.zones.map((zone) => ({ ...zone, moisture: round1(zone.moisture) })),
  };
}

export function GardenProvider({ children }: { children: React.ReactNode }) {
  const { notify } = useToast();
  const [deviceId, setDeviceId] = useState(DEVICE_ID);
  const [gardenZones, setGardenZones] = useState<GardenZone[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [deviceOnline, setDeviceOnline] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [brokerConnected, setBrokerConnected] = useState<boolean | null>(null);
  const [lastTelemetryAt, setLastTelemetryAt] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configToken, setConfigToken] = useState(0);

  const pendingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const applyTelemetry = useCallback((raw: Telemetry, online: boolean) => {
    setTelemetry(normalizeTelemetry(raw));
    setDeviceOnline(online);
    const received = Date.parse(raw.receivedAt);
    setLastTelemetryAt(Number.isNaN(received) ? Date.now() : received);
  }, []);

  const resolveCommand = useCallback(
    (commandId: string, status: "confirmed" | "timeout") => {
      const timer = pendingTimers.current.get(commandId);
      if (timer) clearTimeout(timer);
      pendingTimers.current.delete(commandId);
      setPending(null);
      notify(
        status === "timeout"
          ? "Thiết bị không phản hồi lệnh. Kiểm tra ESP32 và kết nối MQTT."
          : "Thiết bị đã xác nhận lệnh.",
        status === "timeout" ? "error" : "success",
      );
    },
    [notify],
  );

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setConfigError(null);

    getGardenConfig()
      .then((config) => {
        if (disposed) return;
        setDeviceId(config.deviceId);
        setGardenZones(config.zones);
      })
      .catch(() => {
        if (!disposed) setConfigError("Không tải được cấu hình khu vườn từ Backend.");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [configToken]);

  useEffect(() => {
    let disposed = false;

    getLatestTelemetry(deviceId)
      .then((latest) => {
        if (!disposed && latest) applyTelemetry(latest, false);
      })
      .catch(() => {
        if (!disposed) setDeviceOnline(false);
      });

    return () => {
      disposed = true;
    };
  }, [deviceId, applyTelemetry]);

  useEffect(() => {
    let disposed = false;

    const check = () => {
      getHealth()
        .then((health) => {
          if (!disposed) setBrokerConnected(health.mqtt);
        })
        .catch(() => {
          if (!disposed) setBrokerConnected(false);
        });
    };

    check();
    const timer = setInterval(check, 10_000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let hadConnection = false;

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        if (disposed) return;
        hadConnection = true;
        attempts = 0;
        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as RealtimeMessage;
          if (message.type === "telemetry") {
            applyTelemetry(message.data, message.online);
          } else if (message.type === "device-status") {
            setDeviceOnline(message.online);
          } else if (message.type === "command-result") {
            resolveCommand(message.commandId, message.status);
          }
        } catch {
          // Bỏ qua frame hỏng để không làm rơi kết nối.
        }
      };

      socket.onclose = () => {
        if (disposed) return;
        setWsConnected(false);
        if (hadConnection) {
          notify("Mất kết nối realtime. Đang thử lại...", "error");
        }
        const delay = Math.min(15_000, 1000 * 2 ** attempts);
        attempts += 1;
        retryTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [applyTelemetry, notify, resolveCommand]);

  useEffect(() => {
    const timers = pendingTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const runCommand: CommandRunner = useCallback(
    async (label, request) => {
      if (pending) return;
      setPending(label);

      try {
        const response = await sendCommand(deviceId, request);
        if (!response.commandId) {
          setPending(null);
          return;
        }

        const commandId = response.commandId;
        const timer = setTimeout(() => {
          pendingTimers.current.delete(commandId);
          setPending(null);
          notify("Thiết bị không phản hồi lệnh. Kiểm tra ESP32 và kết nối MQTT.", "error");
        }, COMMAND_TIMEOUT_MS + 1000);
        pendingTimers.current.set(commandId, timer);
      } catch (error) {
        setPending(null);
        const message =
          error instanceof ApiError && error.status === 409
            ? "Cần chuyển sang chế độ thủ công trước khi bật bơm tổng."
            : "Không gửi được lệnh. Kiểm tra Backend và MQTT.";
        notify(message, "error");
      }
    },
    [deviceId, notify, pending],
  );

  const mode = telemetry?.mode ?? "auto";
  const pump = telemetry?.pump ?? false;
  const weatherGate = telemetry?.weatherGate ?? true;
  const servoAngle = telemetry?.servoAngle ?? 0;

  const zones = useMemo<LiveZone[]>(
    () =>
      gardenZones.map((zone) => {
        const live = telemetry?.zones.find((state) => state.id === zone.id);
        return {
          ...zone,
          threshold: live?.threshold ?? zone.threshold,
          stopThreshold: live?.stopThreshold ?? zone.stopThreshold,
          moisture: live?.moisture ?? null,
          pump: live?.pump ?? false,
          online: deviceOnline,
        };
      }),
    [gardenZones, telemetry, deviceOnline],
  );

  const setMode = useCallback(
    (nextMode: Mode) =>
      runCommand(nextMode === "auto" ? "Đang chuyển sang tự động..." : "Đang chuyển sang thủ công...", {
        action: nextMode === "auto" ? "MODE_AUTO" : "MODE_MANUAL",
      }),
    [runCommand],
  );

  const toggleWeatherGate = useCallback(() => {
    return runCommand(weatherGate ? "Đang tắt chặn mưa..." : "Đang bật chặn mưa...", {
      action: weatherGate ? "WEATHER_GATE_OFF" : "WEATHER_GATE_ON",
    });
  }, [runCommand, weatherGate]);

  const togglePump = useCallback(() => {
    if (mode !== "manual") {
      notify("Cần chuyển sang chế độ thủ công trước khi bật bơm tổng.", "error");
      return Promise.resolve();
    }
    return runCommand(pump ? "Đang tắt bơm tổng..." : "Đang bật bơm tổng...", {
      action: pump ? "PUMP_OFF" : "PUMP_ON",
    });
  }, [mode, notify, pump, runCommand]);

  const toggleZonePump = useCallback(
    (zoneId: string) => {
      const zone = zones.find((item) => item.id === zoneId);
      return runCommand(zone?.pump ? `Đang tắt bơm ${zoneId}...` : `Đang bật bơm ${zoneId}...`, {
        action: zone?.pump ? "PUMP_OFF" : "PUMP_ON",
        zoneId,
      });
    },
    [runCommand, zones],
  );

  const saveZone = useCallback(
    async (zoneId: string, input: ZoneConfigInput) => {
      try {
        await saveZoneConfig(deviceId, zoneId, input);
        notify("Đã lưu cấu hình tưới cho khu vực.", "success");
        setConfigToken((token) => token + 1);
        return true;
      } catch {
        notify("Không lưu được cấu hình. Kiểm tra Backend rồi thử lại.", "error");
        return false;
      }
    },
    [deviceId, notify],
  );

  const value = useMemo<GardenContextValue>(
    () => ({
      deviceId,
      zones,
      telemetry,
      mode,
      pump,
      weatherGate,
      servoAngle,
      deviceOnline,
      wsConnected,
      brokerConnected,
      lastTelemetryAt,
      pending,
      loading,
      configError,
      reloadConfig: () => setConfigToken((token) => token + 1),
      setMode,
      toggleWeatherGate,
      togglePump,
      toggleZonePump,
      saveZone,
    }),
    [
      deviceId,
      zones,
      telemetry,
      mode,
      pump,
      weatherGate,
      servoAngle,
      deviceOnline,
      wsConnected,
      brokerConnected,
      lastTelemetryAt,
      pending,
      loading,
      configError,
      setMode,
      toggleWeatherGate,
      togglePump,
      toggleZonePump,
      saveZone,
    ],
  );

  return <GardenContext.Provider value={value}>{children}</GardenContext.Provider>;
}

export function useGarden(): GardenContextValue {
  const context = useContext(GardenContext);
  if (!context) throw new Error("useGarden must be used inside GardenProvider");
  return context;
}
