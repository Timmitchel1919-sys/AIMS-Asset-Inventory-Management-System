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

/**
 * Every asset currently attributed to this department. Uses the canonical
 * `departmentId` when the asset has one (so renames never lose assets) and the
 * stored department name otherwise.
 */
export function assetsForDepartment(
  assets: Asset[],
  departmentName: string,
  departmentId?: string,
): Asset[] {
  const normDept = (departmentName || "").trim().toLowerCase();
  return assets.filter((a) => {
    if (departmentId && a.departmentId) {
      return a.departmentId === departmentId;
    }
    if (a.department && a.department.trim().toLowerCase() === normDept) return true;
    if (a.responsibleEmployee && a.responsibleEmployee.trim().toLowerCase() === normDept) return true;
    return false;
  });
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

/** Movements (transfers, returns, …) that touched this department or its assets, most recent first. */
export function departmentMovements(
  movements: Movement[],
  departmentName: string,
  departmentAssets?: Asset[],
): Movement[] {
  const normDept = (departmentName || "").trim().toLowerCase();
  const assetCodes = departmentAssets ? new Set(departmentAssets.map((a) => a.code).filter(Boolean)) : null;
  const assetIds = departmentAssets ? new Set(departmentAssets.map((a) => a.id).filter(Boolean)) : null;

  return movements
    .filter((m) => {
      if (m.sourceDepartment && m.sourceDepartment.trim().toLowerCase() === normDept) return true;
      if (m.destinationDepartment && m.destinationDepartment.trim().toLowerCase() === normDept) return true;
      if (assetCodes && m.assetCode && assetCodes.has(m.assetCode)) return true;
      if (assetIds && m.assetId && assetIds.has(m.assetId)) return true;
      return false;
    })
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/** History-log entries recorded while an asset was in or moving into/out of this department, most recent first. */
export function departmentHistoryEvents(
  events: AssetHistoryEvent[],
  departmentName: string,
  departmentAssets?: Asset[],
): AssetHistoryEvent[] {
  const normDept = (departmentName || "").trim().toLowerCase();
  const assetCodes = departmentAssets ? new Set(departmentAssets.map((a) => a.code).filter(Boolean)) : null;
  const assetIds = departmentAssets ? new Set(departmentAssets.map((a) => a.id).filter(Boolean)) : null;

  return events
    .filter((event) => {
      const prev = event.previous?.department;
      const next = event.next?.department;
      if (prev && String(prev).trim().toLowerCase() === normDept) return true;
      if (next && String(next).trim().toLowerCase() === normDept) return true;
      if (assetCodes && event.assetCode && assetCodes.has(event.assetCode)) return true;
      if (assetIds && event.assetId && assetIds.has(event.assetId)) return true;
      return false;
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
  departmentAssets?: Asset[],
): DepartmentActivityItem[] {
  const items: DepartmentActivityItem[] = [
    ...departmentMovements(movements, departmentName, departmentAssets).map(
      (movement): DepartmentActivityItem => ({
        kind: "movement",
        at: movement.date || "",
        movement,
      }),
    ),
    ...departmentHistoryEvents(events, departmentName, departmentAssets).map(
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

/** Resolves main location label and sub-location label for a department. */
export function departmentLocationLabel(
  references: ReferenceRecord[],
  department: ReferenceRecord,
): DepartmentLocationLabel {
  const pathParts = locationPathNames(references, department.mainLocationId);

  const subLocId =
    department.containerLocationId ||
    department.parentId ||
    (department.details?.subLocationId as string) ||
    (department.details?.subLocation as string);

  const subLoc = subLocId
    ? references.find((r) => r.id === subLocId || r.name === subLocId)
    : undefined;

  const locationName = pathParts[0] || "";
  const subLocationName =
    (pathParts.length > 1 ? pathParts.slice(1).join(" / ") : "") ||
    subLoc?.name ||
    (typeof department.details?.subLocation === "string" && department.details.subLocation.trim()
      ? department.details.subLocation.trim()
      : "");

  return {
    location: locationName,
    subLocation: subLocationName,
  };
}
