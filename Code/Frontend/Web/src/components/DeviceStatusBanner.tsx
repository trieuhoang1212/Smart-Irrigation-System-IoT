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
    title = "Mất kết nối máy chủ";
    detail = "Không tải được dữ liệu mới. Kiểm tra máy chủ đang chạy rồi thử lại.";
  } else if (brokerConnected === null) {
    title = "Đang kiểm tra kết nối";
    detail = "Chờ hệ thống xác nhận trạng thái thiết bị tưới.";
  } else if (!brokerConnected) {
    title = "Chưa kết nối được thiết bị tưới";
    detail = lastTelemetryAt === null
      ? "Chưa nhận được dữ liệu nào. Kiểm tra nguồn thiết bị và kết nối mạng."
      : `Dữ liệu cuối ${formatClock(lastTelemetryAt)} (${formatAge(lastTelemetryAt)}). Lệnh điều khiển tạm khoá.`;
  } else {
    title = "Thiết bị tưới đang mất kết nối";
    detail = lastTelemetryAt === null
      ? "Chưa nhận được dữ liệu nào. Kiểm tra nguồn thiết bị và kết nối Wi-Fi."
      : `Dữ liệu cuối ${formatClock(lastTelemetryAt)} (${formatAge(lastTelemetryAt)}). Vẫn xem được dữ liệu cũ nhưng lệnh tưới và đổi chế độ tạm khoá.`;
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
