import type { Request, Response, NextFunction } from "express";

export type RateLimiterOptions = {
  windowMs: number;
  max: number;
  message?: string;
};

type ClientRecord = {
  timestamps: number[];
};

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, message = "Too many requests, please try again later." } = options;
  const hits = new Map<string, ClientRecord>();

  // Cleanup old entries every window period to prevent memory leaks
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      record.timestamps = record.timestamps.filter((time) => now - time < windowMs);
      if (record.timestamps.length === 0) {
        hits.delete(key);
      }
    }
  }, windowMs);
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Resolve client IP safely
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip) ||
      req.socket.remoteAddress ||
      "unknown-ip";

    const now = Date.now();
    let record = hits.get(ip);
    if (!record) {
      record = { timestamps: [] };
      hits.set(ip, record);
    }

    // Keep only timestamps within windowMs
    record.timestamps = record.timestamps.filter((time) => now - time < windowMs);

    const currentCount = record.timestamps.length;
    const remaining = Math.max(0, max - currentCount - 1);
    const oldestTimestamp = record.timestamps[0] ?? now;
    const resetTime = Math.ceil((oldestTimestamp + windowMs) / 1000);
    const retryAfter = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));

    res.setHeader("X-RateLimit-Limit", max.toString());
    res.setHeader("X-RateLimit-Remaining", remaining.toString());
    res.setHeader("X-RateLimit-Reset", resetTime.toString());

    if (currentCount >= max) {
      res.setHeader("Retry-After", retryAfter.toString());
      res.status(429).json({ error: message });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}

