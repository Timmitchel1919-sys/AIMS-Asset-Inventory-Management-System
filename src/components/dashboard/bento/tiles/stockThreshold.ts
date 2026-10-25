import type { InventoryItem } from "../../../../data/contracts";

export type StockStatus =
  | "below-min"
  | "reorder"
  | "healthy"
  | "above-max"
  | "unconfigured";

export interface StockLine {
  item: InventoryItem;
  available: number;        // onHand - reserved (never clamped)
  status: StockStatus;
  configurationIssue: boolean; // true when thresholds are internally inconsistent
}

export interface StockSummary {
  belowMin: number;
  reorder: number;
  healthy: number;
  aboveMax: number;
  unconfigured: number;
  invalid: number;        // items with non-numeric onHand/reserved
  totalEligible: number;  // archived items are excluded from everything
  attentionLines: StockLine[]; // ordered: belowMin, then reorder, then aboveMax
}

const toNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Classify a single inventory line against its configured thresholds.
 *
 * Semantics agreed with the AIMS InventoryItem contract:
 *  - `minimum` and `reorderLevel` are REQUIRED numbers (default 0 for new
 *    items). A value of 0 is a VALID threshold meaning "never allow negative
 *    free stock", so an item with `minimum = 0` and `available < 0` is still
 *    classified Below Minimum — matching how the live Dashboard counts low
 *    stock (`item.onHand - item.reserved < item.minimum`).
 *  - `maximum` is OPTIONAL; it is considered configured only when present
 *    and strictly positive (0 isn't operationally meaningful as a cap).
 *  - An item is "unconfigured" only when all operational signals are at
 *    their defaults: `minimum = 0`, `reorderLevel = 0`, no `maximum`.
 *  - `available = onHand - reserved` is NEVER clamped — a negative value
 *    is a real stock inconsistency the dashboard must surface, not hide.
 */
function classifyLine(item: InventoryItem): StockLine {
  const onHand = toNum(item.onHand) ?? 0;
  const reserved = toNum(item.reserved) ?? 0;
  const available = onHand - reserved;

  const min = toNum(item.minimum);
  const reorder = toNum(item.reorderLevel);
  const max = toNum(item.maximum);
  const hasMax = max !== null && max > 0;

  const minSet = (min ?? 0) > 0;
  const reorderSet = (reorder ?? 0) > 0;

  if (!minSet && !reorderSet && !hasMax) {
    return { item, available, status: "unconfigured", configurationIssue: false };
  }

  // Configuration issues (only flag when both sides are meaningfully set):
  //   min > reorder (reorderLevel should be the earlier warning line)
  //   min > maximum
  //   reorderLevel > maximum
  const configurationIssue =
    (minSet && reorderSet && (min as number) > (reorder as number)) ||
    (minSet && hasMax && (min as number) > (max as number)) ||
    (reorderSet && hasMax && (reorder as number) > (max as number));

  // Below-minimum uses the configured minimum verbatim (0 is honored). This
  // keeps the tile reconciled with Dashboard.tsx's low-stock KPI.
  if (min !== null && available < min) {
    return { item, available, status: "below-min", configurationIssue };
  }

  // Reorder uses the reorderLevel only when it is operationally meaningful
  // (> 0); a 0 reorderLevel is treated as "no proactive reorder configured"
  // and never classifies an item here.
  if (reorderSet && available <= (reorder as number)) {
    return { item, available, status: "reorder", configurationIssue };
  }

  if (hasMax && available > (max as number)) {
    return { item, available, status: "above-max", configurationIssue };
  }

  return { item, available, status: "healthy", configurationIssue };
}

/**
 * Reads only InventoryItem (quantity-based). Serialized assets are never
 * considered here — the caller passes only `snapshot.inventory`.
 */
export function summarizeStock(inventory: InventoryItem[]): StockSummary {
  let belowMin = 0;
  let reorder = 0;
  let healthy = 0;
  let aboveMax = 0;
  let unconfigured = 0;
  let invalid = 0;
  const attention: StockLine[] = [];

  for (const item of inventory) {
    if (item.archived) continue;
    if (toNum(item.onHand) === null || toNum(item.reserved) === null) {
      invalid += 1;
      continue;
    }
    const line = classifyLine(item);
    switch (line.status) {
      case "below-min":
        belowMin += 1;
        attention.push(line);
        break;
      case "reorder":
        reorder += 1;
        attention.push(line);
        break;
      case "above-max":
        aboveMax += 1;
        attention.push(line);
        break;
      case "healthy":
        healthy += 1;
        break;
      case "unconfigured":
        unconfigured += 1;
        break;
    }
  }

  // Attention priority: below-min → reorder → above-max.
  const order: Record<StockStatus, number> = {
    "below-min": 0,
    reorder: 1,
    "above-max": 2,
    healthy: 3,
    unconfigured: 4,
  };
  attention.sort((a, b) => order[a.status] - order[b.status]);

  return {
    belowMin,
    reorder,
    healthy,
    aboveMax,
    unconfigured,
    invalid,
    totalEligible: belowMin + reorder + healthy + aboveMax + unconfigured,
    attentionLines: attention,
  };
}
