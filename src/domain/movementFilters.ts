import type { Movement } from "./types";

export interface MovementFilters {
  /** Exact movement type, "" = all. */
  type: string;
  /** Inclusive ISO date (yyyy-mm-dd) bounds, "" = open. */
  from: string;
  to: string;
  /** Department of the source or destination, "" = all. */
  department: string;
}

export const emptyMovementFilters: MovementFilters = { type: "", from: "", to: "", department: "" };

const day = (value: string) => (value || "").slice(0, 10);

/**
 * Narrows the (read-only) movement history. The history itself is never
 * modified: this only decides which rows are shown. Free-text search over
 * Inv.code, asset, user and locations is handled by the table's search box.
 */
export function filterMovements(rows: Movement[], filters: MovementFilters): Movement[] {
  return rows.filter((row) => {
    if (filters.type && row.type !== filters.type) return false;
    const d = day(row.date);
    if (filters.from && d < filters.from) return false;
    if (filters.to && d > filters.to) return false;
    if (
      filters.department &&
      ![row.sourceDepartment, row.destinationDepartment, row.relatedDepartment].includes(filters.department)
    )
      return false;
    return true;
  });
}

/** True when the user chose a range that can never match anything. */
export const invalidDateRange = (filters: Pick<MovementFilters, "from" | "to">) =>
  Boolean(filters.from && filters.to && filters.from > filters.to);
