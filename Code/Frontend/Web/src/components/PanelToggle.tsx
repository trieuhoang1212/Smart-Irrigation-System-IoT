"use client";

import { useSyncExternalStore } from "react";
import { PanelLeftIcon, PanelRightIcon } from "./icons";

type Panel = "nav" | "rail";

const CHANGE_EVENT = "greenflow:panel-change";

const LABELS: Record<Panel, { hide: string; show: string }> = {
  nav: { hide: "Ẩn thanh điều hướng", show: "Hiện thanh điều hướng" },
  rail: { hide: "Ẩn cột thông tin bên phải", show: "Hiện cột thông tin bên phải" },
};

function isCollapsed(panel: Panel) {
  return document.documentElement.dataset[panel] === "collapsed";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

export function PanelToggle({ panel }: { panel: Panel }) {
  const collapsed = useSyncExternalStore(
    subscribe,
    () => isCollapsed(panel),
    () => false,
  );

  const togglePanel = () => {
    const root = document.documentElement;
    root.dataset[panel] = isCollapsed(panel) ? "open" : "collapsed";
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const label = LABELS[panel][collapsed ? "show" : "hide"];
  const Icon = panel === "nav" ? PanelLeftIcon : PanelRightIcon;

  return (
    <button
      type="button"
      className={`panel-toggle panel-toggle-${panel}`}
      onClick={togglePanel}
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
    >
      <Icon size={16} />
    </button>
  );
}
