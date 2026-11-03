"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { type Zone } from "../garden-data";

type BackendTelemetry = {
  mode?: "auto" | "manual";
  temperature?: number;
  humidity?: number;
  rain?: number;
  raining?: boolean;
  weatherGate?: boolean;
  pump?: boolean;
  zones?: Array<{
    id?: string;
    moisture?: number;
    threshold?: number;
    stopThreshold?: number;
    pump?: boolean;
  }>;
};

export interface UseMqttOptions {
  backendUrl: string;
  initialZones: Zone[];
  onLog?: (msg: string) => void;
}

const MAX_RECONNECT_DELAY = 15000;
const OPTIMISTIC_WINDOW_MS = 3000;

export function useMqtt({ backendUrl, initialZones, onLog }: UseMqttOptions) {
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [pumpOn, setPumpOn] = useState(false);
  const [temperature, setTemperature] = useState(25);
  const [humidity, setHumidity] = useState(65);
  const [rainPercent, setRainPercent] = useState(0);
  const [raining, setRaining] = useState(false);
  const [rainBlock, setRainBlock] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("Chưa kết nối");
  const [reconnectToken, setReconnectToken] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const pumpByZoneRef = useRef<Record<string, boolean>>({});
  const pendingRef = useRef<{ mode?: number; weatherGate?: number }>({});
  const pendingThresholdRef = useRef<Record<string, number>>({});

  const log = useCallback((message: string) => onLog?.(message), [onLog]);

  const applyTelemetry = useCallback((data: BackendTelemetry, isOnline: boolean) => {
    const hasZoneList = Array.isArray(data.zones);
    const now = Date.now();

    setZones((current) =>
      current.map((zone) => {
        const live = hasZoneList
          ? data.zones?.find((item) => item.id === zone.id)
          : undefined;
        if (!live) return hasZoneList ? { ...zone, online: false } : zone;

        const isThresholdPending = now <= (pendingThresholdRef.current[zone.id] ?? 0);

        return {
          ...zone,
          moisture: Math.max(0, Math.min(100, Number(live.moisture ?? zone.moisture))),
          pump: isOnline ? Boolean(live.pump) : false,
          threshold: isThresholdPending
            ? zone.threshold
            : Number(live.threshold) > 0
              ? Math.min(100, Number(live.threshold))
              : zone.threshold,
          stopThreshold: isThresholdPending
            ? zone.stopThreshold
            : Number(live.stopThreshold) > 0
              ? Math.min(100, Number(live.stopThreshold))
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

    if (data.temperature !== undefined) setTemperature(Number(data.temperature));
    if (data.humidity !== undefined) setHumidity(Math.max(0, Math.min(100, Number(data.humidity))));
    if (data.rain !== undefined) setRainPercent(Math.max(0, Math.min(100, Number(data.rain))));
    if (data.raining !== undefined) setRaining(data.raining);
    if (data.pump !== undefined) setPumpOn(isOnline ? Boolean(data.pump) : false);

    if (data.mode && now > (pendingRef.current.mode ?? 0)) setMode(data.mode);
    if (data.weatherGate !== undefined && now > (pendingRef.current.weatherGate ?? 0)) {
      setRainBlock(data.weatherGate);
    }

    setLastUpdated(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
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
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as {
            type?: string;
            data?: BackendTelemetry;
            online?: boolean;
          };
          if (message.type === "telemetry" && message.data) {
            applyTelemetry(message.data, message.online !== false);
          } else if (message.type === "device-status" && message.online === false) {
            setZones((current) =>
              current.map((zone) => ({ ...zone, online: false, pump: false })),
            );
            setPumpOn(false);
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
        setZones((current) => current.map((zone) => ({ ...zone, online: false })));

        attempt += 1;
        const delay = Math.min(1000 * 2 ** (attempt - 1), MAX_RECONNECT_DELAY);
        log(`Mất kết nối Backend, thử lại sau ${Math.round(delay / 1000)}s...`);
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
  }, [backendUrl, applyTelemetry, log, reconnectToken]);

  const sendCommand = useCallback(
    (cmd: string) => {
      const pumpMatch = cmd.match(/^(PUMP_ON|PUMP_OFF)_(T00[1-6])$/);
      const thresholdMatch = cmd.match(/^SET_THRESHOLD_(T00[1-6])_(\d{1,3})$/);
      const body = pumpMatch
        ? { action: pumpMatch[1], zoneId: pumpMatch[2] }
        : thresholdMatch
          ? { action: "SET_THRESHOLD", zoneId: thresholdMatch[1], value: Number(thresholdMatch[2]) }
          : { action: cmd };

      return fetch(`${backendUrl.replace(/\/+$/, "")}/api/devices/esp32-garden-01/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((response) => {
          if (!response.ok) {
            log(`Backend từ chối lệnh ${cmd}.`);
            return false;
          }
          return true;
        })
        .catch(() => {
          log(`Không gửi được lệnh ${cmd} tới Backend.`);
          return false;
        });
    },
    [backendUrl, log],
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
      setMode(newMode);
      pendingRef.current.mode = Date.now() + OPTIMISTIC_WINDOW_MS;
      return sendCommand(newMode === "auto" ? "MODE_AUTO" : "MODE_MANUAL");
    },
    [sendCommand],
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
    setReconnectToken((current) => current + 1);
    log("Đang yêu cầu kết nối lại Backend...");
  }, [log]);

  const setZoneThreshold = useCallback(
    (zoneId: string, value: number) => {
      const clamped = Math.max(10, Math.min(90, Math.round(value)));
      pendingThresholdRef.current[zoneId] = Date.now() + OPTIMISTIC_WINDOW_MS;
      setZones((current) =>
        current.map((zone) =>
          zone.id === zoneId
            ? {
                ...zone,
                threshold: clamped,
                stopThreshold: Math.max(zone.stopThreshold, Math.min(100, clamped + 20)),
              }
            : zone,
        ),
      );
      void sendCommand(`SET_THRESHOLD_${zoneId}_${clamped}`);
    },
    [sendCommand],
  );

  return {
    zones, setZones, connected, mode, pumpOn, setPumpOn, temperature, humidity,
    rainPercent, raining, rainBlock, lastUpdated, sendCommand, togglePump,
    changeMode, toggleWeatherGate, reconnect, setZoneThreshold,
  };
}
