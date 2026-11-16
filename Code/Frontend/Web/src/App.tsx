"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useMqtt } from "./hooks/useMqtt";
import { useActivity } from "./hooks/useActivity";
import { useWateredLiters } from "./hooks/useWateredLiters";
import { useWatering } from "./hooks/useWatering";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { WeatherCard } from "./components/WeatherCard";
import { TankCard } from "./components/TankCard";
import { GardenHealthCard } from "./components/GardenHealthCard";
import { PumpControlCard } from "./components/PumpControlCard";
import { GardenBoard } from "./components/GardenBoard";
import { GardenDetailPanel } from "./components/GardenDetailPanel";
import { ZoneAdvicePanel } from "./components/ZoneAdvicePanel";
import { ZoneConfigCard } from "./components/ZoneConfigCard";
import { OverviewTabs } from "./components/OverviewTabs";
import { BackToTop } from "./components/BackToTop";
import { DeviceStatusBanner } from "./components/DeviceStatusBanner";
import { ToastStack } from "./components/ToastStack";
import { EditIcon } from "./components/icons";
import { BACKEND_URL } from "./lib/backend";
import { zoneHref } from "./lib/zone-link";
import { type ToastMessage, type ToastTone } from "./notifications";

export default function App() {
  const searchParams = useSearchParams();
  const [activeZoneId, setActiveZoneId] = useState(searchParams.get("zone") ?? "");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);

  const notify = useCallback((message: string, tone: ToastTone) => {
    const id = ++toastIdRef.current;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const {
    zones,
    soil,
    connected,
    mode,
    temperature,
    humidity,
    rainPercent,
    raining,
    rainThreshold,
    rainWarnThreshold,
    setRainThreshold,
    rainBlock,
    lastUpdated,
    togglePump,
    changeMode,
    toggleWeatherGate,
    reconnect,
    setZoneThreshold,
    configLoading,
    configError,
    deviceId,
    deviceOnline,
    brokerConnected,
    commandVersion,
    tankDistanceCm,
    tankEmpty,
    lastTelemetryAt,
    saveZoneConfig,
  } = useMqtt({
    backendUrl: BACKEND_URL,
    onNotify: notify,
  });

  const {
    events,
    loading: eventsLoading,
    error: eventsError,
  } = useActivity({
    backendUrl: BACKEND_URL,
    deviceId,
    refreshToken: commandVersion,
  });

  const wateredLitersByZone = useWateredLiters(zones);
  const wateringByZone = useWatering(deviceId, commandVersion);
  const selectedZone = zones.find((zone) => zone.id === activeZoneId) ?? zones[0];
  const selectedWatering = selectedZone ? wateringByZone[selectedZone.id] : undefined;

  const handleSelectZone = useCallback((zoneId: string) => {
    setActiveZoneId(zoneId);
    window.history.replaceState(null, "", `/?zone=${encodeURIComponent(zoneId)}`);
  }, []);

  const liveSample =
    selectedZone &&
    selectedZone.online &&
    selectedZone.moisture !== null &&
    lastTelemetryAt !== null
      ? {
          recordedAt: lastTelemetryAt,
          zoneId: selectedZone.id,
          moisture: selectedZone.moisture,
          threshold: selectedZone.threshold,
          stopThreshold: selectedZone.stopThreshold,
          pump: selectedZone.pump,
          temperature,
          humidity,
          rain: rainPercent ?? 0,
          raining,
          mode,
        }
      : null;

  if (configLoading || configError || !selectedZone || !deviceId) {
    return (
      <main className="app-shell">
        <section className="content status-page">
          <div className={`status-card ${configError ? "error" : ""}`}>
            <strong>{configError ? "Không thể tải cấu hình" : "Đang tải cấu hình..."}</strong>
            <p>
              {configError ??
                "Đang tải danh sách khu vườn từ máy chủ..."}
            </p>
            {configError && <button onClick={reconnect}>Thử lại</button>}
          </div>
        </section>
      </main>
    );
  }

  const controlsEnabled = connected && deviceOnline;

  const handleTogglePump = async () => {
    if (!controlsEnabled) {
      notify("Thiết bị tưới đang mất kết nối — chưa gửi được lệnh.", "error");
      return;
    }
    if (tankEmpty) {
      notify("Bồn nước đã cạn — châm thêm nước trước khi bật bơm.", "error");
      return;
    }
    if (mode === "auto") {
      const switched = await changeMode("manual");
      if (!switched) {
        notify("Không chuyển được sang Thủ công nên chưa gửi được lệnh bơm.", "error");
        return;
      }
      notify(
        selectedZone.pump
          ? "Đã dừng bơm và chuyển cả vườn sang Thủ công."
          : "Đã chuyển cả vườn sang Thủ công; tưới tự động tạm dừng.",
        "info",
      );
    }
    togglePump(selectedZone.id);
  };

  const handleToggleIrrigation = () => {
    void handleTogglePump();
  };

  return (
    <main className="app-shell" id="top">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <Sidebar
        connected={connected}
        brokerConnected={brokerConnected}
        deviceOnline={deviceOnline}
        lastUpdated={lastUpdated}
        onReconnect={reconnect}
        activeZone={selectedZone.id}
      />

      <section className="content">
        <Topbar
          connected={connected}
          lastUpdated={lastUpdated}
          mode={mode}
          activeZone={selectedZone.id}
          zones={zones}
          onSelectZone={handleSelectZone}
        />

        <DeviceStatusBanner
          connected={connected}
          brokerConnected={brokerConnected}
          deviceOnline={deviceOnline}
          lastTelemetryAt={lastTelemetryAt}
          onReconnect={reconnect}
        />

        <div className="bento-dashboard">
          {/* CỘT CHÍNH (BÊN TRÁI): Giám sát vườn toàn cảnh */}
          <div className="bento-col-main">
            {/* 1. Môi trường: Thời tiết & Mực nước bồn */}
            <div className="bento-env-row">
              <WeatherCard
                temperature={temperature}
                humidity={humidity}
                raining={raining}
                rainPercent={rainPercent}
                rainThreshold={rainThreshold}
                rainWarnThreshold={rainWarnThreshold}
                rainBlock={rainBlock}
                controlsEnabled={controlsEnabled}
                onChangeRainThreshold={setRainThreshold}
                onToggleWeatherGate={toggleWeatherGate}
              />
              <TankCard
                tankDistanceCm={tankDistanceCm}
                tankEmpty={tankEmpty}
              />
              <GardenHealthCard
                zones={zones}
                mode={mode}
                deviceOnline={deviceOnline}
              />
            </div>

            {/* 2. Sơ đồ các ô trồng trong vườn */}
            <section className="panel bento-garden-card">
              <div className="panel-heading">
                <div>
                  <h2>Sơ đồ các ô trồng</h2>
                  <p>
                    {zones.length} ô trồng · Đang xem: {selectedZone.id} ({selectedZone.name})
                  </p>
                </div>
                <Link className="link-button" href={zoneHref("/garden", selectedZone.id)}>
                  <EditIcon size={14} />
                  Quản lý khu vườn
                </Link>
              </div>
              <div className="bento-garden-wrap">
                <GardenBoard zones={zones} activeZone={selectedZone.id} onSelect={handleSelectZone} />
              </div>
            </section>

            {/* 3. Diễn biến độ ẩm 6 giờ & Hoạt động gần đây */}
            <OverviewTabs
              backendUrl={BACKEND_URL}
              deviceId={deviceId}
              zones={zones}
              selectedZone={selectedZone}
              connected={connected}
              onSelectZone={handleSelectZone}
              liveSample={liveSample}
              events={events}
              eventsLoading={eventsLoading}
              eventsError={eventsError}
            />

            {/* 4. Khuyến nghị tưới đất */}
            <ZoneAdvicePanel
              key={`advice-${selectedZone.id}`}
              deviceId={deviceId}
              zone={selectedZone}
              soil={soil}
              onApply={(input) =>
                saveZoneConfig(selectedZone.id, {
                  threshold: input.threshold,
                  flowLitersPerHour: selectedZone.flowLitersPerHour,
                  targetLiters: selectedZone.targetLiters,
                })
              }
            />
          </div>

          {/* CỘT PHỤ (BÊN PHẢI): Chi tiết ô, bảng điều khiển & thông số nước */}
          <aside className="bento-col-side">
            {/* 1. Chi tiết cây & đất của ô đang chọn */}
            <GardenDetailPanel
              key={`detail-${selectedZone.id}`}
              zone={selectedZone}
              mode={mode}
              soil={soil}
              deviceId={deviceId}
              controlsEnabled={controlsEnabled}
              tankEmpty={tankEmpty}
              onToggleIrrigation={handleToggleIrrigation}
            />

            {/* 2. Bảng điều khiển bơm & Chế độ */}
            <PumpControlCard
              mode={mode}
              selectedZone={selectedZone}
              tankEmpty={tankEmpty}
              controlsEnabled={controlsEnabled}
              onChangeMode={changeMode}
              onTogglePump={handleTogglePump}
              onChangeThreshold={(val) => setZoneThreshold(selectedZone.id, val)}
            />

            {/* 3. Thông số nước tưới chung của vùng */}
            <ZoneConfigCard
              key={`config-${selectedZone.id}`}
              zone={selectedZone}
              wateredLiters={wateredLitersByZone[selectedZone.id] ?? 0}
              lastRun={selectedWatering?.lastRun ?? null}
              todayLiters={selectedWatering?.todayLiters ?? 0}
              todayRuns={selectedWatering?.todayRuns ?? 0}
              wateringLoaded={selectedWatering !== undefined}
              onSave={(input) => saveZoneConfig(selectedZone.id, input)}
            />
          </aside>
        </div>
      </section>

      <BackToTop />
    </main>
  );
}
