"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { type GardenConfigResponse, type SoilType, type Zone, zonesFromConfig } from "../garden-data";
import { fetchGardenConfig } from "../lib/garden-api";
import { ArrowLeftIcon, LeafIcon } from "./icons";
import { GardenSoilPlan } from "./GardenSoilPlan";
import { ZonePhoto } from "./ZonePhoto";
import { ZoneProfileEditor } from "./ZoneProfileEditor";

export function GardenManager() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [soil, setSoil] = useState<SoilType | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

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

  return (
    <main className="manager-shell">
      <header className="manager-topbar">
        <Link className="manager-brand" href="/" onClick={guardNavigation}>
          <span className="brand-mark">
            <LeafIcon size={16} />
          </span>
          <span>
            Green<span>flow</span>
          </span>
        </Link>
        <Link className="ghost-button" href="/" onClick={guardNavigation}>
          <ArrowLeftIcon size={14} />
          Về tổng quan
        </Link>
      </header>

      {loading && (
        <div className="manager-status">
          <div className="status-card">
            <strong>Đang tải khu vườn...</strong>
            <p>Đang lấy danh sách ô trồng từ Backend.</p>
          </div>
        </div>
      )}

      {!loading && (error || !deviceId || !activeZone) && (
        <div className="manager-status">
          <div className="status-card error">
            <strong>Không tải được khu vườn</strong>
            <p>{error ?? "Backend trả về cấu hình không hợp lệ."}</p>
            <button onClick={() => void reload()}>Thử lại</button>
          </div>
        </div>
      )}

      {!loading && !error && deviceId && soil && activeZone && (
        <div className="manager-layout">
          <aside className="manager-rail">
            <p className="nav-label">6 ô trồng</p>
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                className={`manager-rail-item ${zone.id === activeZone.id ? "active" : ""}`}
                onClick={() => selectZone(zone.id)}
              >
                <ZonePhoto zone={zone} className="manager-rail-thumb" />
                <span>
                  <strong>{zone.name}</strong>
                  <small>
                    {zone.id} · {zone.group}
                  </small>
                </span>
              </button>
            ))}
          </aside>

          <section className="manager-main">
            <div className="page-heading manager-heading">
              <p className="eyebrow">Quản lý khu vườn</p>
              <h1>Hồ sơ cây trồng</h1>
              <p className="subtitle">
                Đổi loại cây, ảnh nhận diện và thông tin canh tác cho từng ô trồng.
              </p>
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
        </div>
      )}
    </main>
  );
}
