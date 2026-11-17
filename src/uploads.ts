import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { config } from "./config.js";

export const uploadDir = resolve(process.cwd(), config.uploadDir);

mkdirSync(uploadDir, { recursive: true });

const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function imageExtension(contentType: string | undefined): string | null {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase();
  return mime ? (IMAGE_EXTENSIONS.get(mime) ?? null) : null;
}

export function saveZonePhotoFile(
  deviceId: string,
  zoneId: string,
  extension: string,
  data: Buffer,
): string {
  const suffix = randomBytes(3).toString("hex");
  const fileName = `${deviceId}-${zoneId}-${Date.now()}-${suffix}.${extension}`;
  writeFileSync(join(uploadDir, fileName), data);
  return fileName;
}

/** Chỉ xoá file nằm trực tiếp trong thư mục upload, tránh path traversal. */
export function removeUploadFile(fileName: string | null): void {
  if (!fileName) return;
  const safeName = basename(fileName);
  if (safeName !== fileName) return;
  try {
    unlinkSync(join(uploadDir, safeName));
  } catch {
    // File đã bị xoá hoặc không còn tồn tại: không cần xử lý thêm.
  }
}
