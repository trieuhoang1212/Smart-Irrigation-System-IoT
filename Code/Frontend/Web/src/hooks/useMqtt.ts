"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { type GardenConfigResponse, type SoilType, type Zone, zonesFromConfig } from "../garden-data";
import type { ToastTone } from "../notifications";

type BackendTelemetry = {
  deviceId?: string;
  receivedAt?: string;
  mode?: "auto" | "manual";
  temperature?: number | null;
  humidity?: number | null;
  rain?: number | null;
  raining?: boolean;
  rainWarning?: boolean;
  weatherGate?: boolean;
  pump?: boolean;
  servoAngle?: number;
  tank?: {
    distanceCm?: number | null;
    empty?: boolean;
  };
  zones?: Array<{
    id?: string;
    moisture?: number;
    threshold?: number;
    stopThreshold?: number;
    pump?: boolean;
    over?: boolean;
  }>;
};

export type ZoneConfigInput = {
  threshold?: number;
  pumpSeconds: number;
  flowLitersPerHour: number;
  targetLiters: number;
};

export interface UseMqttOptions {
  backendUrl: string;
  onLog?: (msg: string) => void;
  onNotify?: (message: string, tone: ToastTone) => void;
}

const MAX_RECONNECT_DELAY = 15000;
const OPTIMISTIC_WINDOW_MS = 3000;
const THRESHOLD_PENDING_MS = 5000;
const THRESHOLD_DEBOUNCE_MS = 400;

export function useMqtt({ backendUrl, onLog, onNotify }: UseMqttOptions) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [soil, setSoil] = useState<SoilType>("Đất phù sa");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [pumpOn, setPumpOn] = useState(false);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [rainPercent, setRainPercent] = useState<number | null>(null);
  const [raining, setRaining] = useState(false);
  const [rainBlock, setRainBlock] = useState(true);
  const [deviceOnline, setDeviceOnline] = useState(false);
  const [servoAngle, setServoAngle] = useState<number | null>(null);
  const [tankDistanceCm, setTankDistanceCm] = useState<number | null>(null);
  const [tankEmpty, setTankEmpty] = useState(false);
  const [brokerConnected, setBrokerConnected] = useState<boolean | null>(null);
  const [commandVersion, setCommandVersion] = useState(0);
  const [lastUpdated, setLastUpdated] = useState("chưa có dữ liệu");
  const [lastTelemetryAt, setLastTelemetryAt] = useState<number | null>(null);
  const [reconnectToken, setReconnectToken] = useState(0);
  const [configRetryToken, setConfigRetryToken] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const pumpByZoneRef = useRef<Record<string, boolean>>({});
  const pendingRef = useRef<{ mode?: number; weatherGate?: number }>({});
  const pendingThresholdRef = useRef<Record<string, number>>({});
  const thresholdTimerRef = useRef<Record<string, number>>({});
  const hadDisconnectRef = useRef(false);
  const tankEmptyRef = useRef<boolean | null>(null);
  const overTargetRef = useRef<Record<string, boolean>>({});
  const rainWarnRef = useRef(false);
  const rainFullRef = useRef(false);
  const notifyRef = useRef(onNotify);

  useEffect(() => {
    notifyRef.current = onNotify;
  }, [onNotify]);

  const log = useCallback((message: string) => {
    if (onLog) onLog(message);
    else console.info(`[Greenflow] ${message}`);
  }, [onLog]);

  const notify = useCallback((message: string, tone: ToastTone) => {
    notifyRef.current?.(message, tone);
  }, []);

  // WS chỉ là kênh Web–Backend; trạng thái MQTT thật lấy từ /api/health.
  useEffect(() => {
    let disposed = false;
    const base = backendUrl.replace(/\/+$/, "");
    const check = () => {
      fetch(`${base}/api/health`)
        .then((response) => response.json())
        .then((health: { mqtt?: boolean }) => {
          if (!disposed) setBrokerConnected(Boolean(health.mqtt));
        })
        .catch(() => {
          if (!disposed) setBrokerConnected(false);
        });
    };
    check();
    const timer = window.setInterval(check, 10000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [backendUrl, reconnectToken]);

  useEffect(() => {
    let disposed = false;
    fetch(`${backendUrl.replace(/\/+$/, "")}/api/config`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Config request failed (${response.status})`);
        return (await response.json()) as GardenConfigResponse;
      })
      .then((config) => {
        if (disposed || !config.deviceId || !Array.isArray(config.zones)) {
          if (!disposed) setConfigError("Backend trả về cấu hình không hợp lệ.");
          return;
        }
        setDeviceId(config.deviceId);
        setSoil(config.soil ?? "Đất phù sa");
        setZones(zonesFromConfig(config));
      })
      .catch(() => {
        if (!disposed) setConfigError("Không thể tải cấu hình khu vườn từ Backend.");
      })
      .finally(() => {
        if (!disposed) setConfigLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [backendUrl, configRetryToken]);

  const applyTelemetry = useCallback((data: BackendTelemetry, isOnline: boolean) => {
    const hasZoneList = Array.isArray(data.zones);
    const now = Date.now();
    const round1 = (value: number) => Math.round(value * 10) / 10;

    setDeviceOnline(isOnline);

    setZones((current) =>
      current.map((zone) => {
        const live = hasZoneList
          ? data.zones?.find((item) => item.id === zone.id)
          : undefined;
        if (!live) return hasZoneList ? { ...zone, online: false } : zone;

        const isThresholdPending = now <= (pendingThresholdRef.current[zone.id] ?? 0);

        return {
          ...zone,
          moisture: typeof live.moisture === "number" && Number.isFinite(live.moisture)
            ? round1(Math.max(0, Math.min(100, live.moisture)))
            : zone.moisture,
          pump: isOnline ? Boolean(live.pump) : false,
          overTarget: isOnline && Boolean(live.over),
          threshold: isThresholdPending
            ? zone.threshold
            : typeof live.threshold === "number" && Number.isFinite(live.threshold)
              ? Math.max(0, Math.min(100, live.threshold))
              : zone.threshold,
          stopThreshold: isThresholdPending
            ? zone.stopThreshold
            : typeof live.stopThreshold === "number" && Number.isFinite(live.stopThreshold)
              ? Math.max(0, Math.min(100, live.stopThreshold))
              : zone.stopThreshold,
          online: isOnline,
        };
      }),
    );

    data.zones?.forEach((item) => {
      if (item.id && item.pump !== undefined) {
        pumpByZoneRef.current[item.id] = isOnline ? Boolean(item.pump) : false;
      }
    });

    if (isOnline) {
      data.zones?.forEach((item) => {
        if (!item.id) return;
        const overTarget = Boolean(item.over);
        if (overTarget && !overTargetRef.current[item.id]) {
          notify(
            `${item.id} đã vượt mục tiêu nước — tắt bơm nếu đã đủ ẩm.`,
            "error",
          );
        }
        overTargetRef.current[item.id] = overTarget;
      });
    }

    // DHT22 đọc lỗi sẽ gửi null: xoá giá trị cũ thay vì hiển thị số liệu sai.
    setTemperature(typeof data.temperature === "number" && Number.isFinite(data.temperature)
      ? round1(data.temperature)
      : null);
    setHumidity(typeof data.humidity === "number" && Number.isFinite(data.humidity)
      ? round1(Math.max(0, Math.min(100, data.humidity)))
      : null);
    const nextRain = typeof data.rain === "number" && Number.isFinite(data.rain)
      ? round1(Math.max(0, Math.min(100, data.rain)))
      : null;
    setRainPercent(nextRain);
    if (data.raining !== undefined) setRaining(data.raining);

    // Cảnh báo mưa theo mốc 80% (có thể mưa) và 100% (đã mưa).
    const rainingNow = Boolean(data.raining);
    const rainWarnNow = !rainingNow && nextRain !== null && nextRain >= 80;
    if (isOnline && rainingNow && !rainFullRef.current) {
      notify(
        data.weatherGate === false
          ? "Cảm biến mưa 100% — đã mưa, nhưng chế độ hoãn mưa đang tắt."
          : "Cảm biến mưa 100% — đã mưa, bơm tự động dừng vì đang bật hoãn mưa.",
        "error",
      );
    } else if (isOnline && rainWarnNow && !rainWarnRef.current) {
      notify(
        `Cảm biến mưa ${nextRain}% — trời có thể mưa, theo dõi thêm.`,
        "info",
      );
    }
    rainWarnRef.current = rainWarnNow;
    rainFullRef.current = rainingNow;
    if (data.pump !== undefined) setPumpOn(isOnline ? Boolean(data.pump) : false);

    const distance = data.tank?.distanceCm;
    setTankDistanceCm(
      isOnline && typeof distance === "number" && Number.isFinite(distance)
        ? round1(distance)
        : null,
    );
    const empty = isOnline ? Boolean(data.tank?.empty) : false;
    setTankEmpty(empty);

    const previousEmpty = tankEmptyRef.current;
    tankEmptyRef.current = isOnline ? empty : null;
    if (isOnline && previousEmpty !== empty) {
      if (empty) {
        notify("Bồn nước đã cạn — bơm bị chặn để tránh chạy khô.", "error");
      } else if (previousEmpty === true) {
        notify("Bồn nước đã có lại, bơm có thể chạy.", "success");
      }
    }

    // Payload cũ chưa có servoAngle: suy ra từ trạng thái bơm tổng.
    if (isOnline) {
      setServoAngle(typeof data.servoAngle === "number" && Number.isFinite(data.servoAngle)
        ? Math.max(0, Math.min(180, Math.round(data.servoAngle)))
        : data.pump !== undefined
          ? (data.pump ? 90 : 0)
          : null);
    } else {
      setServoAngle(null);
    }

    if (data.mode && now > (pendingRef.current.mode ?? 0)) setMode(data.mode);
    if (data.weatherGate !== undefined && now > (pendingRef.current.weatherGate ?? 0)) {
      setRainBlock(data.weatherGate);
    }

    // Snapshot offline vẫn phải hiển thị đúng giờ đo cuối, không phải giờ mở Web.
    const receivedAt = typeof data.receivedAt === "string" ? Date.parse(data.receivedAt) : Number.NaN;
    const measuredAt = Number.isFinite(receivedAt) ? receivedAt : isOnline ? now : null;
    if (measuredAt !== null) {
      setLastTelemetryAt(measuredAt);
      setLastUpdated(new Date(measuredAt).toLocaleTimeString("vi-VN", { hour12: false }));
    }
  }, [notify]);

  useEffect(() => {
    if (!deviceId) return;
    const base = backendUrl.replace(/\/+$/, "");
    const socketUrl = `${base.replace(/^http/, "ws")}/realtime`;
    let disposed = false;
    let attempt = 0;
    let retryTimer: number | undefined;

    const connect = () => {
      if (disposed) return;

      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        attempt = 0;
        setConnected(true);
        log("Web đã kết nối Backend realtime.");
        if (hadDisconnectRef.current) {
          hadDisconnectRef.current = false;
          notify("Đã kết nối lại Backend realtime.", "success");
        }
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as {
            type?: string;
            data?: BackendTelemetry;
            online?: boolean;
            status?: "confirmed" | "timeout";
          };
          if (message.type === "telemetry" && message.data) {
            applyTelemetry(message.data, message.online !== false);
          } else if (message.type === "device-status" && message.online !== undefined) {
            setDeviceOnline(message.online);
            if (!message.online) {
              setZones((current) =>
                current.map((zone) => ({ ...zone, online: false, pump: false })),
              );
              setPumpOn(false);
              setTankDistanceCm(null);
              setTankEmpty(false);
              tankEmptyRef.current = null;
            }
          } else if (message.type === "command-result") {
            setCommandVersion((current) => current + 1);
            if (message.status === "confirmed") {
              log("Thiết bị đã xác nhận lệnh.");
            } else {
              log("Thiết bị chưa xác nhận lệnh trước thời hạn.");
              notify("Thiết bị không phản hồi lệnh. Kiểm tra ESP32 và kết nối MQTT.", "error");
            }
          }
        } catch {
          log("Backend gửi dữ liệu realtime không hợp lệ.");
        }
      };

      socket.onerror = () => {
        if (disposed) return;
        log("Không thể kết nối Backend realtime.");
      };

      socket.onclose = () => {
        if (disposed) return;
        setConnected(false);
        setDeviceOnline(false);
        setServoAngle(null);
        setTankDistanceCm(null);
        setTankEmpty(false);
        tankEmptyRef.current = null;
        setZones((current) => current.map((zone) => ({ ...zone, online: false })));

        attempt += 1;
        const delay = Math.min(1000 * 2 ** (attempt - 1), MAX_RECONNECT_DELAY);
        log(`Mất kết nối Backend, thử lại sau ${Math.round(delay / 1000)}s...`);
        if (!hadDisconnectRef.current) {
          hadDisconnectRef.current = true;
          notify("Mất kết nối Backend realtime. Đang thử lại...", "error");
        }
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [backendUrl, applyTelemetry, deviceId, log, notify, reconnectToken]);

  const sendCommand = useCallback(
    (cmd: string) => {
      const pumpMatch = cmd.match(/^(PUMP_ON|PUMP_OFF)_(T00[1-6])$/);
      const thresholdMatch = cmd.match(/^SET_THRESHOLD_(T00[1-6])_(\d{1,3})$/);
      const body = pumpMatch
        ? { action: pumpMatch[1], zoneId: pumpMatch[2] }
        : thresholdMatch
          ? { action: "SET_THRESHOLD", zoneId: thresholdMatch[1], value: Number(thresholdMatch[2]) }
          : { action: cmd };

      if (!deviceId) {
        log(`Chưa thể gửi lệnh ${cmd} khi chưa tải cấu hình.`);
        notify("Chưa tải được cấu hình thiết bị, chưa gửi được lệnh.", "error");
        return Promise.resolve(false);
      }
      return fetch(`${backendUrl.replace(/\/+$/, "")}/api/devices/${encodeURIComponent(deviceId)}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(async (response) => {
          setCommandVersion((current) => current + 1);
          if (!response.ok) {
            log(`Backend từ chối lệnh ${cmd}.`);
            notify(`Backend từ chối lệnh ${cmd}.`, "error");
            return false;
          }
          const result = (await response.json()) as { commandId?: string };
          log(`Đã nhận acknowledgement cho lệnh ${cmd}${result.commandId ? ` (${result.commandId})` : ""}.`);
          return true;
        })
        .catch(() => {
          setCommandVersion((current) => current + 1);
          log(`Không gửi được lệnh ${cmd} tới Backend.`);
          notify("Không gửi được lệnh tới Backend. Kiểm tra kết nối mạng.", "error");
          return false;
        });
    },
    [backendUrl, deviceId, log, notify],
  );

  const togglePump = useCallback(
    (zoneId?: string) => {
      const current = zoneId ? pumpByZoneRef.current[zoneId] ?? false : pumpOn;
      const nextState = !current;

      if (zoneId) {
        pumpByZoneRef.current[zoneId] = nextState;
        setPumpOn(Object.values(pumpByZoneRef.current).some(Boolean));
      } else {
        setPumpOn(nextState);
      }

      void sendCommand(`${nextState ? "PUMP_ON" : "PUMP_OFF"}${zoneId ? `_${zoneId}` : ""}`);
      return nextState;
    },
    [pumpOn, sendCommand],
  );

  const changeMode = useCallback(
    (newMode: "auto" | "manual") => {
      const previous = mode;
      setMode(newMode);
      pendingRef.current.mode = Date.now() + OPTIMISTIC_WINDOW_MS;
      return sendCommand(newMode === "auto" ? "MODE_AUTO" : "MODE_MANUAL").then(
        (accepted) => {
          // Lệnh bị từ chối thì trả UI về đúng chế độ đang chạy trên thiết bị.
          if (!accepted) setMode(previous);
          return accepted;
        },
      );
    },
    [mode, sendCommand],
  );

  const toggleWeatherGate = useCallback(
    (enabled: boolean) => {
      setRainBlock(enabled);
      pendingRef.current.weatherGate = Date.now() + OPTIMISTIC_WINDOW_MS;
      return sendCommand(enabled ? "WEATHER_GATE_ON" : "WEATHER_GATE_OFF");
    },
    [sendCommand],
  );

  const reconnect = useCallback(() => {
    setConfigLoading(true);
    setConfigError(null);
    setConfigRetryToken((current) => current + 1);
    setReconnectToken((current) => current + 1);
    log("Đang yêu cầu kết nối lại Backend...");
  }, [log]);

  const setZoneThreshold = useCallback(
    (zoneId: string, value: number) => {
      const clamped = Math.max(10, Math.min(90, Math.round(value)));
      pendingThresholdRef.current[zoneId] = Date.now() + THRESHOLD_PENDING_MS;
      setZones((current) =>
        current.map((zone) =>
          zone.id === zoneId
            ? {
                ...zone,
                threshold: clamped,
                stopThreshold: Math.min(100, clamped + 20),
              }
            : zone,
        ),
      );

      // Kéo slider sinh rất nhiều lệnh: chỉ gửi giá trị cuối sau khi ngừng kéo.
      window.clearTimeout(thresholdTimerRef.current[zoneId]);
      thresholdTimerRef.current[zoneId] = window.setTimeout(() => {
        delete thresholdTimerRef.current[zoneId];
        void sendCommand(`SET_THRESHOLD_${zoneId}_${clamped}`);
      }, THRESHOLD_DEBOUNCE_MS);
    },
    [sendCommand],
  );

  const saveZoneConfig = useCallback(
    async (zoneId: string, input: ZoneConfigInput) => {
      if (!deviceId) {
        notify("Chưa tải được cấu hình thiết bị, chưa lưu được.", "error");
        return false;
      }

      const threshold = input.threshold === undefined
        ? undefined
        : Math.max(10, Math.min(90, Math.round(input.threshold)));
      if (threshold !== undefined) {
        pendingThresholdRef.current[zoneId] = Date.now() + THRESHOLD_PENDING_MS;
      }
      setZones((current) =>
        current.map((zone) =>
          zone.id === zoneId
            ? {
                ...zone,
                threshold: threshold ?? zone.threshold,
                stopThreshold:
                  threshold === undefined
                    ? zone.stopThreshold
                    : Math.min(100, threshold + 20),
                pumpSeconds: input.pumpSeconds,
                flowLitersPerHour: input.flowLitersPerHour,
                targetLiters: input.targetLiters,
              }
            : zone,
        ),
      );

      try {
        const response = await fetch(
          `${backendUrl.replace(/\/+$/, "")}/api/devices/${encodeURIComponent(deviceId)}/config/zones/${zoneId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
        );
        setCommandVersion((current) => current + 1);
        if (!response.ok) {
          notify(`Backend từ chối cấu hình vùng ${zoneId}.`, "error");
          return false;
        }
        const saved = (await response.json()) as {
          appliedRemotely?: boolean;
          targetSynced?: boolean;
        };
        notify(
          saved.appliedRemotely && saved.targetSynced
            ? `Đã lưu cấu hình ${zoneId} và gửi ngưỡng, mục tiêu nước tới thiết bị.`
            : saved.appliedRemotely
              ? `Đã lưu cấu hình ${zoneId} và gửi ngưỡng mới tới thiết bị.`
              : saved.targetSynced
                ? `Đã lưu cấu hình ${zoneId} và gửi mục tiêu nước tới thiết bị.`
                : `Đã lưu cấu hình ${zoneId}.`,
          "success",
        );
        log(`Đã lưu cấu hình vùng ${zoneId}.`);
        return true;
      } catch {
        setCommandVersion((current) => current + 1);
        notify("Không gửi được cấu hình vùng tới Backend.", "error");
        return false;
      }
    },
    [backendUrl, deviceId, log, notify],
  );

  useEffect(() => {
    const timers = thresholdTimerRef.current;
    return () => {
      Object.values(timers).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return {
    zones, setZones, soil, connected, mode, pumpOn, setPumpOn, temperature, humidity,
    rainPercent, raining, rainBlock, lastUpdated, sendCommand, togglePump,
    changeMode, toggleWeatherGate, reconnect, setZoneThreshold, saveZoneConfig,
    configLoading, configError, deviceId, deviceOnline, brokerConnected,
    commandVersion, servoAngle, tankDistanceCm, tankEmpty, lastTelemetryAt,
  };
}
