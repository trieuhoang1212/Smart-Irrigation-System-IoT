"use client";

import React from "react";

interface TopbarProps {
  syncing: boolean;
  onSync: () => void;
}

export function Topbar({ syncing, onSync }: TopbarProps) {
  return (
    <>
      <header className="topbar">
        <div className="mobile-brand">
          <span className="brand-mark">✦</span> Greenflow
        </div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Tìm kiếm">⌕</button>
          <button className="icon-button notification" aria-label="Thông báo">
            ♢<i />
          </button>
          <div className="mini-avatar">AT</div>
        </div>
      </header>

      <div className="page-heading">
        <div>
          <p className="eyebrow">HỆ THỐNG TƯỚI TỰ ĐỘNG THÔNG MINH</p>
          <h1>
            Dashboard Giám Sát Realtime <span>✦</span>
          </h1>
          <p className="subtitle">
            Kết nối trực tiếp ESP32 Wokwi qua Mosquitto MQTT Broker.
          </p>
        </div>
        <button
          className="sync-button"
          onClick={onSync}
          disabled={syncing}
        >
          <span>↻</span> {syncing ? "Syncing..." : "Sync live data"}
        </button>
      </div>
    </>
  );
}
