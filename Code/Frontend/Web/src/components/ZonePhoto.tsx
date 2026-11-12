"use client";

import { useState } from "react";
import type { Zone } from "../garden-data";
import { assetUrl } from "../lib/backend";

export function ZonePhoto({ zone, className = "" }: { zone: Zone; className?: string }) {
  const src = assetUrl(zone.photoUrl);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = src !== null && failedSrc !== src;
  const initial = zone.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`zone-photo ${className}`}
      style={showPhoto ? undefined : { background: zone.color }}
    >
      {showPhoto ? (
        <img src={src} alt={`Ảnh ${zone.name}`} onError={() => setFailedSrc(src)} />
      ) : (
        <span className="zone-photo-fallback">{initial}</span>
      )}
    </div>
  );
}
