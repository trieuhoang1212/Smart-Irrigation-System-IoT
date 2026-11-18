"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "./icons";

type Theme = "light" | "dark";

const CHANGE_EVENT = "greenflow:theme-change";
const STORAGE_KEY = "greenflow:theme";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light");
  const dark = theme === "dark";

  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Trình duyệt chặn localStorage thì chỉ đổi trong phiên.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const label = dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối";

  return (
    <button
      type="button"
      className="panel-toggle theme-toggle"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={dark}
    >
      {dark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
    </button>
  );
}
