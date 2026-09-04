/**
 * Department Intelligence — pure derivation helpers.
 *
 * There is no separate department/asset store: every function here reads
 * straight from the same `MockSnapshot` collections every other view reads
 * (`assets`, `inventory`, `movements`, `assetHistoryEvents`, `references`).
 * A department's asset list, KPIs and activity feed are always computed on
 * read, so a transfer/return/status change is reflected the moment the
 * snapshot updates — there is nothing here to keep in sync.
 */
import type { Asset, Movement } from "./types";
import type {
  AssetHistoryEvent,
  InventoryItem,
  ReferenceRecord,
} from "../data/contracts";
import { locationPathNames } from "./locationTree";

/** Every asset currently attributed to this department (by name — `Asset.department` is a plain string, not a foreign key). */
export function assetsForDepartment(
  assets: Asset[],
  departmentName: string,
): Asset[] {
  return assets.filter((a) => a.department === departmentName);
}

/** Quantity-based stock lines attributed to this department, if any. */
export function inventoryForDepartment(
  inventory: InventoryItem[],
  departmentName: string,
): InventoryItem[] {
  return inventory.filter(
    (i) => !i.archived && i.department === departmentName,
  );
}

/**
 * Whether a category is part of the ICT/serialized asset register, using the
 * existing category reference records' own `type` field
 * ("Serialized" vs "Quantity-based") rather than a second, invented
 * classification. Categories with no matching reference record default to
 * ICT, since every record in `assets` is — by construction — part of the
 * serialized register (bulk consumables live in `inventory` instead).
 */
export function isIctCategory(
  category: string,
  references: ReferenceRecord[],
): boolean {
  const record = references.find(
    (r) => r.kind === "category" && r.name === category,
  );
  return record ? record.type !== "Quantity-based" : true;
}

export interface DepartmentAssetSummary {
  total: number;
  ict: number;
  active: number;
  assigned: number;
  maintenance: number;
  disposed: number;
}

const MAINTENANCE_STATUSES = new Set(["Under Repair", "Under Maintenance"]);
const RETIRED_STATUSES = new Set(["Disposed", "Archived"]);

/** KPI counters for the department's current asset list — always computed, never stored. */
export function departmentAssetSummary(
  departmentAssets: Asset[],
  references: ReferenceRecord[],
): DepartmentAssetSummary {
  let ict = 0;
  let active = 0;
  let assigned = 0;
  let maintenance = 0;
  let disposed = 0;
  for (const asset of departmentAssets) {
    if (isIctCategory(asset.category, references)) ict += 1;
    if (!RETIRED_STATUSES.has(asset.status)) active += 1;
    if (asset.status === "Assigned") assigned += 1;
    if (MAINTENANCE_STATUSES.has(asset.status)) maintenance += 1;
    if (asset.status === "Disposed") disposed += 1;
  }
  return { total: departmentAssets.length, ict, active, assigned, maintenance, disposed };
}

/** Movements (transfers, returns, …) that touched this department, either end, most recent first. */
export function departmentMovements(
  movements: Movement[],
  departmentName: string,
): Movement[] {
  return movements
    .filter(
      (m) =>
        m.sourceDepartment === departmentName ||
        m.destinationDepartment === departmentName,
    )
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/** History-log entries recorded while an asset was moving into/out of/within this department, most recent first. */
export function departmentHistoryEvents(
  events: AssetHistoryEvent[],
  departmentName: string,
): AssetHistoryEvent[] {
  return events
    .filter((event) => {
      const prev = event.previous?.department;
      const next = event.next?.department;
      return prev === departmentName || next === departmentName;
    })
    .slice()
    .sort((a, b) =>
      (b.occurredAt || b.createdAt || "").localeCompare(
        a.occurredAt || a.createdAt || "",
      ),
    );
}

export type DepartmentActivityItem =
  | { kind: "movement"; at: string; movement: Movement }
  | { kind: "history"; at: string; event: AssetHistoryEvent };

/** Merges movements + history-log events into one recency-sorted activity feed. */
export function departmentActivityFeed(
  movements: Movement[],
  events: AssetHistoryEvent[],
  departmentName: string,
  limit?: number,
): DepartmentActivityItem[] {
  const items: DepartmentActivityItem[] = [
    ...departmentMovements(movements, departmentName).map(
      (movement): DepartmentActivityItem => ({
        kind: "movement",
        at: movement.date || "",
        movement,
      }),
    ),
    ...departmentHistoryEvents(events, departmentName).map(
      (event): DepartmentActivityItem => ({
        kind: "history",
        at: event.occurredAt || event.createdAt || "",
        event,
      }),
    ),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

export interface DepartmentLocationLabel {
  location: string;
  subLocation: string;
}

/** "Main Building" + "Room 2B" (or "" if the department has no main location / is a single-level location). */
export function departmentLocationLabel(
  references: ReferenceRecord[],
  department: ReferenceRecord,
): DepartmentLocationLabel {
  const names = locationPathNames(references, department.mainLocationId);
  return {
    location: names[0] || "",
    subLocation: names.slice(1).join(" / "),
  };
}
