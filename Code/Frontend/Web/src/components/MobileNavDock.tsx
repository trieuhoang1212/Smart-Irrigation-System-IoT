"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  ChartIcon,
  ChevronUpIcon,
  ClockIcon,
  EditIcon,
  GaugeIcon,
  GridIcon,
  MenuIcon,
} from "./icons";

type NavKey = "overview" | "analysis" | "history" | "activity" | "garden";

const SHOW_AFTER_PX = 320;

const ITEMS = [
  { key: "overview", label: "Tổng quan", href: "/", Icon: GridIcon },
  { key: "analysis", label: "Phân tích cây trồng", href: "/analysis", Icon: GaugeIcon },
  { key: "history", label: "Lịch sử cảm biến", href: "/history", Icon: ChartIcon },
  { key: "activity", label: "Nhật ký hoạt động", href: "/activity", Icon: ClockIcon },
  { key: "garden", label: "Quản lý khu vườn", href: "/garden", Icon: EditIcon },
] as const;

export function MobileNavDock({
  active = "overview",
  onNavigate,
}: {
  active?: NavKey;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const shown = window.scrollY > SHOW_AFTER_PX;
        setVisible(shown);
        if (!shown) setOpen(false);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = ITEMS.find((item) => item.key === active) ?? ITEMS[0];

  return (
    <div className={`nav-dock ${visible ? "visible" : ""}`} ref={rootRef}>
      {open && (
        <nav className="nav-dock-menu" aria-label="Chọn trang">
          {ITEMS.map(({ key, label, href, Icon }) => (
            <Link
              key={key}
              className={key === active ? "active" : ""}
              href={key === "overview" && active === "overview" ? "#top" : href}
              onClick={(event) => {
                setOpen(false);
                onNavigate?.(event);
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
      )}

      <button
        type="button"
        className="nav-dock-trigger"
        aria-expanded={open}
        tabIndex={visible ? 0 : -1}
        onClick={() => setOpen((value) => !value)}
      >
        <MenuIcon size={17} />
        <span>{open ? "Chọn trang" : current.label}</span>
        <ChevronUpIcon size={16} />
      </button>
    </div>
  );
}
