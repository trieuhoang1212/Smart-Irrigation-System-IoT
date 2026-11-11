"use client";

import { ChartIcon, ClockIcon, GridIcon, LeafIcon, RefreshIcon } from "./icons";

interface SidebarProps {
  connected: boolean;
  brokerConnected: boolean | null;
  deviceOnline: boolean;
  lastUpdated: string;
  onReconnect: () => void;
}

export function Sidebar({
  connected,
  brokerConnected,
  deviceOnline,
  lastUpdated,
  onReconnect,
}: SidebarProps) {
  const brokerOnline = brokerConnected === true;
  const deviceLabel = !connected
    ? "chưa rõ"
    : deviceOnline
      ? "Online"
      : "Offline";

  return (
    <aside className="sidebar">
      <a className="brand" href="#top">
        <span className="brand-mark">
          <LeafIcon size={16} />
        </span>
        <span>
          Green<span>flow</span>
        </span>
      </a>

      <nav>
        <p className="nav-label">Bảng điều khiển</p>
        <a className="nav-item active" href="#top">
          <GridIcon size={17} />
          Tổng quan
        </a>
        <a className="nav-item" href="#history">
          <ChartIcon size={17} />
          Lịch sử cảm biến
        </a>
        <a className="nav-item" href="#activity">
          <ClockIcon size={17} />
          Nhật ký hoạt động
        </a>
      </nav>

      <div className="sidebar-bottom">
        <div className="connection-card">
          <div className="connection-title">
            <span className={`pulse ${brokerOnline ? "" : "off"}`} />
            {brokerConnected === null
              ? "Đang kiểm tra MQTT"
              : brokerOnline
                ? "MQTT Broker online"
                : "MQTT Broker offline"}
          </div>
          <p>ESP32: {deviceLabel}</p>
          <p>Cập nhật: {lastUpdated}</p>
          <button type="button" onClick={onReconnect}>
            <RefreshIcon size={14} />
            Kết nối lại
          </button>
        </div>
      </div>
    </aside>
  );
}
