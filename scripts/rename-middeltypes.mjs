/**
 * Rename asset.type values to match the new Middeltype dropdown.
 *   "Digibord"        → "Digibord 80/55 inch"
 *   "Battery Back up" → "Battery backup/UPS"
 * Usage: node scripts/rename-middeltypes.mjs --dry-run | --apply
 */
import { execFileSync } from "node:child_process";

const projectId = "aims-asset-inventory-system";
const apply = process.argv.includes("--apply");
if (!apply && !process.argv.includes("--dry-run"))
  throw new Error("Use --dry-run or --apply.");

const RENAMES = {
  Digibord: "Digibord 80/55 inch",
  "Battery Back up": "Battery backup/UPS",
};

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const gcloud =
  "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd";
const token = execFileSync(
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ["-NoProfile", "-Command", `& '${gcloud}' auth print-access-token`],
  { encoding: "utf8" },
).trim();

async function api(path, options = {}) {
  const r = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
async function list(coll) {
  const docs = [];
  let tok = "";
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

const assets = await list("assets");
const plan = assets
  .filter((d) => RENAMES[dec(d.fields?.type)])
  .map((d) => ({
    name: d.name,
    code: dec(d.fields.code),
    before: dec(d.fields.type),
    after: RENAMES[dec(d.fields.type)],
    updateTime: d.updateTime,
  }));

const summary = Object.fromEntries(
  Object.keys(RENAMES).map((k) => [k, plan.filter((p) => p.before === k).length]),
);
console.log(
  JSON.stringify(
    { mode: apply ? "apply" : "dry-run", total: plan.length, perType: summary },
    null,
    2,
  ),
);
if (!apply) process.exit(0);

const now = new Date().toISOString();
const writes = plan.map((p) => ({
  update: {
    name: p.name,
    fields: {
      type: { stringValue: p.after },
      updatedAt: { timestampValue: now },
      updatedBy: { stringValue: "owner-middeltype-rename" },
      lastUpdated: { stringValue: now.slice(0, 10) },
      lastModifiedBy: { stringValue: "owner-middeltype-rename" },
    },
  },
  updateMask: {
    fieldPaths: ["type", "updatedAt", "updatedBy", "lastUpdated", "lastModifiedBy"],
  },
  currentDocument: { updateTime: p.updateTime },
}));
writes.push({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/activityLogs/middeltype-rename-${Date.now()}`,
    fields: {
      action: { stringValue: "assets.type.bulkRename" },
      entityType: { stringValue: "asset" },
      entityId: { stringValue: "middeltype-rename-batch" },
      actorUserId: { stringValue: "owner-middeltype-rename" },
      actorEmail: { stringValue: "aliendas@kangoeroeschool.com" },
      reason: {
        stringValue:
          "Middeltype rename: Digibord→Digibord 80/55 inch; Battery Back up→Battery backup/UPS",
      },
      after: {
        mapValue: {
          fields: Object.fromEntries(
            Object.entries(summary).map(([k, v]) => [
              k,
              { integerValue: String(v) },
            ]),
          ),
        },
      },
      createdAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
      updatedBy: { stringValue: "owner-middeltype-rename" },
    },
  },
});
await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log(JSON.stringify({ applied: true, writes: writes.length }, null, 2));
