export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export function backendUrl(path: string): string {
  return `${BACKEND_URL.replace(/\/+$/, "")}${path}`;
}

export function assetUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return backendUrl(path);
}
