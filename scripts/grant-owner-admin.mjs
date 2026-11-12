/**
 * Grant administrator accessAssignment to every users/{uid} doc whose email is
 * in OWNERS. Idempotent. Usage: node scripts/grant-owner-admin.mjs --dry-run|--apply
 */
import { execFileSync } from "node:child_process";

const projectId = "aims-asset-inventory-system";
const OWNERS = ["aliendas@kangoeroeschool.com"];

const ADMIN_PERMISSIONS = [
  "dashboard.view","assets.view","assets.create","assets.import","assets.edit","assets.archive","assets.viewTechnicalDetails",
  "history.view","history.create_manual","history.edit_manual","history.delete_manual",
  "inventory.view","inventory.manage","inventory.create","inventory.import","inventory.edit","inventory.receive","inventory.issue","inventory.transfer","inventory.return","inventory.reserve","inventory.reservations.approve","inventory.correct","inventory.financial.view","inventory.export","inventory.archive","inventory.restore","inventory.movements.view",
  "categories.manage","locations.manage","departments.manage",
  "assignments.manage","assignments.view","assignments.create","assignments.edit","assignments.approve","assignments.return","assignments.reassign","assignments.export","assignments.print","assignments.history",
  "borrow.manage","borrows.view","borrows.create","borrows.edit","borrows.approve","borrows.reject","borrows.issue","borrows.partialReturn","borrows.return","borrows.overdue","borrows.export","borrows.print","borrows.history",
  "repairs.manage","repairs.view","repairs.create","repairs.edit","repairs.diagnose","repairs.approve","repairs.parts","repairs.perform","repairs.test","repairs.complete","repairs.unrepairable","repairs.return","repairs.export","repairs.print","repairs.history","repairs.costs",
  "maintenance.manage","maintenance.view","maintenance.create","maintenance.edit","maintenance.assign","maintenance.start","maintenance.complete","maintenance.skip","maintenance.reschedule","maintenance.cancel","maintenance.export","maintenance.print","maintenance.history",
  "movements.manage","movements.view","movements.create","movements.approve","movements.complete","movements.correct","movements.export","movements.print","movements.sensitive.view",
  "audits.view","audits.perform","audits.create","audits.edit","audits.generate","audits.freeze","audits.prepare","audits.start","audits.scan","audits.evidence","audits.pause","audits.review","audits.amend","audits.complete","audits.close","audits.cancel","audits.reopen","audits.export","audits.print","audits.history",
  "discrepancies.view","discrepancies.create","discrepancies.assign","discrepancies.review","discrepancies.reclassify","discrepancies.resolve","discrepancies.escalate","discrepancies.close",
  "corrective.view","corrective.create","corrective.assign","corrective.perform","corrective.approve","corrective.reject","corrective.verify","corrective.reopen",
  "auditAdjustments.assets","auditAdjustments.stock","auditAdjustments.approve","auditAdjustments.repair","auditAdjustments.maintenance","auditAdjustments.loss","auditAdjustments.disposal",
  "reports.view","reports.generate","reports.custom.create","reports.private.save","reports.shared.publish","reports.csv","reports.excel","reports.print","reports.financial","reports.personal","reports.schedule","reports.history",
  "notifications.view","notifications.role.view","notifications.preferences","notifications.defaults","notifications.history","notifications.escalate","notifications.resolve",
  "management.view","management.assets","management.inventory","management.service","management.audits","management.lifecycle","management.risks","management.export","management.financial",
  "assistant.use","users.manage","roles.manage","activity.view",
  "disposals.view","disposals.request","disposals.approve",
  "settings.manage","locationTypes.manage",
  "legal.read","legal.manage","legal.approve","legal.publish","legal.audit",
  "admin.access","admin.users.manage","admin.roles.manage","admin.audit.read","admin.legal.manage","admin.system.configure",
];

const apply = process.argv.includes("--apply");
if (!apply && !process.argv.includes("--dry-run"))
  throw new Error("Use --dry-run or --apply.");

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const gcloud = "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd";
const token = execFileSync(
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ["-NoProfile","-Command",`& '${gcloud}' auth print-access-token`],
  { encoding: "utf8" },
).trim();

async function api(path, options = {}) {
  const r = await fetch(`${base}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
async function list(coll) {
  const docs = []; let tok = "";
  do {
    const q = new URLSearchParams({ pageSize: "500" });
    if (tok) q.set("pageToken", tok);
    const r = await api(`/${coll}?${q}`);
    docs.push(...(r.documents || []));
    tok = r.nextPageToken || "";
  } while (tok);
  return docs;
}
const dec = (v) => (v && "stringValue" in v ? v.stringValue : undefined);

const users = await list("users");
const uids = users
  .filter(u => OWNERS.includes((dec(u.fields?.email) || "").toLowerCase()))
  .map(u => u.name.split("/").pop());
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", uids }, null, 2));
if (!apply) process.exit(0);

const now = new Date().toISOString();
const writes = uids.map(uid => ({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/accessAssignments/${uid}`,
    fields: {
      uid: { stringValue: uid },
      role: { stringValue: "administrator" },
      permissions: { arrayValue: { values: ADMIN_PERMISSIONS.map(p => ({ stringValue: p })) } },
      denials: { arrayValue: { values: [] } },
      active: { booleanValue: true },
      allRecords: { booleanValue: true },
      departmentIds: { arrayValue: { values: [] } },
      locationIds: { arrayValue: { values: [] } },
      updatedAt: { timestampValue: now },
      updatedBy: { stringValue: "owner-self-restore" },
    },
  },
}));
writes.push({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/activityLogs/owner-admin-restore-${Date.now()}`,
    fields: {
      action: { stringValue: "access.admin.restore" },
      entityType: { stringValue: "accessAssignment" },
      entityId: { stringValue: "owner-restore" },
      actorUserId: { stringValue: "owner-self-restore" },
      actorEmail: { stringValue: OWNERS[0] },
      reason: { stringValue: "Restore administrator for owner email(s)" },
      after: { mapValue: { fields: { uids: { arrayValue: { values: uids.map(u => ({ stringValue: u })) } } } } },
      createdAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
      updatedBy: { stringValue: "owner-self-restore" },
    },
  },
});
await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log(JSON.stringify({ applied: true, writes: writes.length }, null, 2));
