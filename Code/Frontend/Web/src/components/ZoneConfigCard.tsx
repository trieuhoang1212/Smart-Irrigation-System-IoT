"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Zone } from "../garden-data";
import type { ZoneConfigInput } from "../hooks/useMqtt";
import type { WateringRunSummary } from "../lib/garden-api";
import { SaveIcon } from "./icons";
import { Tooltip } from "./Tooltip";

type FieldKey = "flowLitersPerHour" | "targetLiters";

type Field = {
  key: FieldKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  hint: string;
  integer?: boolean;
};

const FIELDS: Field[] = [
  {
    key: "flowLitersPerHour",
    label: "Lưu lượng bơm",
    unit: "L/giờ",
    min: 1,
    max: 200,
    hint: "Số nguyên; càng lớn thì độ ẩm lên càng nhanh",
    integer: true,
  },
  {
    key: "targetLiters",
    label: "Nước mỗi lần tưới",
    unit: "L",
    min: 0.1,
    max: 20,
    hint: "Lượng nước mong muốn cho một lần tưới",
  },
];

// Firmware chỉ chạy trong khoảng 10 giây - 10 phút mỗi lần.
const MIN_RUNTIME_SECONDS = 10;
const MAX_RUNTIME_MINUTES = 10;

type ParsedField = { value: number | null; error: string | null };

function parseField(field: Field, raw: string): ParsedField {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return { value: null, error: "Không được để trống." };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return { value: null, error: "Chỉ nhập số." };
  if (field.integer && !Number.isInteger(parsed)) {
    return { value: null, error: "Chỉ nhập số nguyên." };
  }
  if (parsed < field.min || parsed > field.max) {
    return {
      value: null,
      error: `Nhập từ ${formatNumber(field.min, 2)} đến ${formatNumber(field.max, 2)} ${field.unit}.`,
    };
  }

  return { value: parsed, error: null };
}

function formatNumber(value: number, digits: number) {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

function formatLiters(value: number) {
  return formatNumber(value, value >= 10 ? 1 : 2);
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${formatNumber(minutes, 1)} phút`;
  return `${formatNumber(minutes / 60, 1)} giờ`;
}

function formatClock(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ZoneConfigCard({
  zone,
  wateredLiters,
  lastRun,
  todayLiters,
  todayRuns,
  wateringLoaded,
  onSave,
}: {
  zone: Zone;
  wateredLiters: number;
  lastRun: WateringRunSummary | null;
  todayLiters: number;
  todayRuns: number;
  wateringLoaded: boolean;
  onSave: (input: ZoneConfigInput) => Promise<boolean>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [values, setValues] = useState<Record<FieldKey, string>>({
    flowLitersPerHour: String(zone.flowLitersPerHour),
    targetLiters: String(zone.targetLiters),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues({
      flowLitersPerHour: String(zone.flowLitersPerHour),
      targetLiters: String(zone.targetLiters),
    });
  }, [zone.id, zone.flowLitersPerHour, zone.targetLiters]);

  const parsed = Object.fromEntries(
    FIELDS.map((field) => [field.key, parseField(field, values[field.key])]),
  ) as Record<FieldKey, ParsedField>;

  const invalidFields = FIELDS.filter((field) => parsed[field.key].error);
  const flow = parsed.flowLitersPerHour.value;
  const target = parsed.targetLiters.value;
  const canCalculate = flow !== null && target !== null;

  const maxLiters = canCalculate ? (flow * MAX_RUNTIME_MINUTES) / 60 : null;
  const minutesToTarget = canCalculate ? (target / flow) * 60 : null;

  let verdict: string | null = null;
  let verdictTone: "ok" | "warn" = "ok";

  if (flow !== null && target !== null && minutesToTarget !== null && maxLiters !== null) {
    if (minutesToTarget > MAX_RUNTIME_MINUTES) {
      verdictTone = "warn";
      verdict = `Cần khoảng ${formatDuration(minutesToTarget)} mới đủ ${formatLiters(target)} L, nhưng hệ thống dừng tối đa ${MAX_RUNTIME_MINUTES} phút mỗi lần. Hạ lượng nước còn khoảng ${formatLiters(maxLiters)} L hoặc chia làm nhiều lần.`;
    } else if (minutesToTarget * 60 < MIN_RUNTIME_SECONDS) {
      verdictTone = "warn";
      verdict = `Mỗi lần chỉ chạy khoảng ${formatNumber(minutesToTarget * 60, 1)} giây — ngắn hơn mức tối thiểu ${MIN_RUNTIME_SECONDS} giây của hệ thống.`;
    } else {
      verdict = `Đủ ${formatLiters(target)} L sau khoảng ${formatDuration(minutesToTarget)} — trong giới hạn ${MAX_RUNTIME_MINUTES} phút mỗi lần.`;
    }
  }

  const progress = zone.targetLiters > 0
    ? Math.min((wateredLiters / zone.targetLiters) * 100, 100)
    : 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (flow === null || target === null) {
      setError("Có ô chưa hợp lệ — sửa theo ghi chú dưới ô nhập rồi lưu lại.");
      return;
    }
    if (minutesToTarget !== null && minutesToTarget > MAX_RUNTIME_MINUTES) {
      setError(`Lượng nước này cần hơn ${MAX_RUNTIME_MINUTES} phút mỗi lần. Hạ lượng nước hoặc tăng lưu lượng trước khi lưu.`);
      return;
    }
    if (minutesToTarget !== null && minutesToTarget * 60 < MIN_RUNTIME_SECONDS) {
      setError(`Mỗi lần chạy dưới ${MIN_RUNTIME_SECONDS} giây. Tăng lượng nước hoặc giảm lưu lượng trước khi lưu.`);
      return;
    }

    setSaving(true);
    setError(null);
    const saved = await onSave({
      flowLitersPerHour: flow,
      targetLiters: target,
    });
    setSaving(false);
    if (!saved) setError("Không lưu được cấu hình. Thử lại sau.");
  };

  return (
    <article className="panel zone-config-card">
      <div className="panel-heading">
        <div>
          <h2>
            Lượng nước tưới
            <Tooltip text="Thống kê nước đã tưới hôm nay và cấu hình lưu lượng, mục tiêu nước mỗi lần tưới. Số liệu tổng hợp từ lịch sử bơm bật/tắt." />
          </h2>
          <p>
            {zone.id} · {zone.name} · {zone.method}
          </p>
        </div>
      </div>

      <div className="water-column">
        <div className="water-history">
          <div>
            <span>Lần tưới gần nhất</span>
            <strong>
              {!wateringLoaded
                ? "Đang tải..."
                : lastRun
                  ? `${formatLiters(lastRun.liters)} L · ${formatClock(lastRun.endedAt)}`
                  : "Chưa có lần tưới nào"}
            </strong>
          </div>
          <div>
            <span>Hôm nay</span>
            <strong>
              {!wateringLoaded
                ? "Đang tải..."
                : `${formatLiters(todayLiters)} L · ${todayRuns} lần`}
            </strong>
          </div>
        </div>

        {zone.pump ? (
          <div className="water-estimate">
            <div>
              <span>Đang tưới (ước tính)</span>
              <strong>
                {wateredLiters.toFixed(2)} / {zone.targetLiters.toFixed(2)} L
              </strong>
            </div>
            <div className="progress">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="config-accordion-section">
        <button
          type="button"
          className="config-accordion-toggle"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
        >
          <span>Lưu lượng & mục tiêu tưới</span>
          <small>{isExpanded ? "Thu gọn ▲" : "Tùy chỉnh ▼"}</small>
        </button>

        {isExpanded && (
          <form className="zone-config-form" onSubmit={(event) => void handleSubmit(event)}>
            <p className="config-role">
              Hệ thống tưới khi ẩm dưới {zone.threshold}% và tự dừng khi đạt {zone.stopThreshold}% ở chế độ Tự động. Hai số dưới đây dùng để tính lượng nước và thời gian tự dừng.
            </p>

            <div className="config-fields">
              {FIELDS.map((field) => {
                const state = parsed[field.key];
                return (
                  <label key={field.key}>
                    <span>
                      {field.label} <em>({field.unit})</em>
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={values[field.key]}
                      aria-invalid={state.error ? true : undefined}
                      onChange={(event) => {
                        const next = event.target.value;
                        setValues((current) => ({ ...current, [field.key]: next }));
                        setError(null);
                      }}
                    />
                    {state.error ? (
                      <small className="config-field-error">{state.error}</small>
                    ) : (
                      <small className="config-field-hint">{field.hint}</small>
                    )}
                  </label>
                );
              })}
            </div>

            {flow !== null &&
              target !== null &&
              maxLiters !== null &&
              minutesToTarget !== null &&
              verdict && (
              <div className="config-preview" aria-live="polite">
                <div className="config-preview-row">
                  <span>Tối đa mỗi lần (chốt an toàn {MAX_RUNTIME_MINUTES} phút) ≈</span>
                  <strong>{formatLiters(maxLiters)} L</strong>
                </div>
                <div className="config-preview-row">
                  <span>Đủ {formatLiters(target)} L cần khoảng</span>
                  <strong>{formatDuration(minutesToTarget)}</strong>
                </div>
                <p className={`config-verdict ${verdictTone}`}>{verdict}</p>
              </div>
            )}

            <div className="config-feedback">
              <p className="config-hint">
                {invalidFields.length > 0
                  ? "Sửa các ô báo lỗi để xem kết quả tính."
                  : `Tưới khi đất dưới ${zone.threshold}%, dừng ở ${zone.stopThreshold}%, tối đa ${MAX_RUNTIME_MINUTES} phút/lần.`}
              </p>
              {error && (
                <p className="config-error" role="alert">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="config-save"
              disabled={saving || invalidFields.length > 0}
            >
              <SaveIcon size={16} />
              {saving ? "Đang lưu..." : "Lưu cấu hình"}
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
