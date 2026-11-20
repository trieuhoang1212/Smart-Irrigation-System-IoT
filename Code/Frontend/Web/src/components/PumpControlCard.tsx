"use client";

import type { Zone } from "../garden-data";
import { DropletIcon } from "./icons";
import { Tooltip } from "./Tooltip";

interface PumpControlCardProps {
  mode: "auto" | "manual";
  selectedZone: Zone;
  tankEmpty: boolean;
  controlsEnabled: boolean;
  onChangeMode: (mode: "auto" | "manual") => Promise<boolean>;
  onTogglePump: () => void;
  onChangeThreshold: (val: number) => void;
  onChangeStopThreshold: (val: number) => void;
}

export function PumpControlCard({
  mode,
  selectedZone,
  tankEmpty,
  controlsEnabled,
  onChangeMode,
  onTogglePump,
  onChangeThreshold,
  onChangeStopThreshold,
}: PumpControlCardProps) {
  const offlineReason = "Thiết bị mất kết nối";

  return (
    <article className="panel pump-tile">
      <div className="panel-heading">
        <div>
          <h2>
            Điều khiển bơm
            <Tooltip text="Chế độ áp dụng cho cả vườn. Bấm nút tưới để bật bơm của ô đang chọn ngay lập tức; ở chế độ Tự động, hệ thống sẽ tự chuyển sang Thủ công." />
          </h2>
        </div>
        <span
          className={`live-badge ${
            !controlsEnabled ? "danger" : selectedZone.pump ? "active" : ""
          }`}
        >
          <i />
          {!controlsEnabled
            ? "Mất kết nối"
            : selectedZone.pump
              ? "Đang tưới"
              : "Bơm đang tắt"}
        </span>
      </div>

      <div className="pump-mode">
        <span className="pump-label">Chế độ toàn vườn</span>
        <div className="mode-switch mode-switch-wide" role="group" aria-label="Chế độ tưới">
          <button
            type="button"
            className={mode === "auto" ? "selected" : ""}
            aria-pressed={mode === "auto"}
            onClick={() => void onChangeMode("auto")}
            disabled={!controlsEnabled}
            title={controlsEnabled ? undefined : offlineReason}
          >
            Tự động
          </button>
          <button
            type="button"
            className={mode === "manual" ? "selected" : ""}
            aria-pressed={mode === "manual"}
            onClick={() => void onChangeMode("manual")}
            disabled={!controlsEnabled}
            title={controlsEnabled ? undefined : offlineReason}
          >
            Thủ công
          </button>
        </div>
      </div>

      <button
        type="button"
        className={`water-button pump-action ${selectedZone.pump ? "watering" : ""}`}
        onClick={onTogglePump}
        disabled={tankEmpty || !controlsEnabled}
        aria-label={selectedZone.pump ? "Dừng tưới ô đang chọn" : "Tưới tay ô đang chọn"}
        title={
          tankEmpty
            ? "Bồn nước đã cạn nên bơm bị chặn"
            : !controlsEnabled
              ? offlineReason
              : mode === "auto"
                ? selectedZone.pump
                  ? "Dừng bơm và chuyển cả vườn sang Thủ công"
                  : "Bật bơm ô này (hệ thống sẽ tự chuyển sang Thủ công)"
                : undefined
        }
      >
        <DropletIcon size={16} />
        {selectedZone.pump ? "Dừng tưới" : "Tưới tay ngay"}
      </button>

      {controlsEnabled && (
        <p className="pump-hint">
          {tankEmpty
            ? "Bồn đã cạn — bơm bị chặn để tránh chạy khô."
            : mode === "auto"
              ? "Đang Tự động: tưới tay sẽ chuyển cả vườn sang Thủ công."
              : "Đang Thủ công: hệ thống không tự tưới cho tới khi bạn bật lại Tự động."}
        </p>
      )}

      {mode === "manual" && selectedZone.overTarget && (
        <div className="mode-warning overwater pump-warning" role="status">
          <span>
            {selectedZone.id} đã đủ {selectedZone.targetLiters} L — bơm tự dừng, sau 10 phút
            hệ thống tự về Tự động.
          </span>
        </div>
      )}

      <div className="threshold-control pump-threshold">
        <label htmlFor="threshold">
          Tự tưới khi đất dưới <strong>{selectedZone.threshold}%</strong>
          <Tooltip text="Khi độ ẩm đất trong ô trồng giảm xuống dưới ngưỡng này, hệ thống sẽ tự động bật bơm." />
        </label>
        <input
          id="threshold"
          type="range"
          min="10"
          max="100"
          value={selectedZone.threshold}
          onChange={(event) => onChangeThreshold(Number(event.target.value))}
          disabled={!controlsEnabled}
          title={controlsEnabled ? undefined : offlineReason}
        />
      </div>

      <div className="threshold-control pump-threshold">
        <label htmlFor="stop-threshold">
          Ngừng tưới khi đạt <strong>{selectedZone.stopThreshold}%</strong>
          <Tooltip text="Khi độ ẩm đất đạt ngưỡng này, hệ thống tự đóng van để dừng tưới. Ngưỡng dừng luôn cao hơn ngưỡng bật ít nhất 10%." />
        </label>
        <input
          id="stop-threshold"
          type="range"
          min="10"
          max="100"
          value={selectedZone.stopThreshold}
          onChange={(event) => onChangeStopThreshold(Number(event.target.value))}
          disabled={!controlsEnabled}
          title={controlsEnabled ? undefined : offlineReason}
        />
        <span className="threshold-gap">
          Từ {selectedZone.threshold}% tưới đến {selectedZone.stopThreshold}% (
          {selectedZone.stopThreshold - selectedZone.threshold} điểm)
          {selectedZone.stopThreshold - selectedZone.threshold < 10
            ? " · cần cách ngưỡng bật ít nhất 10 điểm"
            : selectedZone.stopThreshold - selectedZone.threshold === 10
              ? " · sát mức tối thiểu 10 điểm"
              : ""}
        </span>
      </div>
    </article>
  );
}
