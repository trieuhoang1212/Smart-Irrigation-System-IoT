"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { zoneHref } from "../lib/zone-link";
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
  activeZone?: string | null;
  active?: NavKey;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export function Sidebar({
  connected,
  brokerConnected,
  deviceOnline,
  lastUpdated,
  onReconnect,
  activeZone,
  active = "overview",
  onNavigate,
}: SidebarProps) {
  const brokerOnline = brokerConnected === true;
  const deviceLabel = !connected
    ? "chưa rõ"
    : deviceOnline
      ? "đang hoạt động"
      : "mất kết nối";
  const onDashboard = active === "overview";
  const overviewHref = onDashboard ? "#top" : zoneHref("/", activeZone);

  return (
    <aside className="sidebar">
      <a className="brand" href={overviewHref} onClick={onNavigate}>
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
          href={overviewHref}
          onClick={onNavigate}
        >
          <GridIcon size={17} />
          Tổng quan
        </a>
        <Link
          className={`nav-item ${active === "analysis" ? "active" : ""}`}
          href={zoneHref("/analysis", activeZone)}
          onClick={onNavigate}
        >
          <GaugeIcon size={17} />
          Phân tích cây trồng
        </Link>
        <Link
          className={`nav-item ${active === "history" ? "active" : ""}`}
          href={zoneHref("/history", activeZone)}
          onClick={onNavigate}
        >
          <ChartIcon size={17} />
          Lịch sử cảm biến
        </Link>
        <Link
          className={`nav-item ${active === "activity" ? "active" : ""}`}
          href={zoneHref("/activity", activeZone)}
          onClick={onNavigate}
        >
          <ClockIcon size={17} />
          Nhật ký hoạt động
        </Link>
        <Link
          className={`nav-item ${active === "garden" ? "active" : ""}`}
          href={zoneHref("/garden", activeZone)}
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
              ? "Đang kiểm tra kết nối"
              : brokerOnline
                ? "Kết nối hệ thống ổn định"
                : "Mất kết nối hệ thống"}
          </div>
          <p>Thiết bị tưới: {deviceLabel}</p>
          <p>Dữ liệu cuối: {lastUpdated}</p>
          <button type="button" onClick={onReconnect}>
            <RefreshIcon size={14} />
            Kết nối lại
          </button>
        </div>
      </div>
    </aside>
  );
}
