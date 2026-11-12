"use client";

import { LeafIcon } from "./icons";

export function Topbar({
  connected,
  lastUpdated,
}: {
  connected: boolean;
  lastUpdated: string;
}) {
  return (
    <>
      <header className="topbar">
        <div className="mobile-brand">
          <span className="brand-mark">
            <LeafIcon size={14} />
          </span>
          Greenflow
        </div>
        <span className="topbar-crumb">Tổng quan</span>
        <span className={`topbar-status ${connected ? "" : "off"}`}>
          <i />
          {connected ? `Cập nhật ${lastUpdated}` : "Mất kết nối backend"}
        </span>
      </header>

      <div className="page-heading">
        <div>
          <p className="eyebrow">Hệ thống tưới tự động</p>
          <h1>Giám sát khu vườn</h1>
          <p className="subtitle">
            ESP32 Wokwi · Mosquitto MQTT · dữ liệu cảm biến cập nhật mỗi 2 giây.
          </p>
        </div>
      </div>
    </>
  );
}
