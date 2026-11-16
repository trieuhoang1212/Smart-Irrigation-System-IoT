"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { zoneHref } from "../lib/zone-link";
import type { SearchZone } from "../lib/search";
import { ChartIcon, ClockIcon, EditIcon, GaugeIcon, GridIcon, LeafIcon } from "./icons";
import { LiveClock } from "./LiveClock";
import { MobileNavDock } from "./MobileNavDock";
import { PanelToggle } from "./PanelToggle";
import { SearchBox } from "./SearchBox";

type NavKey = "overview" | "analysis" | "history" | "activity" | "garden";

export function Topbar({
  connected,
  lastUpdated,
  mode,
  activeZone,
  active = "overview",
  crumb = "Tổng quan",
  eyebrow = "Hệ thống tưới tự động",
  title = "Giám sát khu vườn",
  zones = [],
  onNavigate,
  onSelectZone,
}: {
  connected: boolean;
  lastUpdated: string;
  mode?: "auto" | "manual";
  activeZone?: string | null;
  active?: NavKey;
  crumb?: string;
  eyebrow?: string;
  title?: string;
  zones?: SearchZone[];
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onSelectZone?: (zoneId: string) => void;
}) {
  const onDashboard = active === "overview";
  const overviewHref = onDashboard ? "#top" : zoneHref("/", activeZone);

  return (
    <>
      <header className="topbar">
        <div className="mobile-brand">
          <span className="brand-mark">
            <LeafIcon size={14} />
          </span>
          Greenflow
        </div>
        {crumb !== title && <span className="topbar-crumb">{crumb}</span>}
        {mode && (
          <span
            className={`topbar-mode ${mode}`}
            title={
              mode === "auto"
                ? "Chế độ Tự động cho cả vườn"
                : "Chế độ Thủ công: tưới tự động đang tắt cho cả vườn"
            }
          >
            <i />
            {mode === "auto" ? "Tự động" : "Thủ công"}
          </span>
        )}
        <SearchBox
          active={active}
          zones={zones}
          onNavigate={onNavigate}
          onSelectZone={onSelectZone}
        />
        <span
          className={`topbar-status ${connected ? "" : "off"}`}
          title={`Cập nhật lúc: ${lastUpdated}`}
        >
          <i />
          {connected ? `Cập nhật: ${lastUpdated}` : "Mất kết nối máy chủ"}
        </span>
        <LiveClock />
      </header>

      <nav className="compact-nav" aria-label="Điều hướng nhanh">
        <a className={onDashboard ? "active" : ""} href={overviewHref} onClick={onNavigate}>
          <GridIcon size={15} />
          Tổng quan
        </a>
        <Link
          className={active === "analysis" ? "active" : ""}
          href={zoneHref("/analysis", activeZone)}
          onClick={onNavigate}
        >
          <GaugeIcon size={15} />
          Phân tích
        </Link>
        <Link
          className={active === "history" ? "active" : ""}
          href={zoneHref("/history", activeZone)}
          onClick={onNavigate}
        >
          <ChartIcon size={15} />
          Lịch sử
        </Link>
        <Link
          className={active === "activity" ? "active" : ""}
          href={zoneHref("/activity", activeZone)}
          onClick={onNavigate}
        >
          <ClockIcon size={15} />
          Nhật ký
        </Link>
        <Link
          className={active === "garden" ? "active" : ""}
          href={zoneHref("/garden", activeZone)}
          onClick={onNavigate}
        >
          <EditIcon size={15} />
          Khu vườn
        </Link>
      </nav>

      <MobileNavDock active={active} activeZone={activeZone} onNavigate={onNavigate} />

      <div className="page-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className="page-heading-tools">
          <PanelToggle panel="nav" />
          <PanelToggle panel="rail" />
        </div>
      </div>
    </>
  );
}
