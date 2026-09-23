import type { WorkflowAction, WorkflowCommand } from "../data/contracts";
import type { Role } from "../domain/types";
import {
  isAuthorizedAimsUser,
  type Permission,
} from "./permissions";

const exactPermissions: Partial<Record<WorkflowAction, Permission>> = {
  "asset.create": "assets.create",
  "asset.edit": "assets.edit",
  "asset.archive": "assets.archive",
  "asset.restore": "assets.archive",
  "asset.move": "movements.create",
  "asset.return": "movements.create",
  "bulk.move": "movements.create",
  "qr.backfill": "admin.system.configure",
  "qr.reprint": "assets.view",
  "qr.revoke": "admin.system.configure",
  "qr.replace": "admin.system.configure",
  "history.manual.saveDraft": "history.create_manual",
  "history.manual.finalize": "history.edit_manual",
  "history.manual.delete": "history.delete_manual",
  "history.manual.correct": "history.edit_manual",
  "history.legacy.import": "assets.create",
  "inventory.create": "inventory.create",
  "inventory.legacy.importBatch": "inventory.import",
  "inventory.edit": "inventory.edit",
  "inventory.archive": "inventory.archive",
  "inventory.restore": "inventory.restore",
  "stock.receive": "inventory.receive",
  "stock.issue": "inventory.issue",
  "stock.transfer": "inventory.transfer",
  "stock.reserve": "inventory.reserve",
  "stock.return": "inventory.return",
  "stock.correct": "inventory.correct",
  "reservation.create": "inventory.reserve",
  "reservation.approve": "inventory.reservations.approve",
  "reservation.reject": "inventory.reservations.approve",
  "reservation.release": "inventory.reservations.approve",
  "reservation.fulfill": "inventory.issue",
  "reservation.cancel": "inventory.reserve",
  "assignment.create": "assignments.create",
  "assignment.edit": "assignments.edit",
  "assignment.approve": "assignments.approve",
  "assignment.requestReturn": "assignments.return",
  "assignment.return": "assignments.return",
  "assignment.cancel": "assignments.edit",
  "assignment.reassign": "assignments.reassign",
  "borrow.create": "borrows.create",
  "borrow.edit": "borrows.edit",
  "borrow.submit": "borrows.edit",
  "borrow.approve": "borrows.approve",
  "borrow.reject": "borrows.reject",
  "borrow.issue": "borrows.issue",
  "borrow.return": "borrows.return",
  "borrow.cancel": "borrows.edit",
  "borrow.remind": "borrows.overdue",
  "borrow.escalate": "borrows.overdue",
  "repair.create": "repairs.create",
  "repair.edit": "repairs.edit",
  "repair.diagnose": "repairs.diagnose",
  "repair.approve": "repairs.approve",
  "repair.reject": "repairs.approve",
  "repair.parts": "repairs.parts",
  "repair.start": "repairs.perform",
  "repair.external": "repairs.perform",
  "repair.test": "repairs.test",
  "repair.complete": "repairs.complete",
  "repair.unrepairable": "repairs.unrepairable",
  "repair.return": "repairs.return",
  "repair.cancel": "repairs.edit",
  "repair.progress": "repairs.perform",
  "maintenance.create": "maintenance.create",
  "maintenance.edit": "maintenance.edit",
  "maintenance.start": "maintenance.start",
  "maintenance.pause": "maintenance.start",
  "maintenance.resume": "maintenance.start",
  "maintenance.reschedule": "maintenance.reschedule",
  "maintenance.skip": "maintenance.skip",
  "maintenance.cancel": "maintenance.cancel",
  "maintenance.remind": "maintenance.manage",
  "maintenance.escalate": "maintenance.manage",
  "maintenance.complete": "maintenance.complete",
  "movement.create": "movements.create",
  "movement.correct": "movements.correct",
  "movement.approve": "movements.approve",
  "movement.complete": "movements.complete",
  "audit.create": "audits.create",
  "audit.edit": "audits.edit",
  "audit.generate": "audits.generate",
  "audit.freeze": "audits.freeze",
  "audit.prepare": "audits.prepare",
  "audit.start": "audits.start",
  "audit.pause": "audits.pause",
  "audit.resume": "audits.start",
  "audit.verify": "audits.review",
  "audit.discrepancy": "discrepancies.create",
  "audit.review": "audits.review",
  "audit.complete": "audits.complete",
  "audit.close": "audits.close",
  "audit.cancel": "audits.cancel",
  "discrepancy.assign": "discrepancies.assign",
  "discrepancy.recount": "discrepancies.review",
  "discrepancy.reclassify": "discrepancies.reclassify",
  "discrepancy.resolve": "discrepancies.resolve",
  "discrepancy.escalate": "discrepancies.escalate",
  "discrepancy.close": "discrepancies.close",
  "corrective.create": "corrective.create",
  "corrective.assign": "corrective.assign",
  "corrective.start": "corrective.perform",
  "corrective.approve": "corrective.approve",
  "corrective.reject": "corrective.reject",
  "corrective.complete": "corrective.perform",
  "corrective.verify": "corrective.verify",
  "corrective.reopen": "corrective.reopen",
  "disposal.create": "disposals.request",
  "disposal.inspect": "disposals.approve",
  "disposal.approve": "disposals.approve",
  "disposal.reject": "disposals.approve",
  "disposal.method": "disposals.approve",
  "disposal.complete": "disposals.approve",
  "disposal.archive": "disposals.approve",
  "reference.create": "settings.manage",
  "reference.edit": "settings.manage",
  "reference.archive": "settings.manage",
  "reference.restore": "settings.manage",
  "reference.delete": "settings.manage",
  "locationType.create": "locationTypes.manage",
  "locationType.edit": "locationTypes.manage",
  "locationType.activate": "locationTypes.manage",
  "locationType.deactivate": "locationTypes.manage",
  "locationType.reorder": "locationTypes.manage",
  "locationType.delete": "locationTypes.manage",
  "codeGroup.create": "admin.system.configure",
  "codeGroup.edit": "admin.system.configure",
  "codeGroup.activate": "admin.system.configure",
  "codeGroup.deactivate": "admin.system.configure",
  "codeGroup.reorder": "admin.system.configure",
  "codeGroup.delete": "admin.system.configure",
  "codeGroup.restore": "admin.system.configure",
  "user.create": "admin.users.manage",
  "user.edit": "admin.users.manage",
  "user.activate": "admin.users.manage",
  "user.deactivate": "admin.users.manage",
  "role.create": "admin.roles.manage",
  "role.edit": "admin.roles.manage",
  "report.create": "reports.custom.create",
  "report.edit": "reports.custom.create",
  "report.archive": "reports.custom.create",
  "report.restore": "reports.custom.create",
  "report.generate": "reports.generate",
  "report.export": "reports.csv",
  "report.print": "reports.print",
  "report.schedule.create": "reports.schedule",
  "report.schedule.edit": "reports.schedule",
  "report.schedule.pause": "reports.schedule",
  "report.schedule.resume": "reports.schedule",
  "report.schedule.run": "reports.schedule",
  "settings.appearance": "settings.manage",
  "settings.hierarchyValidation": "admin.system.configure",
  "notification.create": "notifications.defaults",
  "notification.read": "notifications.view",
  "notification.unread": "notifications.view",
  "notification.readAll": "notifications.view",
  "notification.dismiss": "notifications.view",
  "notification.restore": "notifications.view",
  "notification.escalate": "notifications.escalate",
  "notification.resolve": "notifications.resolve",
};

/**
 * Master Data create/update is authorized semantically (any authenticated,
 * verified, active AIMS user) and must never be blocked by unrelated UI feature
 * permissions such as dashboard.view, settings.manage or departments.manage.
 */
export type MasterDataPermission = "masterData.manage";

const masterDataMutations: readonly WorkflowAction[] = [
  "codeGroup.create",
  "codeGroup.edit",
  "codeGroup.activate",
  "codeGroup.deactivate",
  "codeGroup.reorder",
];

const masterDataDeletes: readonly WorkflowAction[] = [
  "codeGroup.delete",
  "codeGroup.restore",
  "reference.delete",
];

export function isMasterDataMutation(command: WorkflowCommand): boolean {
  if (masterDataMutations.includes(command.action)) return true;
  if (
    command.action === "reference.create" ||
    command.action === "reference.edit" ||
    command.action === "reference.archive" ||
    command.action === "reference.restore"
  ) {
    const kind = String(command.values?.kind || "");
    return kind === "location" || kind === "department";
  }
  return false;
}

export function isMasterDataDelete(command: WorkflowCommand): boolean {
  return masterDataDeletes.includes(command.action);
}

export function requiredPermission(
  command: WorkflowCommand,
): Permission | MasterDataPermission {
  if (command.action === "history.manual.saveDraft" && command.entityId)
    return "history.edit_manual";
  if (isMasterDataMutation(command) || isMasterDataDelete(command))
    return "masterData.manage";

  const permission = exactPermissions[command.action];
  if (!permission)
    throw new Error(`No permission mapping exists for ${command.action}.`);

  if (command.action.startsWith("reference.")) {
    const kind = String(command.values?.kind || "");
    if (kind === "category") return "categories.manage";
  }

  return permission;
}

export interface CommandActor {
  role?: Role;
  email?: string | null;
}

export function isCommandAllowed(
  command: WorkflowCommand,
  granted: readonly string[],
  denied: readonly string[] = [],
  actor: CommandActor = {},
) {
  if (isMasterDataMutation(command))
    return isAuthorizedAimsUser(actor.role, granted);
  if (isMasterDataDelete(command))
    return isAuthorizedAimsUser(actor.role, granted);

  const permission = requiredPermission(command);
  return granted.includes(permission) && !denied.includes(permission);
}

