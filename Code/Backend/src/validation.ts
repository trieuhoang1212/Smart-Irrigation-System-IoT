import { MAX_THRESHOLD, MIN_THRESHOLD, ZONE_IDS, type ZoneId } from "./domain.js";

export function isZoneId(value: unknown): value is ZoneId {
  return typeof value === "string" && ZONE_IDS.includes(value as ZoneId);
}

export type ParseResult<T> =
  | { success: true; value: T }
  | { success: false; error: string };

/**
 * Validates and parses an integer query parameter.
 * Returns undefined if input is not provided.
 */
export function parseOptionalInteger(
  value: unknown,
  name: string,
  min: number,
  max: number,
): ParseResult<number | undefined> {
  if (value === undefined || value === null || value === "") {
    return { success: true, value: undefined };
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return { success: false, error: `${name} must be a number` };
  }

  const str = String(value).trim();
  if (!/^-?\d+$/.test(str)) {
    return { success: false, error: `${name} must be an integer` };
  }

  const parsed = Number(str);
  if (!Number.isSafeInteger(parsed)) {
    return { success: false, error: `${name} is out of safe numeric range` };
  }

  if (parsed < min || parsed > max) {
    return { success: false, error: `${name} must be between ${min} and ${max}` };
  }

  return { success: true, value: parsed };
}

/**
 * Validates threshold input: must be an integer between 10 and 90.
 */
export function validateThreshold(value: unknown): ParseResult<number> {
  if (value === undefined || value === null || value === "") {
    return { success: false, error: "threshold is required" };
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { success: false, error: `threshold must be an integer between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}` };
  }

  if (value < MIN_THRESHOLD || value > MAX_THRESHOLD) {
    return { success: false, error: `threshold must be between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}` };
  }

  return { success: true, value };
}

/**
 * Validates from & to epoch millisecond timestamps.
 */
export function validateTimeRange(
  rawFrom: unknown,
  rawTo: unknown,
): ParseResult<{ from: number; to: number }> {
  const now = Date.now();
  let to = now;
  let from = now - 24 * 60 * 60 * 1000;

  if (rawTo !== undefined && rawTo !== null && rawTo !== "") {
    const parsedTo = parseOptionalInteger(rawTo, "to", 0, now + 86400000 * 365);
    if (!parsedTo.success) return parsedTo;
    if (parsedTo.value !== undefined) to = parsedTo.value;
  }

  if (rawFrom !== undefined && rawFrom !== null && rawFrom !== "") {
    const parsedFrom = parseOptionalInteger(rawFrom, "from", 0, now + 86400000 * 365);
    if (!parsedFrom.success) return parsedFrom;
    if (parsedFrom.value !== undefined) from = parsedFrom.value;
  }

  if (from >= to) {
    return { success: false, error: "from must be earlier than to" };
  }

  return { success: true, value: { from, to } };
}

