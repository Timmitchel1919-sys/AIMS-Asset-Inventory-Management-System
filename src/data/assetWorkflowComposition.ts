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
