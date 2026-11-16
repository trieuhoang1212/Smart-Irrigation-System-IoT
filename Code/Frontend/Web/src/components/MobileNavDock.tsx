"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { zoneHref } from "../lib/zone-link";
import { ChartIcon, ClockIcon, EditIcon, GaugeIcon, GridIcon } from "./icons";

type NavKey = "overview" | "analysis" | "history" | "activity" | "garden";

const ITEMS = [
  { key: "overview", label: "Tổng quan", href: "/", Icon: GridIcon },
  { key: "analysis", label: "Phân tích", href: "/analysis", Icon: GaugeIcon },
  { key: "history", label: "Lịch sử", href: "/history", Icon: ChartIcon },
  { key: "activity", label: "Nhật ký", href: "/activity", Icon: ClockIcon },
  { key: "garden", label: "Khu vườn", href: "/garden", Icon: EditIcon },
] as const;

export function MobileNavDock({
  active = "overview",
  activeZone,
  onNavigate,
}: {
  active?: NavKey;
  activeZone?: string | null;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <nav className="mobile-tabbar" aria-label="Điều hướng chính">
      {ITEMS.map(({ key, label, href, Icon }) => {
        const current = key === active;
        return (
          <Link
            key={key}
            className={current ? "active" : ""}
            href={key === "overview" && current ? "#top" : zoneHref(href, activeZone)}
            aria-current={current ? "page" : undefined}
            onClick={(event) => onNavigate?.(event)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
