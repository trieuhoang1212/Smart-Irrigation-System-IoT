"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { type GardenConfigResponse, type SoilType, type Zone, zonesFromConfig } from "../garden-data";
import { BACKEND_URL } from "../lib/backend";
import { fetchGardenConfig } from "../lib/garden-api";
import { useMqtt } from "../hooks/useMqtt";
import { BackToTop } from "./BackToTop";
import { GardenSoilPlan } from "./GardenSoilPlan";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ZoneProfileEditor } from "./ZoneProfileEditor";

export function GardenManager() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [soil, setSoil] = useState<SoilType | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const {
    connected,
    deviceOnline,
    brokerConnected,
    lastUpdated,
    reconnect,
  } = useMqtt({ backendUrl: BACKEND_URL });

  const applyConfig = useCallback((config: GardenConfigResponse) => {
    const nextZones = zonesFromConfig(config);
    const requested = new URLSearchParams(window.location.search).get("zone");
    setDeviceId(config.deviceId);
    setSoil(config.soil);
    setZones(nextZones);
    setActiveZoneId((current) => {
      if (current && nextZones.some((zone) => zone.id === current)) return current;
      if (requested && nextZones.some((zone) => zone.id === requested)) return requested;
      return nextZones[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchGardenConfig()
      .then((config) => {
        if (!cancelled) applyConfig(config);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Không tải được cấu hình khu vườn.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyConfig]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      applyConfig(await fetchGardenConfig());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được cấu hình khu vườn.");
    } finally {
      setLoading(false);
    }
  };

  const activeZone = zones.find((zone) => zone.id === activeZoneId) ?? zones[0];

  const confirmDiscard = () =>
    !dirty || window.confirm("Bỏ các thay đổi chưa lưu của ô trồng này?");

  const guardNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!confirmDiscard()) event.preventDefault();
  };

  const selectZone = (zoneId: string) => {
    if (zoneId === activeZoneId) return;
    if (!confirmDiscard()) return;
    setDirty(false);
    setActiveZoneId(zoneId);
    window.history.replaceState(null, "", `/garden?zone=${zoneId}`);
  };

  const handleZoneChange = (zoneId: string, patch: Partial<Zone>) => {
    setZones((current) =>
      current.map((zone) => (zone.id === zoneId ? { ...zone, ...patch } : zone)),
    );
  };

  if (loading) {
    return (
      <main className="app-shell">
        <section className="content status-page">
          <div className="status-card">
            <strong>Đang tải khu vườn...</strong>
            <p>Đang lấy danh sách ô trồng từ Backend.</p>
          </div>
        </section>
      </main>
    );
  }

  if (error || !deviceId || !soil || !activeZone) {
    return (
      <main className="app-shell">
        <section className="content status-page">
          <div className="status-card error">
            <strong>Không tải được khu vườn</strong>
            <p>{error ?? "Backend trả về cấu hình không hợp lệ."}</p>
            <button onClick={() => void reload()}>Thử lại</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell" id="top">
      <Sidebar
        active="garden"
        connected={connected}
        brokerConnected={brokerConnected}
        deviceOnline={deviceOnline}
        lastUpdated={lastUpdated}
        onReconnect={reconnect}
        onNavigate={guardNavigation}
      />

      <section className="content">
        <Topbar
          active="garden"
          crumb="Quản lý khu vườn"
          eyebrow="Hồ sơ cây trồng"
          title="Quản lý khu vườn"
          subtitle="Đổi loại cây, ảnh nhận diện và thông tin canh tác cho từng ô trồng."
          connected={connected}
          lastUpdated={lastUpdated}
          onNavigate={guardNavigation}
        />

        {!connected && (
          <div className="offline-banner">
            <span>!</span>
            <div>
              <strong>Backend chưa kết nối</strong>
              <small>Thay đổi chỉ lưu được sau khi kết nối lại.</small>
            </div>
            <button onClick={reconnect}>Kết nối lại</button>
          </div>
        )}

        <div className="analysis-zone-bar" role="tablist" aria-label="Chọn ô trồng">
          <span className="analysis-zone-label">Ô trồng</span>
          {zones.map((zone) => (
            <button
              key={zone.id}
              type="button"
              role="tab"
              aria-selected={zone.id === activeZone.id}
              className={`zone-pill ${zone.id === activeZone.id ? "active" : ""}`}
              onClick={() => selectZone(zone.id)}
            >
              <i style={{ background: zone.color }} />
              {zone.name}
              <small>{zone.id}</small>
            </button>
          ))}
        </div>

        <GardenSoilPlan deviceId={deviceId} initialSoil={soil} />

        <ZoneProfileEditor
          key={activeZone.id}
          zone={activeZone}
          deviceId={deviceId}
          onZoneChange={handleZoneChange}
          onDirtyChange={setDirty}
        />
      </section>

      <BackToTop />
    </main>
  );
}
