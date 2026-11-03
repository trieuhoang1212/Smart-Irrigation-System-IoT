import mqtt, { type MqttClient } from "mqtt";
import { config } from "./config.js";
import { normalizeTelemetry, type Telemetry } from "./domain.js";

export type TelemetryMeta = {
  retained: boolean;
};

export class MqttGateway {
  private readonly client: MqttClient;
  private readonly telemetryListeners = new Set<
    (telemetry: Telemetry, meta: TelemetryMeta) => void
  >();

  constructor() {
    this.client = mqtt.connect(config.mqttUrl, {
      reconnectPeriod: 2000,
      clientId: `smart-irrigation-backend-${Math.random().toString(16).slice(2)}`,
    });
    this.client.on("connect", () => {
      console.log(`MQTT connected: ${config.mqttUrl}`);
      this.client.subscribe(config.statusTopic, { qos: 1 }, (error) => {
        if (error) console.error("MQTT subscribe failed:", error.message);
      });
    });
    this.client.on("reconnect", () => console.log("MQTT reconnecting..."));
    this.client.on("error", (error) => console.error("MQTT error:", error.message));
    this.client.on("message", (topic, message, packet) => {
      if (topic !== config.statusTopic) return;
      try {
        const telemetry = normalizeTelemetry(
          JSON.parse(message.toString()) as Record<string, unknown>,
          config.deviceId,
        );
        const meta: TelemetryMeta = { retained: Boolean(packet.retain) };
        this.telemetryListeners.forEach((listener) => listener(telemetry, meta));
      } catch (error) {
        console.error("Invalid MQTT telemetry:", error);
      }
    });
  }

  get connected() {
    return this.client.connected;
  }

  onTelemetry(listener: (telemetry: Telemetry, meta: TelemetryMeta) => void) {
    this.telemetryListeners.add(listener);
    return () => this.telemetryListeners.delete(listener);
  }

  publish(command: string) {
    return new Promise<void>((resolve, reject) => {
      if (!this.client.connected) {
        reject(new Error("MQTT is not connected"));
        return;
      }
      this.client.publish(config.commandTopic, command, { qos: 1 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  close() {
    this.client.end();
  }
}
