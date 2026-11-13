"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { ChartIcon, ClockIcon, EditIcon, GaugeIcon, GridIcon, LeafIcon } from "./icons";
import { LiveClock } from "./LiveClock";
import { MobileNavDock } from "./MobileNavDock";

type NavKey = "overview" | "analysis" | "history" | "activity" | "garden";

export function Topbar({
  connected,
  lastUpdated,
  active = "overview",
  crumb = "Tổng quan",
  eyebrow = "Hệ thống tưới tự động",
  title = "Giám sát khu vườn",
  subtitle = "ESP32 Wokwi · Mosquitto MQTT · dữ liệu cảm biến cập nhật mỗi 2 giây.",
  onNavigate,
}: {
  connected: boolean;
  lastUpdated: string;
  active?: NavKey;
  crumb?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const onDashboard = active === "overview";

  return (
    <>
      <header className="topbar">
        <div className="mobile-brand">
          <span className="brand-mark">
            <LeafIcon size={14} />
          </span>
          Greenflow
        </div>
        <span className="topbar-crumb">{crumb}</span>
        <span className={`topbar-status ${connected ? "" : "off"}`}>
          <i />
          {connected ? `Telemetry cuối ${lastUpdated}` : "Mất kết nối backend"}
        </span>
        <LiveClock />
      </header>

      <nav className="compact-nav" aria-label="Điều hướng nhanh">
        <a
          className={onDashboard ? "active" : ""}
          href={onDashboard ? "#top" : "/"}
          onClick={onNavigate}
        >
          <GridIcon size={15} />
          Tổng quan
        </a>
        <Link
          className={active === "analysis" ? "active" : ""}
          href="/analysis"
          onClick={onNavigate}
        >
          <GaugeIcon size={15} />
          Phân tích cây trồng
        </Link>
        <Link
          className={active === "history" ? "active" : ""}
          href="/history"
          onClick={onNavigate}
        >
          <ChartIcon size={15} />
          Lịch sử cảm biến
        </Link>
        <Link
          className={active === "activity" ? "active" : ""}
          href="/activity"
          onClick={onNavigate}
        >
          <ClockIcon size={15} />
          Nhật ký hoạt động
        </Link>
        <Link
          className={active === "garden" ? "active" : ""}
          href="/garden"
          onClick={onNavigate}
        >
          <EditIcon size={15} />
          Quản lý khu vườn
        </Link>
      </nav>

      <MobileNavDock active={active} onNavigate={onNavigate} />

      <div className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
      </div>
    </>
  );
}
