"use client";

import { useState, type FormEvent } from "react";
import type { Zone } from "../garden-data";
import type { ZoneConfigInput } from "../hooks/useMqtt";
import { SaveIcon } from "./icons";

type FieldKey = "duration" | "pumpSeconds" | "flowLitersPerHour" | "targetLiters";

const FIELDS: Array<{
  key: FieldKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "duration", label: "Thời lượng mỗi lần", unit: "phút", min: 1, max: 60, step: 1 },
  { key: "pumpSeconds", label: "Chu kỳ bơm", unit: "giây", min: 10, max: 600, step: 10 },
  { key: "flowLitersPerHour", label: "Lưu lượng", unit: "L/giờ", min: 1, max: 200, step: 1 },
  { key: "targetLiters", label: "Mục tiêu nước", unit: "L", min: 0.1, max: 20, step: 0.1 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ZoneConfigCard({
  zone,
  wateredLiters,
  onSave,
}: {
  zone: Zone;
  wateredLiters: number;
  onSave: (input: ZoneConfigInput) => Promise<boolean>;
}) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    duration: String(zone.duration),
    pumpSeconds: String(zone.pumpSeconds),
    flowLitersPerHour: String(zone.flowLitersPerHour),
    targetLiters: String(zone.targetLiters),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cycleLiters = (zone.flowLitersPerHour * zone.pumpSeconds) / 3600;
  const progress = zone.targetLiters > 0
    ? Math.min((wateredLiters / zone.targetLiters) * 100, 100)
    : 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input: ZoneConfigInput = {
      duration: zone.duration,
      pumpSeconds: zone.pumpSeconds,
      flowLitersPerHour: zone.flowLitersPerHour,
      targetLiters: zone.targetLiters,
    };

    for (const field of FIELDS) {
      const parsed = Number(values[field.key].replace(",", "."));
      input[field.key] = Number.isFinite(parsed)
        ? clamp(parsed, field.min, field.max)
        : zone[field.key];
    }

    setSaving(true);
    setError(null);
    const saved = await onSave(input);
    setSaving(false);
    if (!saved) setError("Không lưu được cấu hình. Thử lại sau.");
  };

  return (
    <article className="panel zone-config-card">
      <div className="panel-heading">
        <div>
          <h2>Cấu hình vùng</h2>
          <p>
            {zone.id} · {zone.name} · {zone.method}
          </p>
        </div>
      </div>

      <form className="zone-config-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="config-fields">
          {FIELDS.map((field) => (
            <label key={field.key}>
              <span>
                {field.label} <em>({field.unit})</em>
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={field.min}
                max={field.max}
                step={field.step}
                value={values[field.key]}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
            </label>
          ))}
        </div>

        <p className="config-hint">
          Thông số này dùng để tính lượng nước ước tính trên Web. Ngưỡng tưới vẫn do ESP32
          xử lý qua lệnh MQTT.
        </p>

        {error && <p className="config-error">{error}</p>}

        <button type="submit" className="config-save" disabled={saving}>
          <SaveIcon size={16} />
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
      </form>

      <div className="water-estimate">
        <div>
          <span>Nước đã tưới (ước tính)</span>
          <strong>
            {wateredLiters.toFixed(2)} / {zone.targetLiters.toFixed(2)} L
          </strong>
        </div>
        <div className="progress">
          <i style={{ width: `${progress}%` }} />
        </div>
        <small>
          Ước tính theo thời gian bơm và lưu lượng cấu hình, khoảng {cycleLiters.toFixed(2)}{" "}
          L mỗi chu kỳ {zone.pumpSeconds}s.
        </small>
      </div>
    </article>
  );
}
