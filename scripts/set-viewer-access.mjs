/**
 * Set read-only (viewer) access for one or more users by email.
 * Usage: node scripts/set-viewer-access.mjs --dry-run
 *        node scripts/set-viewer-access.mjs --apply
 *
 * Target emails are hardcoded below. A user must have signed in once so the
 * users/{uid} doc exists; otherwise the script prints "missing" and the owner
 * re-runs after the person's first sign-in.
 */
import { execFileSync } from "node:child_process";

const projectId = "aims-asset-inventory-system";
const TARGETS = [
  "sastropawiroe@kangoeroeschool.com",
  "karoer@kangoeroeschool.com",
];

const VIEWER_PERMISSIONS = [
  "dashboard.view",
  "assets.view",
  "assets.viewTechnicalDetails",
  "history.view",
  "inventory.view",
  "inventory.financial.view",
  "inventory.movements.view",
  "assignments.view",
  "assignments.history",
  "borrows.view",
  "borrows.history",
  "borrows.overdue",
  "repairs.view",
  "repairs.history",
  "maintenance.view",
  "maintenance.history",
  "movements.view",
  "audits.view",
  "audits.history",
  "discrepancies.view",
  "corrective.view",
  "reports.view",
  "reports.history",
  "notifications.view",
  "notifications.history",
  "management.view",
  "management.assets",
  "management.inventory",
  "management.service",
  "management.audits",
  "management.lifecycle",
  "management.risks",
  "activity.view",
  "disposals.view",
  "legal.read",
];

const apply = process.argv.includes("--apply");
if (!apply && !process.argv.includes("--dry-run"))
  throw new Error("Use --dry-run or --apply.");

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const gcloud =
  "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd";
const token = execFileSync(
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ["-NoProfile", "-Command", `& '${gcloud}' auth print-access-token`],
  { encoding: "utf8" },
).trim();

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok)
    throw new Error(`${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
async function list(coll) {
  const docs = [];
  let tok = "";
  do {
    const q = new URLSearchParams({ pageSize: "300" });
    if (tok) q.set("pageToken", tok);
    const r = await api(`/${coll}?${q}`);
    docs.push(...(r.documents || []));
    tok = r.nextPageToken || "";
  } while (tok);
  return docs;
}
const dec = (v) => {
  if (!v) return;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
};
const data = (d) =>
  Object.fromEntries(
    Object.entries(d.fields || {}).map(([k, v]) => [k, dec(v)]),
  );

const users = await list("users");
const matches = new Map();
for (const target of TARGETS) {
  const hits = users.filter(
    (u) =>
      (data(u).email || "").toLowerCase() === target.toLowerCase(),
  );
  matches.set(target, hits.map((h) => h.name.split("/").pop()));
}

const now = new Date().toISOString();
const plan = [];
for (const [email, uids] of matches.entries()) {
  if (!uids.length) {
    plan.push({ email, status: "missing-first-login" });
    continue;
  }
  for (const uid of uids) plan.push({ email, uid, status: "will-update" });
}

console.log(
  JSON.stringify({ mode: apply ? "apply" : "dry-run", plan }, null, 2),
);
if (!apply) process.exit(0);

const writes = [];
for (const entry of plan) {
  if (entry.status !== "will-update") continue;
  writes.push({
    update: {
      name: `projects/${projectId}/databases/(default)/documents/accessAssignments/${entry.uid}`,
      fields: {
        uid: { stringValue: entry.uid },
        role: { stringValue: "viewer" },
        permissions: {
          arrayValue: {
            values: VIEWER_PERMISSIONS.map((p) => ({ stringValue: p })),
          },
        },
        denials: { arrayValue: { values: [] } },
        active: { booleanValue: true },
        allRecords: { booleanValue: true },
        departmentIds: { arrayValue: { values: [] } },
        locationIds: { arrayValue: { values: [] } },
        updatedAt: { timestampValue: now },
        updatedBy: { stringValue: "owner-viewer-grant" },
      },
    },
  });
  writes.push({
    update: {
      name: `projects/${projectId}/databases/(default)/documents/users/${entry.uid}`,
      fields: {
        role: { stringValue: "viewer" },
        updatedAt: { timestampValue: now },
        updatedBy: { stringValue: "owner-viewer-grant" },
      },
    },
    updateMask: { fieldPaths: ["role", "updatedAt", "updatedBy"] },
  });
}
writes.push({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/activityLogs/viewer-grant-${Date.now()}`,
    fields: {
      action: { stringValue: "access.viewer.grant" },
      entityType: { stringValue: "accessAssignment" },
      entityId: { stringValue: "viewer-grant-batch" },
      actorUserId: { stringValue: "owner-viewer-grant" },
      actorEmail: { stringValue: "aliendas@kangoeroeschool.com" },
      reason: {
        stringValue:
          "Owner-approved viewer access for sastropawiroe & karoer.",
      },
      after: {
        mapValue: {
          fields: {
            plan: {
              arrayValue: {
                values: plan.map((p) => ({
                  stringValue: `${p.email} ${p.uid || ""} ${p.status}`.trim(),
                })),
              },
            },
          },
        },
      },
      createdAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
      updatedBy: { stringValue: "owner-viewer-grant" },
    },
  },
});

await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log(JSON.stringify({ applied: true, writes: writes.length }, null, 2));
