import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { config } from "./config.js";

export const uploadDir = resolve(process.cwd(), config.uploadDir);

mkdirSync(uploadDir, { recursive: true });

const cloudinaryEnabled = Boolean(
  config.cloudinaryCloudName &&
    config.cloudinaryApiKey &&
    config.cloudinaryApiSecret,
);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
  });
}

const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function imageExtension(contentType: string | undefined): string | null {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase();
  return mime ? (IMAGE_EXTENSIONS.get(mime) ?? null) : null;
}

function cloudinaryPublicId(deviceId: string, zoneId: string): string {
  const safeDeviceId = deviceId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `smart-irrigation/${safeDeviceId}/${zoneId}`;
}

export async function saveZonePhotoFile(
  deviceId: string,
  zoneId: string,
  extension: string,
  data: Buffer,
): Promise<string> {
  if (cloudinaryEnabled) {
    const result = await new Promise<{ secure_url: string }>((resolveUpload, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: "smart-irrigation",
          public_id: cloudinaryPublicId(deviceId, zoneId).replace("smart-irrigation/", ""),
          overwrite: true,
          resource_type: "image",
          format: extension,
        },
        (error, uploaded) => {
          if (error || !uploaded?.secure_url) {
            reject(error ?? new Error("Cloudinary did not return an image URL"));
            return;
          }
          resolveUpload({ secure_url: uploaded.secure_url });
        },
      );
      upload.end(data);
    });
    return result.secure_url;
  }

  const suffix = randomBytes(3).toString("hex");
  const fileName = `${deviceId}-${zoneId}-${Date.now()}-${suffix}.${extension}`;
  writeFileSync(join(uploadDir, fileName), data);
  return fileName;
}

/** Chỉ xoá file nằm trực tiếp trong thư mục upload, tránh path traversal. */
export async function removeUploadFile(fileName: string | null): Promise<void> {
  if (!fileName) return;
  if (fileName.startsWith("http://") || fileName.startsWith("https://")) return;
  const safeName = basename(fileName);
  if (safeName !== fileName) return;
  try {
    unlinkSync(join(uploadDir, safeName));
  } catch {
    // File đã bị xoá hoặc không còn tồn tại: không cần xử lý thêm.
  }
}

export async function removeCloudinaryZonePhoto(
  deviceId: string,
  zoneId: string,
  photoUrl: string | null,
): Promise<void> {
  if (!cloudinaryEnabled || !photoUrl?.startsWith("http")) return;
  await cloudinary.uploader.destroy(cloudinaryPublicId(deviceId, zoneId), {
    resource_type: "image",
  });
}
