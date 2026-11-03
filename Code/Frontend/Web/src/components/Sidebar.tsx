"use client";

import React from "react";

interface SidebarProps {
  connected: boolean;
  lastUpdated: string;
  onReconnect: () => void;
}

export function Sidebar({ connected, lastUpdated, onReconnect }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">✦</span>
        <span>
          Green<span>flow</span>
        </span>
      </div>
      <nav>
        <p className="nav-label">WORKSPACE</p>
        <button className="nav-item active">
          <span className="icon" aria-hidden="true">⌂</span>
          Overview
        </button>
        <button className="nav-item">
          <span className="icon" aria-hidden="true">▦</span>
          Garden layout
        </button>
        <button className="nav-item">
          <span className="icon" aria-hidden="true">⌁</span>
          Live sensors
        </button>
        <button className="nav-item">
          <span className="icon" aria-hidden="true">◴</span>
          Automation
        </button>
        <p className="nav-label second">SYSTEM</p>
        <button className="nav-item" onClick={onReconnect}>
          <span className="icon" aria-hidden="true">◉</span>
          Mosquitto MQTT{" "}
          <span className={`nav-status ${connected ? "" : "offline"}`} />
        </button>
        <button className="nav-item">
          <span className="icon" aria-hidden="true">⚙</span>
          Settings
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="connection-card">
          <div className="connection-title">
            <span className={`pulse ${connected ? "" : "off"}`} />{" "}
            {connected ? "Mosquitto Connected" : "Mosquitto Offline"}
          </div>
          <small>ESP32 · Cập nhật: {lastUpdated}</small>
          <button onClick={onReconnect}>
            {connected ? "Connected" : "Reconnect"}
          </button>
        </div>
        <div className="profile">
          <div className="avatar">AT</div>
          <div>
            <strong>Anna Tran</strong>
            <small>Garden owner</small>
          </div>
          <span>•••</span>
        </div>
      </div>
    </aside>
  );
}
