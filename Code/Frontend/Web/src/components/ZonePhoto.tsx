"use client";

import { useState } from "react";
import type { Zone } from "../garden-data";
import { assetUrl } from "../lib/backend";

export function ZonePhoto({ zone, className = "" }: { zone: Zone; className?: string }) {
  const src = assetUrl(zone.photoUrl);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = src !== null && failedSrc !== src;
  const initial = zone.name.trim().charAt(0).toUpperCase() || "?";
  const isDetail = className.includes("garden-detail-photo");

  return (
    <div
      className={`zone-photo ${className} ${isDetail && !showPhoto ? "strata-mode" : ""}`}
      style={showPhoto || isDetail ? undefined : { background: zone.color }}
    >
      {showPhoto ? (
        <img src={src} alt={`Ảnh ${zone.name}`} onError={() => setFailedSrc(src)} />
      ) : isDetail ? (
        <div className="zone-strata-card" aria-hidden="true">
          <div className="strata-horizon strata-top">
            <div className="strata-info">
              <span className="strata-crop">{zone.crop || zone.name}</span>
              <span className="strata-type">{zone.group}</span>
            </div>
            <span className="strata-depth">0 – 10cm</span>
          </div>
          <div className="strata-horizon strata-root">
            <span className="strata-label">Tầng rễ hữu hiệu · {zone.method}</span>
            <span className="strata-depth">10 – 25cm</span>
          </div>
          <div className="strata-stamp">
            <span className="strata-code">{zone.id}</span>
          </div>
        </div>
      ) : (
        <span className="zone-photo-fallback">{initial}</span>
      )}
    </div>
  );
}
