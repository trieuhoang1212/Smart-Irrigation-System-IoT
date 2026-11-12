export function formatDate(timestamp: number | null): string {
  if (timestamp === null) return "Chưa cập nhật";
  return new Date(timestamp).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function harvestDate(
  plantedAt: number | null,
  harvestDays: number | null,
): string | null {
  if (plantedAt === null || harvestDays === null) return null;
  return formatDate(plantedAt + harvestDays * 24 * 60 * 60 * 1000);
}

export function toDateInput(timestamp: number | null): string {
  if (timestamp === null) return "";
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromDateInput(value: string): number | null {
  if (!value) return null;
  const timestamp = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}
