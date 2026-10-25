import type { Movement } from "../../../../domain/types";

export interface DayBucket {
  /** YYYY-MM-DD, local-day based. */
  date: string;
  count: number;
}

export interface MovementStreamData {
  buckets: DayBucket[];       // exactly 14 entries, oldest → newest
  totalEvents: number;
  peakDate: string | null;    // highest-count day; null if all zero
  peakCount: number;
  mostRecent: Date | null;    // most recent valid in-window event
  invalidDates: number;
  futureDated: number;        // events whose date is in the future
  byType: Record<string, number>; // event-type breakdown (lower-cased kind buckets)
}

const WINDOW_DAYS = 14;

function startOfLocalDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function parseEventDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type EventKind =
  | "issue"
  | "return"
  | "transfer"
  | "repair"
  | "maintenance"
  | "receive"
  | "other";

export function classifyMovementType(type: string): EventKind {
  const t = (type ?? "").toLowerCase();
  if (/return/.test(t)) return "return";
  if (/issue|checkout|assign/.test(t)) return "issue";
  if (/transfer|move/.test(t)) return "transfer";
  if (/repair/.test(t)) return "repair";
  if (/maintenance|service/.test(t)) return "maintenance";
  if (/receive|intake|incoming/.test(t)) return "receive";
  return "other";
}

/**
 * Build a 14-day activity profile from `snapshot.movements`.
 *
 * Design notes:
 *  - Buckets are LOCAL calendar days so a user sees "this week" aligned with
 *    AIMS's established date conventions (see Dashboard.tsx + MaintenanceKpis).
 *  - Each movement is ONE event — quantities are not summed into the activity
 *    chart because serialized-asset movements are status transitions, not
 *    inventory deltas.
 *  - Only `snapshot.movements` is used; `assetHistoryEvents` is intentionally
 *    excluded to avoid double-counting the same underlying operation.
 *  - Future-dated events and invalid dates are surfaced as separate counters
 *    rather than silently dropped or placed in an arbitrary bucket.
 */
export function computeMovementStream(
  movements: Movement[],
  now: Date,
): MovementStreamData {
  const today = startOfLocalDay(now);
  const earliest = addDays(today, -(WINDOW_DAYS - 1));
  const tomorrow = addDays(today, 1); // exclusive upper bound for "in window"

  const buckets: DayBucket[] = [];
  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    buckets.push({
      date: addDays(earliest, i).toISOString().slice(0, 10),
      count: 0,
    });
  }
  const dayIndex = new Map(buckets.map((b, i) => [b.date, i]));

  let totalEvents = 0;
  let invalidDates = 0;
  let futureDated = 0;
  let mostRecent: Date | null = null;
  const byType: Record<string, number> = {};

  for (const m of movements) {
    const d = parseEventDate(m.date);
    if (d === null) {
      invalidDates += 1;
      continue;
    }
    if (d.getTime() >= tomorrow.getTime()) {
      futureDated += 1;
      continue; // future events never contribute to past-14-day activity
    }
    if (d.getTime() < earliest.getTime()) continue; // outside the window
    const dayKey = startOfLocalDay(d).toISOString().slice(0, 10);
    const idx = dayIndex.get(dayKey);
    if (idx === undefined) continue; // safety guard
    buckets[idx].count += 1;
    totalEvents += 1;
    const kind = classifyMovementType(m.type);
    byType[kind] = (byType[kind] ?? 0) + 1;
    if (!mostRecent || d.getTime() > mostRecent.getTime()) mostRecent = d;
  }

  let peakDate: string | null = null;
  let peakCount = 0;
  for (const b of buckets) {
    if (b.count > peakCount) {
      peakCount = b.count;
      peakDate = b.date;
    }
  }

  return {
    buckets,
    totalEvents,
    peakDate,
    peakCount,
    mostRecent,
    invalidDates,
    futureDated,
    byType,
  };
}
