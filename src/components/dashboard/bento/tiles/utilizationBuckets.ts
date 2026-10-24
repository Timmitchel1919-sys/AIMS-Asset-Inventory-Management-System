import type { Asset } from "../../../../domain/types";

/**
 * Status→bucket mapping (Phase 2B §4.3):
 *   In Use   → Assigned, Borrowed
 *   Available→ Available
 *   Reserved → Reserved
 *   Service  → Under Repair, Under Maintenance, Damaged
 *   Retired  → Disposed, Archived              (excluded from denominator)
 *   Unknown  → any other status                (surfaced explicitly, never dropped)
 */
const IN_USE = new Set<string>(["Assigned", "Borrowed"]);
const AVAILABLE = new Set<string>(["Available"]);
const RESERVED = new Set<string>(["Reserved"]);
const SERVICE = new Set<string>(["Under Repair", "Under Maintenance", "Damaged"]);
const RETIRED = new Set<string>(["Disposed", "Archived"]);

export interface UtilizationBuckets {
  inUse: number;
  available: number;
  reserved: number;
  service: number;
  retired: number;
  unknown: number;
  activeTotal: number;
  utilizationPct: number;
}

export function classifyUtilization(assets: Asset[]): UtilizationBuckets {
  let inUse = 0;
  let available = 0;
  let reserved = 0;
  let service = 0;
  let retired = 0;
  let unknown = 0;
  for (const a of assets) {
    const s = a.status;
    if (IN_USE.has(s)) inUse += 1;
    else if (AVAILABLE.has(s)) available += 1;
    else if (RESERVED.has(s)) reserved += 1;
    else if (SERVICE.has(s)) service += 1;
    else if (RETIRED.has(s)) retired += 1;
    else unknown += 1;
  }
  // Denominator = all active assets (excluding retired). Unknown is included so
  // it never silently reduces the denominator and the gauge stays honest.
  const activeTotal = inUse + available + reserved + service + unknown;
  const utilizationPct =
    activeTotal === 0 ? 0 : Math.round((inUse / activeTotal) * 100);
  return {
    inUse,
    available,
    reserved,
    service,
    retired,
    unknown,
    activeTotal,
    utilizationPct,
  };
}
