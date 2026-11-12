"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { CROP_GROUPS, SOIL_TYPES, type CropGroup, type SoilType, type Zone } from "../garden-data";
import { deleteZonePhoto, saveZoneProfile, uploadZonePhoto } from "../lib/garden-api";
import { compressImage } from "../lib/image";
import { fromDateInput, harvestDate, toDateInput } from "../lib/zone-date";
import { SaveIcon, TrashIcon, UploadIcon } from "./icons";
import { ZonePhoto } from "./ZonePhoto";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function initialGroup(zone: Zone): CropGroup {
  return CROP_GROUPS.includes(zone.group as CropGroup) ? (zone.group as CropGroup) : "Khác";
}

export function ZoneProfileEditor({
  zone,
  deviceId,
  onZoneChange,
  onDirtyChange,
}: {
  zone: Zone;
  deviceId: string;
  onZoneChange: (zoneId: string, patch: Partial<Zone>) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [name, setName] = useState(zone.name);
  const [crop, setCrop] = useState(zone.crop);
  const [group, setGroup] = useState<CropGroup>(initialGroup(zone));
  const [soil, setSoil] = useState<SoilType>(zone.soil);
  const [plantedDate, setPlantedDate] = useState(toDateInput(zone.plantedAt));
  const [harvestDays, setHarvestDays] = useState(
    zone.harvestDays === null ? "" : String(zone.harvestDays),
  );
  const [notes, setNotes] = useState(zone.notes);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const baselineHarvest = zone.harvestDays === null ? "" : String(zone.harvestDays);
  const dirty =
    name.trim() !== zone.name ||
    crop.trim() !== zone.crop ||
    group !== initialGroup(zone) ||
    soil !== zone.soil ||
    fromDateInput(plantedDate) !== zone.plantedAt ||
    harvestDays.trim() !== baselineHarvest ||
    notes.trim() !== zone.notes;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const expectedHarvest = harvestDate(fromDateInput(plantedDate), Number(harvestDays) || null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Tên cây trồng không được để trống.");
      return;
    }

    const parsedHarvest = Number(harvestDays);
    if (
      harvestDays.trim() !== "" &&
      (!Number.isInteger(parsedHarvest) || parsedHarvest < 1 || parsedHarvest > 365)
    ) {
      setError("Số ngày thu hoạch phải là số nguyên từ 1 đến 365.");
      return;
    }

    const input = {
      name: trimmedName,
      crop: crop.trim(),
      group,
      soil,
      plantedAt: fromDateInput(plantedDate),
      harvestDays: harvestDays.trim() === "" ? null : parsedHarvest,
      notes: notes.trim(),
    };

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveZoneProfile(deviceId, zone.id, input);
      onZoneChange(zone.id, input);
      setName(input.name);
      setCrop(input.crop);
      setNotes(input.notes);
      setPlantedDate(toDateInput(input.plantedAt));
      setHarvestDays(input.harvestDays === null ? "" : String(input.harvestDays));
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được hồ sơ cây trồng.");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.");
      return;
    }

    setUploading(true);
    setError(null);
    setSaved(false);
    try {
      const compressed = await compressImage(file);
      const photoUrl = await uploadZonePhoto(deviceId, zone.id, compressed);
      onZoneChange(zone.id, { photoUrl });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải ảnh lên được.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm("Xoá ảnh của ô trồng này? Bạn có thể tải ảnh mới sau.")) return;
    setRemovingPhoto(true);
    setError(null);
    setSaved(false);
    try {
      await deleteZonePhoto(deviceId, zone.id);
      onZoneChange(zone.id, { photoUrl: null });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xoá được ảnh.");
    } finally {
      setRemovingPhoto(false);
    }
  };

  return (
    <article className="panel manager-card">
      <div className="manager-card-head">
        <div>
          <span className="zone-tag">{zone.id}</span>
          <h2>{zone.name}</h2>
        </div>
        <span className="manager-card-hint">Ảnh và thông tin hiển thị trên trang tổng quan</span>
      </div>

      <div className="manager-photo">
        <ZonePhoto zone={zone} className="manager-photo-preview" />
        <div className="manager-photo-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => void handlePhotoChange(event)}
          />
          <button
            type="button"
            className="primary-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || removingPhoto}
          >
            <UploadIcon size={15} />
            {uploading ? "Đang tải ảnh..." : zone.photoUrl ? "Thay ảnh" : "Tải ảnh lên"}
          </button>
          {zone.photoUrl && (
            <button
              type="button"
              className="ghost-button danger"
              onClick={() => void handleRemovePhoto()}
              disabled={uploading || removingPhoto}
            >
              <TrashIcon size={14} />
              {removingPhoto ? "Đang xoá..." : "Xoá ảnh"}
            </button>
          )}
          <p className="manager-hint">
            Ảnh được nén tự động (tối đa 1280px) trước khi lưu trên Backend.
          </p>
        </div>
      </div>

      <form className="manager-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="manager-fields">
          <label className="field">
            <span>Tên cây trồng</span>
            <input
              value={name}
              maxLength={60}
              required
              placeholder="Ví dụ: Cà chua"
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Nhóm cây</span>
            <select value={group} onChange={(event) => setGroup(event.target.value as CropGroup)}>
              {CROP_GROUPS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Loại đất</span>
            <select value={soil} onChange={(event) => setSoil(event.target.value as SoilType)}>
              {SOIL_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field field-wide">
            <span>Đặc điểm / mô tả ngắn</span>
            <input
              value={crop}
              maxLength={160}
              placeholder="Ví dụ: Ưa ẩm, tránh nứt quả"
              onChange={(event) => setCrop(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Ngày trồng</span>
            <input
              type="date"
              value={plantedDate}
              onChange={(event) => setPlantedDate(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Số ngày đến thu hoạch</span>
            <input
              type="number"
              min={1}
              max={365}
              step={1}
              value={harvestDays}
              placeholder="Ví dụ: 60"
              onChange={(event) => setHarvestDays(event.target.value)}
            />
          </label>

          <p className="manager-hint field-wide">
            {expectedHarvest
              ? `Dự kiến thu hoạch: ${expectedHarvest}`
              : "Nhập ngày trồng và số ngày để tính ngày thu hoạch dự kiến."}
          </p>

          {zone.growth && (
            <p className="manager-hint field-wide">
              Giai đoạn hiện tại: {zone.growth.label} · ngày {zone.growth.day}/
              {zone.growth.totalDays}
              {zone.growth.overdueDays > 0 ? ` · trễ ${zone.growth.overdueDays} ngày` : ""}
            </p>
          )}

          <label className="field field-wide">
            <span>Ghi chú</span>
            <textarea
              rows={3}
              maxLength={500}
              value={notes}
              placeholder="Chăm sóc, sâu bệnh, phân bón..."
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>

        <div className="manager-form-footer">
          <p className={`manager-hint ${dirty ? "dirty" : ""}`}>
            {dirty
              ? "Có thay đổi chưa lưu."
              : "Thay đổi này chỉ cập nhật hồ sơ cây trồng; ngưỡng tưới chỉnh ở trang tổng quan."}
          </p>
          <button type="submit" className="primary-button" disabled={saving || uploading}>
            <SaveIcon size={15} />
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}
        {saved && <p className="form-success">Đã lưu hồ sơ cây trồng.</p>}
      </form>
    </article>
  );
}
