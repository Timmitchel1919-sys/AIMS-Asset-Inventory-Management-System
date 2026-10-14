import type { ReferenceRecord } from "../data/contracts";

/**
 * Starter locations for the school: the Hoofdlocatie "Kangoeroe High" and the
 * classrooms "Lokaal 2" ... "Lokaal 16" under it. Applying them is idempotent:
 * whatever already exists (compared by normalised name) is left alone, nothing
 * is renamed, reactivated or duplicated.
 */
export const STARTER_MAIN_LOCATION = { name: "Kangoeroe High", codes: ["KH", "KHS", "KHIGH"] } as const;
export const STARTER_FIRST_ROOM = 2;
export const STARTER_LAST_ROOM = 16;
export const STARTER_DEPARTMENTS: readonly string[] = Array.from(
  { length: STARTER_LAST_ROOM - STARTER_FIRST_ROOM + 1 },
  (_, i) => `Lokaal ${STARTER_FIRST_ROOM + i}`,
);

export const normalizeDepartmentName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** True when a department belongs to this Main location, including legacy
 * records that used a parent-id field before mainLocationId was introduced. */
export const departmentBelongsToMainLocation = (
  department: ReferenceRecord,
  mainLocationId: string,
) =>
  department.kind === "department" &&
  (department.mainLocationId === mainLocationId ||
    department.parentLocationId === mainLocationId ||
    department.parentId === mainLocationId);

export interface StarterPlan {
  /** The Hoofdlocatie must be created (with this code). */
  createMain?: { name: string; code: string };
  /** Existing Hoofdlocatie to put the departments under. */
  mainLocationId?: string;
  /** The Hoofdlocatie exists but is not active: nothing is done until it is activated. */
  mainInactive: boolean;
  /** Department names that will be created. */
  create: string[];
  /** Department names that already exist under the Hoofdlocatie. */
  existing: string[];
  /** No free location code could be found for a new Hoofdlocatie. */
  noFreeCode: boolean;
}

export function planStarterLocations(references: ReferenceRecord[]): StarterPlan {
  const mains = references.filter(
    (r) => r.kind === "location" && r.type === "Main location" && r.status !== "Archived",
  );
  const found = mains.find((r) => normalizeDepartmentName(r.name) === normalizeDepartmentName(STARTER_MAIN_LOCATION.name));
  if (found && found.status !== "Active")
    return { mainInactive: true, mainLocationId: found.id, create: [], existing: [], noFreeCode: false };

  let createMain: StarterPlan["createMain"];
  let noFreeCode = false;
  if (!found) {
    const used = new Set(mains.map((r) => normalizeDepartmentName(String(r.details?.prefix ?? ""))));
    const code = STARTER_MAIN_LOCATION.codes.find((c) => !used.has(normalizeDepartmentName(c)));
    if (code) createMain = { name: STARTER_MAIN_LOCATION.name, code };
    else noFreeCode = true;
  }
  const mainId = found?.id;
  const existing = new Set(
    references
      .filter((r) => r.status !== "Archived" && mainId && departmentBelongsToMainLocation(r, mainId))
      .map((r) => normalizeDepartmentName(r.name)),
  );
  const names = noFreeCode ? [] : STARTER_DEPARTMENTS;
  return {
    createMain,
    mainLocationId: mainId,
    mainInactive: false,
    create: names.filter((n) => !existing.has(normalizeDepartmentName(n))),
    existing: names.filter((n) => existing.has(normalizeDepartmentName(n))),
    noFreeCode,
  };
}

export const starterPlanIsEmpty = (plan: StarterPlan) => !plan.createMain && plan.create.length === 0;
