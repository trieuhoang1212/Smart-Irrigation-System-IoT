"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import {
  ChartIcon,
  ClockIcon,
  EditIcon,
  GaugeIcon,
  GridIcon,
  LeafIcon,
  RefreshIcon,
} from "./icons";

type NavKey = "overview" | "analysis" | "history" | "activity" | "garden";

interface SidebarProps {
  connected: boolean;
  brokerConnected: boolean | null;
  deviceOnline: boolean;
  lastUpdated: string;
  onReconnect: () => void;
  active?: NavKey;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export function Sidebar({
  connected,
  brokerConnected,
  deviceOnline,
  lastUpdated,
  onReconnect,
  active = "overview",
  onNavigate,
}: SidebarProps) {
  const brokerOnline = brokerConnected === true;
  const deviceLabel = !connected
    ? "chưa rõ"
    : deviceOnline
      ? "Online"
      : "Offline";
  const onDashboard = active === "overview";

  return (
    <aside className="sidebar">
      <a className="brand" href={onDashboard ? "#top" : "/"} onClick={onNavigate}>
        <span className="brand-mark">
          <LeafIcon size={16} />
        </span>
        <span>
          Green<span>flow</span>
        </span>
      </a>

      <nav>
        <p className="nav-label">Bảng điều khiển</p>
        <a
          className={`nav-item ${onDashboard ? "active" : ""}`}
          href={onDashboard ? "#top" : "/"}
          onClick={onNavigate}
        >
          <GridIcon size={17} />
          Tổng quan
        </a>
        <Link
          className={`nav-item ${active === "analysis" ? "active" : ""}`}
          href="/analysis"
          onClick={onNavigate}
        >
          <GaugeIcon size={17} />
          Phân tích cây trồng
        </Link>
        <Link
          className={`nav-item ${active === "history" ? "active" : ""}`}
          href="/history"
          onClick={onNavigate}
        >
          <ChartIcon size={17} />
          Lịch sử cảm biến
        </Link>
        <Link
          className={`nav-item ${active === "activity" ? "active" : ""}`}
          href="/activity"
          onClick={onNavigate}
        >
          <ClockIcon size={17} />
          Nhật ký hoạt động
        </Link>
        <Link
          className={`nav-item ${active === "garden" ? "active" : ""}`}
          href="/garden"
          onClick={onNavigate}
        >
          <EditIcon size={17} />
          Quản lý khu vườn
        </Link>
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
