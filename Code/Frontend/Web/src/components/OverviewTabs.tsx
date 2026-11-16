"use client";

import Link from "next/link";
import { useState } from "react";
import type { Zone } from "../garden-data";
import type { ActivityEvent } from "../hooks/useActivity";
import { HistoryChart } from "./HistoryChart";
import { ActivityFeed } from "./ActivityFeed";
import { ChartIcon, ClockIcon } from "./icons";
import { zoneHref } from "../lib/zone-link";

interface OverviewTabsProps {
  backendUrl: string;
  deviceId: string;
  zones: Zone[];
  selectedZone: Zone;
  connected: boolean;
  onSelectZone: (zoneId: string) => void;
  liveSample: {
    recordedAt: number;
    zoneId: string;
    moisture: number;
    threshold: number;
    stopThreshold: number;
    pump: boolean;
    temperature: number | null;
    humidity: number | null;
    rain: number;
    raining: boolean;
    mode: "auto" | "manual";
  } | null;
  events: ActivityEvent[];
  eventsLoading: boolean;
  eventsError: string | null;
}

export function OverviewTabs({
  backendUrl,
  deviceId,
  zones,
  selectedZone,
  connected,
  onSelectZone,
  liveSample,
  events,
  eventsLoading,
  eventsError,
}: OverviewTabsProps) {
  const [activeTab, setActiveTab] = useState<"chart" | "activity">("chart");

  return (
    <section className="panel overview-panel">
      <div className="panel-heading overview-panel-head">
        <div>
          <div className="overview-tab-switch" role="tablist" aria-label="Lựa chọn bảng thông tin">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "chart"}
              className={`overview-tab-btn ${activeTab === "chart" ? "active" : ""}`}
              onClick={() => setActiveTab("chart")}
            >
              <ChartIcon size={14} />
              <span>Diễn biến 6 giờ</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "activity"}
              className={`overview-tab-btn ${activeTab === "activity" ? "active" : ""}`}
              onClick={() => setActiveTab("activity")}
            >
              <ClockIcon size={14} />
              <span>Hoạt động gần đây</span>
            </button>
          </div>
          <p className="overview-tab-sub">
            {activeTab === "chart"
              ? `${selectedZone.id} · ${selectedZone.name} · Diễn biến độ ẩm đất`
              : "Các thao tác tưới và thay đổi chế độ mới nhất"}
          </p>
        </div>

        {activeTab === "chart" ? (
          <Link className="link-button" href={zoneHref("/history", selectedZone.id)}>
            Xem lịch sử chi tiết
          </Link>
        ) : (
          <Link className="link-button" href={zoneHref("/activity", selectedZone.id)}>
            Xem toàn bộ nhật ký
          </Link>
        )}
      </div>

      <div className="overview-tab-content">
        {activeTab === "chart" ? (
          <HistoryChart
            compact
            backendUrl={backendUrl}
            deviceId={deviceId}
            zones={zones}
            activeZone={selectedZone.id}
            connected={connected}
            onSelectZone={onSelectZone}
            liveSample={liveSample}
          />
        ) : (
          <ActivityFeed
            events={events.slice(0, 5)}
            loading={eventsLoading}
            error={eventsError}
            scroll={false}
          />
        )}
      </div>
    </section>
  );
}
