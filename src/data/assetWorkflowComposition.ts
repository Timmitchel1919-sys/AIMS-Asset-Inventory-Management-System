import type {
  InventoryRepository,
  WorkflowCommand,
  WorkflowResult,
} from "./contracts";
import {
  ASSET_STATE_ERRORS,
  validateAssetState,
  type AssetStateError,
} from "../domain/assetStatusTransitions";
import type { AssetStatus } from "../domain/types";

/**
 * Keeps ICT-Middelen and Assignment Management ONE relationship.
 *
 * Editing or creating an asset with an assignee must not leave a second,
 * unrelated copy of "who has this": the change is performed through the
 * existing, tested assignment workflows (assignment.return / assignment.create)
 * so the Assignment Management module, the asset, its history and the audit log
 * all agree. The asset edit that remains afterwards no longer carries the
 * assignee, so nothing is written twice.
 *
 * This is a thin layer AROUND a repository (not inside its engine): every step
 * goes through the repository's normal `execute`, including its permission
 * checks and persistence, and each step is audited on its own. The whole
 * change is validated up front so a refused change never half-applies.
 */
type Execute = (command: WorkflowCommand) => Promise<WorkflowResult>;

const NOT_ASSIGNABLE = {
  nl: 'Een asset kan alleen worden toegewezen als de status "Beschikbaar" is. Wijzig eerst de status of rond lopende reparatie/onderhoud/uitleen af.',
  en: 'An asset can only be assigned while its status is "Available". Resolve any repair, maintenance or loan first.',
} as const;
const ASSIGNEE_LOCKED = {
  nl: "De toewijzing van deze asset kan hier niet worden gewijzigd zolang de status niet Beschikbaar of Toegewezen is. Gebruik de bijbehorende module.",
  en: "This asset's assignment cannot be changed here unless its status is Available or Assigned. Use the related module.",
} as const;
const PARTIAL = {
  nl: (code: string, message: string) => `${code} is opgeslagen, maar de toewijzing is mislukt: ${message}`,
  en: (code: string, message: string) => `${code} was saved, but the assignment failed: ${message}`,
} as const;

export const uiLanguage = (): "nl" | "en" => {
  try {
    return localStorage.getItem("kcs-language") === "nl" ? "nl" : "en";
  } catch {
    return "en";
  }
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function composeAssetCommand(
  repository: Pick<InventoryRepository, "snapshot">,
  execute: Execute,
  command: WorkflowCommand,
): Promise<WorkflowResult> {
  if (command.action === "corrective.apply")
    return applyApprovedCorrection(repository, execute, command);
  if (command.action !== "asset.create" && command.action !== "asset.edit")
    return execute(command);
  const lang = uiLanguage();
  const v = command.values ?? {};
  const fail = (message: string): WorkflowResult => ({ ok: false, message });
  const stateError = (code: AssetStateError, from: string, to: string) =>
    fail(ASSET_STATE_ERRORS[lang][code](from, to));
  const meta = { actor: command.actor, actorEmail: command.actorEmail };

  if (command.action === "asset.create") {
    const assignee = String(v.assignedTo ?? "").trim();
    const status = (v.status ?? (assignee ? "Assigned" : "Available")) as AssetStatus;
    const problem = validateAssetState({ from: "Available", to: status, assignee });
    if (problem) return stateError(problem, "Available", status);
    if (!assignee) return execute(command);
    if (status !== "Assigned") return fail(NOT_ASSIGNABLE[lang]);

    const { assignedTo: _drop, ...rest } = v;
    const created = await execute({ ...command, values: { ...rest, status: "Available" } });
    if (!created.ok || !created.entityId) return created;
    const assigned = await execute({
      action: "assignment.create",
      entityId: created.entityId,
      ...meta,
      values: assignmentValues(assignee, v, undefined),
    });
    return assigned.ok
      ? { ...created, message: `${created.message} ${assigned.message}`.trim() }
      : { ok: false, entityId: created.entityId, message: PARTIAL[lang](created.entityId, assigned.message) };
  }

  // asset.edit
  const asset = repository.snapshot().assets.find((item) => item.id === command.entityId);
  if (!asset) return execute(command); // the engine reports "not found"
  const previous = (asset.assignedTo ?? "").trim();
  const mentionsAssignee = Object.prototype.hasOwnProperty.call(v, "assignedTo");
  const next = mentionsAssignee ? String(v.assignedTo ?? "").trim() : previous;
  const assigneeChanged = mentionsAssignee && !same(next, previous);
  const statusGiven = v.status !== undefined && v.status !== "";
  let target = (statusGiven ? v.status : asset.status) as AssetStatus;
  // Nothing that needs validating: legacy records stay editable for other reasons.
  if (!assigneeChanged && target === asset.status) return execute(command);

  if (assigneeChanged) {
    if (asset.status !== "Available" && asset.status !== "Assigned") return fail(ASSIGNEE_LOCKED[lang]);
    if (!statusGiven) target = next ? "Assigned" : "Available";
  }
  const problem = validateAssetState({ from: asset.status, to: target, assignee: next });
  if (problem) return stateError(problem, asset.status, target);
  if (assigneeChanged && next && target !== "Assigned") return fail(NOT_ASSIGNABLE[lang]);
  if (!assigneeChanged) return execute(command); // a validated plain status change

  const active = repository.snapshot().assignments.find((item) => item.assetId === asset.id && item.active);
  // A defective device is marked Damaged when it is returned and could then not
  // be re-assigned: refuse up front instead of leaving the change half done.
  if (active && next && asset.condition === "Defective") return fail(NOT_ASSIGNABLE[lang]);
  if (active) {
    const returned = await execute({
      action: "assignment.return",
      entityId: active.id,
      ...meta,
      values: { returnedBy: previous, outcome: "Available", destination: asset.location },
    });
    if (!returned.ok) return returned;
  }
  if (next) {
    const assigned = await execute({
      action: "assignment.create",
      entityId: asset.id,
      ...meta,
      values: assignmentValues(next, v, asset),
    });
    if (!assigned.ok) return assigned;
  }
  // Everything else on the form, without the assignee the workflow already handled.
  const { assignedTo: _skip, status: _status, ...rest } = v;
  const settled: AssetStatus = next ? "Assigned" : "Available";
  return execute({
    ...command,
    values: { ...rest, ...(target !== settled ? { status: target } : {}) },
  });
}

const CORRECTION = {
  nl: {
    notFound: "De corrigerende actie bestaat niet meer.",
    notApproved: "Alleen een goedgekeurde correctie kan worden toegepast. Laat de correctie eerst beoordelen en goedkeuren.",
    noChange: "Deze actie heeft geen voorgestelde wijziging.",
    noAsset: "Het bijbehorende middel is niet gevonden. Alleen ICT-middelen kunnen via een correctie worden aangepast.",
    stale: "Het middel is sinds het voorstel gewijzigd. Bekijk de afwijking opnieuw voordat je de correctie toepast.",
    applied: (code: string, field: string, from: string, to: string) => `Correctie toegepast op ${code}: ${field} ${from || "—"} → ${to || "—"}.`,
    bookkeeping: (summary: string, message: string) => `${summary} De administratie van de correctie is niet bijgewerkt: ${message}`,
    fields: { location: "locatie", assignedTo: "toegewezen aan", condition: "conditie", status: "status" },
  },
  en: {
    notFound: "The corrective action no longer exists.",
    notApproved: "Only an approved correction can be applied. Have it reviewed and approved first.",
    noChange: "This action has no proposed change.",
    noAsset: "The related asset was not found. Only ICT assets can be changed through a correction.",
    stale: "The asset changed after the proposal was made. Review the discrepancy again before applying the correction.",
    applied: (code: string, field: string, from: string, to: string) => `Correction applied to ${code}: ${field} ${from || "—"} → ${to || "—"}.`,
    bookkeeping: (summary: string, message: string) => `${summary} The correction record was not updated: ${message}`,
    fields: { location: "location", assignedTo: "assigned to", condition: "condition", status: "status" },
  },
} as const;

/**
 * Applies an APPROVED corrective action to the canonical asset record. This is
 * the only way an inventory-control finding changes authoritative data: the
 * discrepancy itself never overwrites anything, and a correction must have been
 * reviewed and approved first. The change goes through the normal validated
 * workflows (asset.move / asset edit with status and assignment rules), so it is
 * audited, recorded in history and refused if it is not allowed.
 */
async function applyApprovedCorrection(
  repository: Pick<InventoryRepository, "snapshot">,
  execute: Execute,
  command: WorkflowCommand,
): Promise<WorkflowResult> {
  const lang = uiLanguage();
  const t = CORRECTION[lang];
  const fail = (message: string): WorkflowResult => ({ ok: false, message });
  const snapshot = repository.snapshot();
  const action = snapshot.correctiveActions.find((item) => item.id === command.entityId);
  if (!action) return fail(t.notFound);
  if (action.status !== "Approved") return fail(t.notApproved);
  const change = action.proposedChange;
  if (!change) return fail(t.noChange);
  const discrepancy = snapshot.auditDiscrepancies.find((item) => item.id === action.discrepancyId);
  const asset = snapshot.assets.find((item) => item.id === discrepancy?.recordId);
  if (!discrepancy || !asset) return fail(t.noAsset);

  const locationName = (id: string) => snapshot.references.find((item) => item.id === id)?.name ?? id;
  const before =
    change.field === "location"
      ? asset.currentLocationPath || asset.location
      : change.field === "assignedTo"
        ? asset.assignedTo ?? ""
        : String(asset[change.field]);
  const after = change.field === "location" ? locationName(change.value) : change.value;
  if (before === after) return fail(t.stale);

  const reason = `Inventory correction ${action.reference}: ${action.description}`;
  const meta = { actor: command.actor, actorEmail: command.actorEmail };
  const applied =
    change.field === "location"
      ? await execute({ action: "asset.move", entityId: asset.id, ...meta, values: { destinationLocationId: change.value, reason } })
      : await composeAssetCommand(repository, execute, {
          action: "asset.edit",
          entityId: asset.id,
          ...meta,
          values: { [change.field]: change.value },
        });
  if (!applied.ok) return applied; // nothing else was touched

  const summary = t.applied(asset.code, t.fields[change.field], before, after);
  const completed = await execute({
    action: "corrective.complete",
    entityId: action.id,
    ...meta,
    values: {
      result: summary,
      appliedChange: { field: change.field, from: before, to: after, at: new Date().toISOString(), by: command.actor ?? "" },
    },
  });
  if (!completed.ok) return { ok: false, entityId: action.id, message: t.bookkeeping(summary, completed.message) };
  const resolved = await execute({
    action: "discrepancy.resolve",
    entityId: discrepancy.id,
    ...meta,
    values: { resolution: summary },
  });
  if (!resolved.ok) return { ok: false, entityId: action.id, message: t.bookkeeping(summary, resolved.message) };
  return { ok: true, entityId: action.id, message: summary };
}

function assignmentValues(
  assignee: string,
  v: Record<string, unknown>,
  asset: { department: string; location: string; condition: string } | undefined,
) {
  return {
    assignee,
    assigneeType: "Employee",
    department: String(v.department ?? asset?.department ?? "") || undefined,
    location: String(v.location ?? asset?.location ?? "") || undefined,
    condition: String(v.condition ?? asset?.condition ?? "") || undefined,
    // No signature is collected when assigning from ICT-Middelen; say so
    // rather than recording a fabricated one.
    assigneeSignature: "Not captured (assigned from ICT-Middelen)",
    staffSignature: "Not captured (assigned from ICT-Middelen)",
    signature: "Not captured (assigned from ICT-Middelen)",
    notes: "Assigned from ICT-Middelen.",
  };
}

/**
 * Wraps `repository.execute` once (the instance is returned, so React context
 * identity and subscriptions are unchanged).
 */
export function withAssetWorkflowComposition<T extends InventoryRepository>(
  repository: T,
): T {
  const marked = repository as T & { __assetComposition?: true };
  if (marked.__assetComposition) return repository;
  marked.__assetComposition = true;
  const original = repository.execute.bind(repository);
  (repository as { execute: Execute }).execute = (command) =>
    composeAssetCommand(repository, original, command);
  return repository;
}
