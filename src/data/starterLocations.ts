import type { InventoryRepository, WorkflowResult } from "./contracts";
import {
  departmentBelongsToMainLocation,
  normalizeDepartmentName,
  planStarterLocations,
  STARTER_DEPARTMENTS,
  type StarterPlan,
} from "../domain/starterLocations";

export interface StarterResult {
  ok: boolean;
  createdMain: boolean;
  createdDepartments: string[];
  failed: { name: string; message: string }[];
  details: DepartmentImportDetail[];
  message: string;
}

export type DepartmentImportStatus =
  | "Created"
  | "Already Exists"
  | "Validation Failed"
  | "Permission Denied";

export interface DepartmentImportDetail {
  name: string;
  status: DepartmentImportStatus;
  message: string;
}

const isPermissionDenied = (message: string) =>
  /permission|not authorized|unauthenticated/i.test(message);

const existingDepartment = (
  repository: Pick<InventoryRepository, "snapshot">,
  name: string,
  mainLocationId: string,
) =>
  repository
    .snapshot()
    .references.find(
      (record) =>
        record.status !== "Archived" &&
        departmentBelongsToMainLocation(record, mainLocationId) &&
        normalizeDepartmentName(record.name) === normalizeDepartmentName(name),
    );

/**
 * Applies the starter locations through the repository's normal commands, so
 * every validation, permission check and audit entry applies. Safe to run
 * again: the plan is recomputed from the current data and only fills gaps.
 */
export async function applyStarterLocations(
  repository: Pick<InventoryRepository, "snapshot" | "execute">,
  language: "nl" | "en",
): Promise<StarterResult> {
  const nl = language === "nl";
  const plan: StarterPlan = planStarterLocations(repository.snapshot().references);
  const result: StarterResult = { ok: true, createdMain: false, createdDepartments: [], failed: [], details: [], message: "" };
  if (plan.mainInactive)
    return {
      ...result,
      ok: false,
      message: nl
        ? "Hoofdlocatie Kangoeroe High is niet actief. Activeer die eerst in Master data."
        : "Main location Kangoeroe High is not active. Activate it in Master Data first.",
    };
  if (plan.noFreeCode)
    return {
      ...result,
      ok: false,
      message: nl
        ? "Er is geen vrije locatiecode voor Kangoeroe High. Maak de hoofdlocatie handmatig aan in Master data."
        : "No free location code for Kangoeroe High. Create the main location manually in Master Data.",
    };

  let mainId = plan.mainLocationId;
  if (plan.createMain) {
    const created: WorkflowResult = await repository.execute({
      action: "reference.create",
      values: {
        kind: "location",
        name: plan.createMain.name,
        type: "Main location",
        typeId: "main-location",
        status: "Active",
        details: { prefix: plan.createMain.code, manuallyCreated: true },
      },
    });
    if (!created.ok || !created.entityId) return { ...result, ok: false, message: created.message };
    mainId = created.entityId;
    result.createdMain = true;
  }
  // Re-check directly before every write. This makes retry safe and turns a
  // stale bulk-plan/concurrent create into "Already Exists", never a failure.
  for (const name of STARTER_DEPARTMENTS) {
    if (mainId && existingDepartment(repository, name, mainId)) {
      result.details.push({ name, status: "Already Exists", message: nl ? "Bestaat al onder deze hoofdlocatie." : "Already exists under this Main location." });
      continue;
    }
    const created = await repository.execute({
      action: "reference.create",
      values: { kind: "department", name, type: "Department", status: "Active", mainLocationId: mainId },
    });
    if (created.ok) {
      result.createdDepartments.push(name);
      result.details.push({ name, status: "Created", message: nl ? "Aangemaakt." : "Created." });
      continue;
    }
    // A second check catches a concurrent user/process that created it after
    // our pre-check but before the write was committed.
    if (mainId && existingDepartment(repository, name, mainId)) {
      result.details.push({ name, status: "Already Exists", message: nl ? "Bestaat al onder deze hoofdlocatie." : "Already exists under this Main location." });
      continue;
    }
    const status: DepartmentImportStatus = isPermissionDenied(created.message)
      ? "Permission Denied"
      : "Validation Failed";
    result.failed.push({ name, message: created.message });
    result.details.push({ name, status, message: created.message });
  }
  result.ok = result.failed.length === 0;
  const added = result.createdDepartments.length;
  const already = result.details.filter((detail) => detail.status === "Already Exists").length;
  result.message = nl
    ? `${result.createdMain ? "Hoofdlocatie Kangoeroe High aangemaakt. " : ""}${added} afdeling(en) toegevoegd${already ? `, ${already} bestonden al` : ""}${result.failed.length ? `, ${result.failed.length} mislukt (${result.failed[0].message})` : ""}.`
    : `${result.createdMain ? "Main location Kangoeroe High created. " : ""}${added} department(s) added${already ? `, ${already} already existed` : ""}${result.failed.length ? `, ${result.failed.length} failed (${result.failed[0].message})` : ""}.`;
  return result;
}
