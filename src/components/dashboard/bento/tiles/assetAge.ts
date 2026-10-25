import type { Asset } from "../../../../domain/types";

export type AgeBucket = "lt1" | "1to3" | "3to5" | "ge5" | "unknown";

export interface AgeDistribution {
  totalActive: number;         // active = not Disposed/Archived (same rule as Hero)
  withValidDate: number;
  invalidDate: number;         // includes missing + unparseable + future-dated
  buckets: Record<AgeBucket, number>;
  oldestYears: number | null;  // whole years, computed with calendar-aware boundaries
}

const INACTIVE = new Set<string>(["Disposed", "Archived"]);

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Calendar-aware "years since purchaseDate" at `now`. Uses year/month/day
 * comparison so leap years and anniversary boundaries fall where the user
 * expects (an asset purchased on 2023-02-28 becomes 1 year old on 2024-02-28,
 * even in a leap year).
 */
export function yearsBetween(from: Date, to: Date): number {
  // Use UTC accessors so the result is deterministic across the user's and
  // the test machine's timezones; a one-day drift is acceptable for an
  // age-in-years readout.
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const m = to.getUTCMonth() - from.getUTCMonth();
  if (m < 0 || (m === 0 && to.getUTCDate() < from.getUTCDate())) years -= 1;
  return years;
}

function classifyYears(y: number): AgeBucket {
  if (y < 1) return "lt1";
  if (y < 3) return "1to3";
  if (y < 5) return "3to5";
  return "ge5";
}

/**
 * Age distribution across active assets. Future-dated purchases are classified
 * as `unknown` with the invalidDate counter — never as "negative age".
 */
export function computeAgeDistribution(
  assets: Asset[],
  now: Date,
): AgeDistribution {
  const buckets: Record<AgeBucket, number> = {
    lt1: 0,
    "1to3": 0,
    "3to5": 0,
    ge5: 0,
    unknown: 0,
  };
  let totalActive = 0;
  let withValidDate = 0;
  let invalidDate = 0;
  let oldestYears: number | null = null;

  for (const a of assets) {
    if (INACTIVE.has(a.status)) continue;
    totalActive += 1;
    const d = parseDate(a.purchaseDate);
    if (d === null) {
      invalidDate += 1;
      buckets.unknown += 1;
      continue;
    }
    if (d.getTime() > now.getTime()) {
      // Future-dated purchases are not "negative age" — surface as invalid.
      invalidDate += 1;
      buckets.unknown += 1;
      continue;
    }
    withValidDate += 1;
    const y = Math.max(0, yearsBetween(d, now));
    buckets[classifyYears(y)] += 1;
    if (oldestYears === null || y > oldestYears) oldestYears = y;
  }

  return { totalActive, withValidDate, invalidDate, buckets, oldestYears };
}
