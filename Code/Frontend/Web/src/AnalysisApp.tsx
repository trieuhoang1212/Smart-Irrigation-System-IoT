"use client";

import { useMemo, useState } from "react";
import { BACKEND_URL } from "./lib/backend";
import { useMqtt } from "./hooks/useMqtt";
import {
  ANALYSIS_RANGES,
  useZoneHistory,
  type AnalysisRange,
} from "./hooks/useZoneHistory";
import {
  analyzeZone,
  formatClock,
  formatDuration,
  type AnalysisSample,
} from "./lib/analysis";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { BackToTop } from "./components/BackToTop";
import { AnalysisChart } from "./components/AnalysisChart";
import { AlertIcon, CheckIcon, InfoIcon } from "./components/icons";

const RING_LENGTH = 2 * Math.PI * 52;

function percent(value: number | null): string {
  return value === null ? "--" : `${Math.round(value)}%`;
}

export function AnalysisApp() {
  const [activeZoneId, setActiveZoneId] = useState("T002");
  const [range, setRange] = useState<AnalysisRange>("24h");

  const {
    zones,
    connected,
    configLoading,
    configError,
    deviceId,
    temperature,
    humidity,
    rainPercent,
    raining,
    rainBlock,
    tankDistanceCm,
    tankEmpty,
    lastUpdated,
    lastTelemetryAt,
    deviceOnline,
    brokerConnected,
    reconnect,
  } = useMqtt({ backendUrl: BACKEND_URL });

  const selectedZone = zones.find((zone) => zone.id === activeZoneId) ?? zones[0];

  const {
    samples,
    loading: historyLoading,
    error: historyError,
  } = useZoneHistory({
    backendUrl: BACKEND_URL,
    deviceId,
    zoneId: selectedZone?.id ?? null,
    range,
    connected,
  });

  const liveSample = useMemo<AnalysisSample | null>(() => {
    if (!selectedZone || !selectedZone.online || selectedZone.moisture === null) return null;
    if (lastTelemetryAt === null) return null;

    return {
      recordedAt: lastTelemetryAt,
      moisture: selectedZone.moisture,
      threshold: selectedZone.threshold,
      stopThreshold: selectedZone.stopThreshold,
      pump: selectedZone.pump,
      temperature,
      humidity,
      rain: rainPercent ?? 0,
      raining,
    };
  }, [selectedZone, lastTelemetryAt, temperature, humidity, rainPercent, raining]);

  const series = useMemo(() => {
    if (!liveSample) return samples;
    if (samples.length === 0) return [liveSample];
    const last = samples[samples.length - 1];
    return liveSample.recordedAt > last.recordedAt ? [...samples, liveSample] : samples;
  }, [samples, liveSample]);

  const analysis = useMemo(() => {
    if (!selectedZone) return null;
    return analyzeZone({
      samples: series,
      zone: selectedZone,
      tankDistanceCm,
      tankEmpty,
      rainBlock,
    });
  }, [series, selectedZone, tankDistanceCm, tankEmpty, rainBlock]);

  if (configLoading || configError || !selectedZone || !deviceId || !analysis) {
    return (
      <main className="app-shell">
        <section className="content status-page">
          <div className={`status-card ${configError ? "error" : ""}`}>
            <strong>{configError ? "Không thể tải cấu hình" : "Đang tải cấu hình..."}</strong>
            <p>
              {configError ??
                "Đang lấy danh sách khu vực và device ID từ Backend."}
            </p>
            {configError && <button onClick={reconnect}>Thử lại</button>}
          </div>
        </section>
      </main>
    );
  }

  const StatusIcon =
    analysis.status === "good"
      ? CheckIcon
      : analysis.status === "risk"
        ? AlertIcon
        : InfoIcon;

  return (
    <main className="app-shell" id="top">
      <Sidebar
        active="analysis"
        connected={connected}
        brokerConnected={brokerConnected}
        deviceOnline={deviceOnline}
        lastUpdated={lastUpdated}
        onReconnect={reconnect}
      />

      <section className="content">
        <Topbar
          active="analysis"
          crumb="Phân tích cây trồng"
          eyebrow="Chẩn đoán khu vườn"
          title="Phân tích cây trồng"
          subtitle="Đánh giá độ ẩm, thời tiết và nguồn nước để biết cây có ổn không."
          connected={connected}
          lastUpdated={lastUpdated}
        />

        {!connected && (
          <div className="offline-banner">
            <span>!</span>
            <div>
              <strong>Backend chưa kết nối</strong>
              <small>Đang hiển thị dữ liệu lịch sử đã lưu, chưa có cập nhật trực tiếp.</small>
            </div>
            <button onClick={reconnect}>Kết nối lại</button>
          </div>
        )}

        <div className="analysis-zone-bar" role="tablist" aria-label="Chọn vùng trồng">
          <span className="analysis-zone-label">Vùng trồng</span>
          {zones.map((zone) => (
            <button
              key={zone.id}
              type="button"
              role="tab"
              aria-selected={zone.id === selectedZone.id}
              className={`zone-pill ${zone.id === selectedZone.id ? "active" : ""}`}
              onClick={() => setActiveZoneId(zone.id)}
            >
              <i style={{ background: zone.color }} />
              {zone.name}
              <small>{percent(zone.moisture)}</small>
            </button>
          ))}
        </div>

        <section className={`panel analysis-verdict ${analysis.status}`}>
          <div className="verdict-main">
            <p className="verdict-kicker">
              <StatusIcon size={14} />
              Kết luận cho {selectedZone.id} · {selectedZone.name}
            </p>
            <h2 className="verdict-title">{analysis.headline}</h2>
            <p className="verdict-summary">{analysis.summary}</p>
            <div className="verdict-meta">
              <span>
                Độ ẩm hiện tại <strong>{percent(analysis.stats.currentMoisture)}</strong>
              </span>
              <span>
                Vùng an toàn{" "}
                <strong>
                  {Math.round(analysis.safeLow)}–{Math.round(analysis.safeHigh)}%
                </strong>
              </span>
              <span>
                Mẫu gần nhất{" "}
                <strong>
                  {analysis.stats.lastSampleAt
                    ? formatClock(analysis.stats.lastSampleAt)
                    : "--"}
                </strong>
              </span>
            </div>
          </div>

          <div className="verdict-score">
            <div className={`score-ring-wrap ${analysis.status}`}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className="score-ring-track" cx="60" cy="60" r="52" />
                {analysis.score !== null && (
                  <circle
                    className="score-ring-value"
                    cx="60"
                    cy="60"
                    r="52"
                    style={{
                      strokeDasharray: `${(analysis.score / 100) * RING_LENGTH} ${RING_LENGTH}`,
                    }}
                  />
                )}
              </svg>
              <div className="score-ring-label">
                <strong>{analysis.score === null ? "--" : analysis.score}</strong>
                <small>/100</small>
              </div>
            </div>

            <div className="score-bars">
              {analysis.components.length === 0 && (
                <p className="score-bars-empty">Chưa đủ dữ liệu để chấm điểm.</p>
              )}
              {analysis.components.map((component) => (
                <div key={component.key} className="score-bar">
                  <div className="score-bar-head">
                    <span>{component.label}</span>
                    <strong>
                      {component.score}/{component.max}
                    </strong>
                  </div>
                  <div className="score-bar-track">
                    <i
                      style={{
                        width: `${(component.score / component.max) * 100}%`,
                      }}
                    />
                  </div>
                  <small>{component.note}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel analysis-chart-panel">
          <div className="panel-heading analysis-chart-head">
            <div>
              <h2>Diễn biến độ ẩm đất</h2>
              <p>
                {selectedZone.id} · {selectedZone.name} · {ANALYSIS_RANGES[range].label}{" "}
                gần nhất · {series.length} điểm dữ liệu
              </p>
            </div>
            <div className="analysis-chart-controls">
              <span className="analysis-legend">
                <i className="legend-band" /> Vùng an toàn
              </span>
              <span className="analysis-legend">
                <i className="legend-pump" /> Bơm chạy
              </span>
              <div className="view-switch">
                {(Object.keys(ANALYSIS_RANGES) as AnalysisRange[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={range === key ? "selected" : ""}
                    onClick={() => setRange(key)}
                  >
                    {ANALYSIS_RANGES[key].label}
                  </button>
                ))}
              </div>
              <span className="analysis-scroll-hint">Vuốt ngang biểu đồ</span>
            </div>
          </div>

          <AnalysisChart
            samples={series}
            threshold={analysis.safeLow}
            stopThreshold={analysis.safeHigh}
            range={range}
            loading={historyLoading}
            error={historyError}
          />

          <div className="analysis-chart-stats">
            <span>
              Thấp nhất <strong>{percent(analysis.stats.minMoisture)}</strong>
            </span>
            <span>
              Trung bình <strong>{percent(analysis.stats.avgMoisture)}</strong>
            </span>
            <span>
              Cao nhất <strong>{percent(analysis.stats.maxMoisture)}</strong>
            </span>
            <span className={`analysis-chart-status ${historyError ? "error" : ""}`}>
              {historyLoading
                ? "Đang cập nhật..."
                : historyError ?? "Cập nhật mỗi 30 giây"}
            </span>
          </div>
        </section>

        <div className="analysis-grid">
          <section className="panel analysis-facts">
            <div className="panel-heading">
              <div>
                <h2>Chỉ số trong {ANALYSIS_RANGES[range].label}</h2>
                <p>Tổng hợp từ {analysis.stats.samples} mẫu telemetry</p>
              </div>
            </div>
            <div className="fact-grid">
              <div className="fact">
                <span>Trong vùng an toàn</span>
                <strong>{percent(analysis.stats.inSafePct)}</strong>
              </div>
              <div className="fact">
                <span>Khô liên tục dài nhất</span>
                <strong>{formatDuration(analysis.stats.longestDryMs)}</strong>
              </div>
              <div className="fact">
                <span>Số lần bơm chạy</span>
                <strong>{analysis.stats.pumpStarts}</strong>
              </div>
              <div className="fact">
                <span>Độ ẩm trung bình</span>
                <strong>{percent(analysis.stats.avgMoisture)}</strong>
              </div>
              <div className="fact">
                <span>Lần tưới gần nhất</span>
                <strong>
                  {analysis.stats.lastPumpAt
                    ? formatClock(analysis.stats.lastPumpAt)
                    : "Chưa có"}
                </strong>
              </div>
              <div className="fact">
                <span>Bồn nước</span>
                <strong>
                  {tankEmpty
                    ? "Đã cạn"
                    : tankDistanceCm === null
                      ? "Chưa rõ"
                      : `Còn nước · ${Math.round(tankDistanceCm)} cm`}
                </strong>
              </div>
            </div>
          </section>

          <section className="panel analysis-advice">
            <div className="panel-heading">
              <div>
                <h2>Gợi ý chăm sóc</h2>
                <p>Dựa trên ngưỡng cấu hình và dữ liệu cảm biến</p>
              </div>
            </div>
            <ul>
              {analysis.advice.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <p className="analysis-note">
          Điểm sức khỏe là đánh giá tham khảo theo ngưỡng tưới, nhiệt độ và nguồn nước —
          không thay thế quan sát trực tiếp của người trồng.
        </p>
      </section>

      <BackToTop />
    </main>
  );
}
