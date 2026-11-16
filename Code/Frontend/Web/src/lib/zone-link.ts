export function zoneHref(href: string, zoneId?: string | null): string {
  if (!zoneId) return href;

  const [path, hash] = href.split("#");
  const separator = path.includes("?") ? "&" : "?";
  const next = `${path}${separator}zone=${encodeURIComponent(zoneId)}`;

  return hash ? `${next}#${hash}` : next;
}
