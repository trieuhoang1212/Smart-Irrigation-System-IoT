const ZONE_PATTERN = /^T00[1-6]$/;

export type SyncParams = {
  at: number | null;
  zone: string | null;
};

export function parseSyncParams(search: { get(key: string): string | null }): SyncParams {
  const at = Number(search.get("at"));
  const zone = search.get("zone");

  return {
    at: Number.isFinite(at) && at > 0 ? at : null,
    zone: zone && ZONE_PATTERN.test(zone) ? zone : null,
  };
}

function buildHref(path: string, at: number | null, zone: string | null) {
  const params = new URLSearchParams();
  if (at !== null) params.set("at", String(Math.round(at)));
  if (zone) params.set("zone", zone);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function historyHref(at: number | null, zone: string | null) {
  return buildHref("/history", at, zone);
}

export function activityHref(at: number | null, zone: string | null) {
  return buildHref("/activity", at, zone);
}

export function replaceSyncParams(at: number | null, zone: string | null) {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", buildHref(window.location.pathname, at, zone));
}

export function formatSyncClock(at: number) {
  const date = new Date(at);
  const sameDay = new Date().toDateString() === date.toDateString();
  const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  return `${time} · ${date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`;
}
