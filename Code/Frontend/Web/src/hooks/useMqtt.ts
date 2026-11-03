"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mqtt, { type MqttClient } from "mqtt";
import { type Zone } from "../garden-data";

export interface UseMqttOptions {
  brokerUrl: string;
  statusTopic: string;
  cmdTopic: string;
  initialZones: Zone[];
  onLog?: (msg: string) => void;
}

export function useMqtt({
  brokerUrl,
  statusTopic,
  cmdTopic,
  initialZones,
  onLog,
}: UseMqttOptions) {
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [pumpOn, setPumpOn] = useState(false);
  const [temperature, setTemperature] = useState(25.0);
  const [humidity, setHumidity] = useState(65.0);
  const [rainPercent, setRainPercent] = useState(0);
  const [raining, setRaining] = useState(false);
  const [rainBlock, setRainBlock] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("Chưa kết nối");

  const clientRef = useRef<MqttClient | null>(null);

  const log = useCallback(
    (message: string) => {
      onLog?.(message);
    },
    [onLog],
  );

  useEffect(() => {
    let disposed = false;

    const client = mqtt.connect(brokerUrl, {
      reconnectPeriod: 2000,
    });
    clientRef.current = client;

    client.on("connect", () => {
      if (disposed || clientRef.current !== client) return;

      setConnected(true);
      setZones((current) => current.map((zone) => ({ ...zone, online: true })));
      setLastUpdated("Vừa kết nối");
      log("Web đã kết nối Mosquitto Broker thành công!");
      client.subscribe(statusTopic);
    });

    client.on("message", (topic, message) => {
      if (topic === statusTopic) {
        try {
          const data = JSON.parse(message.toString());

          if (data.moisture !== undefined && Number.isFinite(Number(data.moisture))) {
            setZones((current) =>
              current.map((z) =>
                z.id === "T002"
                  ? {
                      ...z,
                      moisture: Math.max(0, Math.min(100, Number(data.moisture))),
                      online: true,
                    }
                  : z,
              ),
            );
          }

          if (Array.isArray(data.zones)) {
            setZones((current) =>
              current.map((zone) => {
                const live = data.zones.find(
                  (item: { id?: string }) => item.id === zone.id,
                );
                return live
                  ? {
                      ...zone,
                      moisture: Math.max(
                        0,
                        Math.min(100, Number(live.moisture)),
                      ),
                      online: true,
                    }
                  : zone;
              }),
            );
          }

          if (data.temperature !== undefined && Number.isFinite(Number(data.temperature))) {
            setTemperature(Number(data.temperature));
          }
          if (data.humidity !== undefined && Number.isFinite(Number(data.humidity))) {
            setHumidity(Math.max(0, Math.min(100, Number(data.humidity))));
          }
          if (data.rain !== undefined && Number.isFinite(Number(data.rain))) {
            setRainPercent(Math.max(0, Math.min(100, Number(data.rain))));
          }
          if (data.raining !== undefined) setRaining(Boolean(data.raining));
          if (data.weatherGate !== undefined) {
            setRainBlock(Boolean(data.weatherGate));
          }
          if (data.pump !== undefined) setPumpOn(Boolean(data.pump));
          if (data.mode !== undefined) {
            setMode(data.mode === "auto" ? "auto" : "manual");
          }

          const time = new Date().toLocaleTimeString();
          setLastUpdated(time);
        } catch (e) {
          console.error("Lỗi phân tích JSON từ MQTT:", e);
        }
      }
    });

    client.on("close", () => {
      setConnected(false);
      setZones((current) => current.map((zone) => ({ ...zone, online: false })));
    });

    client.on("error", (err) => {
      console.error("Mosquitto error:", err);
      setConnected(false);
    });

    return () => {
      disposed = true;
      if (clientRef.current === client) {
        clientRef.current = null;
      }
      client.end();
    };
  }, [brokerUrl, statusTopic, log]);

  const sendCommand = useCallback(
    (cmd: string) => {
      if (!connected || !clientRef.current) {
        log("Không thể gửi lệnh khi mất kết nối MQTT");
        return false;
      }
      clientRef.current.publish(cmdTopic, cmd);
      return true;
    },
    [connected, cmdTopic, log],
  );

  const togglePump = useCallback((zoneId?: string) => {
    const nextState = !pumpOn;
    setPumpOn(nextState);
    const cmd = nextState
      ? zoneId
        ? `PUMP_ON_${zoneId}`
        : "PUMP_ON"
      : zoneId
        ? `PUMP_OFF_${zoneId}`
        : "PUMP_OFF";
    if (sendCommand(cmd)) {
      log(`Gửi lệnh: ${cmd} (${mode === "manual" ? "Thủ công" : "Bảng điều khiển"})`);
    }
    return nextState;
  }, [pumpOn, mode, sendCommand, log]);

  const changeMode = useCallback(
    (newMode: "auto" | "manual") => {
      setMode(newMode);
      const cmd = newMode === "auto" ? "MODE_AUTO" : "MODE_MANUAL";
      if (sendCommand(cmd)) {
        log(`Chuyển sang chế độ: ${newMode.toUpperCase()}`);
      }
    },
    [sendCommand, log],
  );

  const toggleWeatherGate = useCallback(
    (enabled: boolean) => {
      setRainBlock(enabled);
      const cmd = enabled ? "WEATHER_GATE_ON" : "WEATHER_GATE_OFF";
      if (sendCommand(cmd)) {
        log(`${enabled ? "Bật" : "Tắt"} bảo vệ khi mưa`);
      } else {
        log("Đã đổi giao diện nhưng chưa gửi được weather gate vì mất kết nối MQTT");
      }
    },
    [sendCommand, log],
  );

  const reconnect = useCallback(() => {
    clientRef.current?.reconnect();
    log("Đang yêu cầu kết nối lại Mosquitto...");
  }, [log]);

  const setZoneThreshold = useCallback(
    (zoneId: string, value: number) => {
      setZones((current) =>
        current.map((zone) =>
          zone.id === zoneId ? { ...zone, threshold: value } : zone,
        ),
      );
      log(`Đổi ngưỡng tưới ${zoneId} thành ${value}%`);
    },
    [log],
  );

  return {
    zones,
    setZones,
    connected,
    mode,
    pumpOn,
    setPumpOn,
    temperature,
    humidity,
    rainPercent,
    raining,
    rainBlock,
    lastUpdated,
    sendCommand,
    togglePump,
    changeMode,
    toggleWeatherGate,
    reconnect,
    setZoneThreshold,
  };
}
