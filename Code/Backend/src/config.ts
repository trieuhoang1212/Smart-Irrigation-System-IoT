import "dotenv/config";

function requiredNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric configuration: ${value}`);
  }
  return parsed;
}

export const config = {
  port: requiredNumber(process.env.PORT, 3001),
  mqttUrl: process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883",
  mqttUsername: process.env.MQTT_USERNAME || undefined,
  mqttPassword: process.env.MQTT_PASSWORD || undefined,
  statusTopic: process.env.MQTT_STATUS_TOPIC ?? "smart-irrigation/status",
  commandTopic: process.env.MQTT_COMMAND_TOPIC ?? "smart-irrigation/cmd",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  deviceId: process.env.DEFAULT_DEVICE_ID ?? "esp32-garden-01",
  dbPath: process.env.DB_PATH ?? "data/smart-irrigation.db",
  dbRetentionDays: requiredNumber(process.env.DB_RETENTION_DAYS, 30),
};
