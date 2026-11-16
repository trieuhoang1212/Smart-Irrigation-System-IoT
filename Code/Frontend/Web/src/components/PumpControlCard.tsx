"use client";

import type { Zone } from "../garden-data";
import { Tooltip } from "./Tooltip";

interface PumpControlCardProps {
  mode: "auto" | "manual";
  selectedZone: Zone;
  tankEmpty: boolean;
  controlsEnabled: boolean;
  onChangeMode: (mode: "auto" | "manual") => Promise<boolean>;
  onTogglePump: () => void;
  onChangeThreshold: (val: number) => void;
}

export function PumpControlCard({
  mode,
  selectedZone,
  tankEmpty,
  controlsEnabled,
  onChangeMode,
  onTogglePump,
  onChangeThreshold,
}: PumpControlCardProps) {
  const offlineReason = "Thiết bị tưới đang mất kết nối nên lệnh chưa gửi được";

  return (
    <article className="panel control-card pump-control-card">
      <div className="panel-heading">
        <div>
          <h2>Điều khiển bơm & chế độ</h2>
          <p>
            {selectedZone.id} · {selectedZone.name} · tưới khi đất dưới {selectedZone.threshold}%
          </p>
        </div>
        <span className={`live-badge ${selectedZone.pump ? "active" : ""}`}>
          <i />
          {selectedZone.pump ? "Đang tưới" : "Bơm đang tắt"}
        </span>
      </div>

      <div className="mode-row">
        <span>Chế độ toàn vườn</span>
        <div className="mode-switch">
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

      {mode === "manual" && (
        <div className="mode-warning">
          <span>
            Đang Thủ công: hệ thống không tự tưới, lịch tự động tạm dừng cho cả vườn.
          </span>
          <button
            type="button"
            onClick={() => void onChangeMode("auto")}
            disabled={!controlsEnabled}
          >
            Quay lại Tự động
          </button>
        </div>
      )}

      {mode === "manual" && selectedZone.overTarget && (
        <div className="mode-warning overwater" role="status">
          <span>
            {selectedZone.id} đã đủ {selectedZone.targetLiters} L cho lần tưới này — bơm đã tự dừng. Sau 10 phút hệ thống tự về Tự động.
          </span>
        </div>
      )}

      <div className="control-row">
        <div>
          <strong>
            {!controlsEnabled
              ? "Mất kết nối thiết bị"
              : mode === "auto"
                ? "Tưới tự động theo độ ẩm"
                : "Điều khiển tưới bằng tay"}
          </strong>
          <small>
            {!controlsEnabled
              ? "Dữ liệu bên dưới là lần đo cuối; bơm tạm thời không nhận lệnh mới."
              : tankEmpty
                ? "Bồn nước đã cạn — bơm bị chặn để tránh chạy khô"
                : mode === "auto"
                  ? `Tự tưới khi đất < ${selectedZone.threshold}%. Bấm công tắc để tưới tay ngay.`
                  : "Công tắc bật/tắt bơm của khu vực đang chọn."}
          </small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={selectedZone.pump}
          aria-label="Bật tắt bơm khu vực đang chọn"
          className={`big-toggle ${selectedZone.pump ? "on" : ""}`}
          onClick={onTogglePump}
          disabled={tankEmpty || !controlsEnabled}
          title={
            tankEmpty
              ? "Bồn nước đã cạn nên bơm bị chặn"
              : !controlsEnabled
                ? offlineReason
                : mode === "auto"
                  ? selectedZone.pump
                    ? "Dừng bơm và chuyển cả vườn sang Thủ công"
                    : "Bật bơm khu vực này (hệ thống sẽ tự chuyển sang Thủ công)"
                  : undefined
          }
        >
          <i />
        </button>
      </div>

      <div className="threshold-control">
        <label htmlFor="threshold">
          Tưới khi đất dưới <strong>{selectedZone.threshold}%</strong>
          <Tooltip text="Khi độ ẩm đất trong ô trồng giảm xuống dưới ngưỡng này, hệ thống sẽ tự động bật bơm." />
        </label>
        <input
          id="threshold"
          type="range"
          min="10"
          max="90"
          value={selectedZone.threshold}
          onChange={(event) => onChangeThreshold(Number(event.target.value))}
          disabled={!controlsEnabled}
          title={controlsEnabled ? undefined : offlineReason}
        />
        <div>
          <span>10% · khô</span>
          <span>90% · ẩm</span>
        </div>
      </div>

      {!controlsEnabled && (
        <p className="control-note">
          Thiết bị tưới đang mất kết nối — công tắc bơm, chế độ và ngưỡng tạm khoá.
        </p>
      )}
    </article>
  );
}
