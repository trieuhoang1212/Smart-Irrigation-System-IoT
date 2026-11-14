"use client";

import { formatAge, formatClock } from "../lib/time";

export function DeviceStatusBanner({
  connected,
  brokerConnected,
  deviceOnline,
  lastTelemetryAt,
  onReconnect,
}: {
  connected: boolean;
  brokerConnected: boolean | null;
  deviceOnline: boolean;
  lastTelemetryAt: number | null;
  onReconnect: () => void;
}) {
  if (connected && deviceOnline) return null;

  let title: string;
  let detail: string;

  if (!connected) {
    title = "Backend chưa kết nối";
    detail = "Hãy chắc chắn Backend đang chạy và kết nối được Mosquitto.";
  } else if (brokerConnected === null) {
    title = "Đang kiểm tra kết nối MQTT";
    detail = "Chờ Backend xác nhận trạng thái Mosquitto.";
  } else if (!brokerConnected) {
    title = "MQTT Broker đang offline";
    detail = lastTelemetryAt === null
      ? "Backend chưa kết nối được Mosquitto :1883 nên chưa có telemetry."
      : `Telemetry cuối ${formatClock(lastTelemetryAt)} (${formatAge(lastTelemetryAt)}). Lệnh điều khiển tạm khoá.`;
  } else {
    title = "ESP32 đang offline";
    detail = lastTelemetryAt === null
      ? "Chưa nhận được telemetry nào. Kiểm tra nguồn ESP32 và kết nối Wi-Fi."
      : `Telemetry cuối ${formatClock(lastTelemetryAt)} (${formatAge(lastTelemetryAt)}). Vẫn xem được dữ liệu cũ nhưng lệnh tưới và đổi chế độ tạm khoá.`;
  }

  return (
    <div className="offline-banner" role="status">
      <span aria-hidden="true">!</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <button type="button" onClick={onReconnect}>
        Kết nối lại
      </button>
    </div>
  );
}
