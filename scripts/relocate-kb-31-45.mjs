/**
 * Set KB-31..KB-45: location = "KH Nieuw bouw", subLocation = "ICT-Kantoor",
 * assignedTo = "Algemeen". Owner-approved.
 * Usage: node scripts/relocate-kb-31-45.mjs --dry-run | --apply
 */
import { execFileSync } from "node:child_process";

const projectId = "aims-asset-inventory-system";
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

const MAIN = "KH Nieuw bouw";
const SUB = "ICT-Kantoor";
const FULL = `${MAIN} / ${SUB}`;
const ASSIGNEE = "Algemeen";

const wanted = new Set();
for (let i = 31; i <= 45; i++) wanted.add(`KB-${i}`);

const assets = await list("assets");
const targets = assets.filter((d) => wanted.has(dec(d.fields?.code)));

const now = new Date().toISOString();
const plan = targets.map((d) => ({
  name: d.name,
  code: dec(d.fields.code),
  updateTime: d.updateTime,
  before: {
    location: dec(d.fields.location) || null,
    subLocation: dec(d.fields.subLocation) || null,
    assignedTo: dec(d.fields.assignedTo) || null,
  },
}));

const missing = [...wanted].filter(
  (c) => !targets.some((d) => dec(d.fields.code) === c),
);
console.log(
  JSON.stringify(
    { mode: apply ? "apply" : "dry-run", matched: plan.length, missing },
    null,
    2,
  ),
);
if (!apply) process.exit(0);

const writes = plan.map((p) => ({
  update: {
    name: p.name,
    fields: {
      location: { stringValue: MAIN },
      subLocation: { stringValue: SUB },
      locationFull: { stringValue: FULL },
      currentLocationPath: { stringValue: FULL },
      assignedTo: { stringValue: ASSIGNEE },
      updatedAt: { timestampValue: now },
      updatedBy: { stringValue: "owner-relocate-kb-31-45" },
      lastUpdated: { stringValue: now.slice(0, 10) },
      lastModifiedBy: { stringValue: "owner-relocate-kb-31-45" },
    },
  },
  updateMask: {
    fieldPaths: [
      "location",
      "subLocation",
      "locationFull",
      "currentLocationPath",
      "assignedTo",
      "updatedAt",
      "updatedBy",
      "lastUpdated",
      "lastModifiedBy",
    ],
  },
  currentDocument: { updateTime: p.updateTime },
}));

writes.push({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/activityLogs/relocate-kb-31-45-${Date.now()}`,
    fields: {
      action: { stringValue: "assets.location.bulkUpdate" },
      entityType: { stringValue: "asset" },
      entityId: { stringValue: "KB-31..KB-45" },
      actorUserId: { stringValue: "owner-relocate-kb-31-45" },
      actorEmail: { stringValue: "aliendas@kangoeroeschool.com" },
      reason: {
        stringValue: `Set main "${MAIN}" / sub "${SUB}" / assignedTo "${ASSIGNEE}" for KB-31..KB-45`,
      },
      after: {
        mapValue: {
          fields: {
            codes: {
              arrayValue: { values: plan.map((p) => ({ stringValue: p.code })) },
            },
            missing: {
              arrayValue: { values: missing.map((c) => ({ stringValue: c })) },
            },
          },
        },
      },
      createdAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
      updatedBy: { stringValue: "owner-relocate-kb-31-45" },
    },
  },
});

await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log(JSON.stringify({ applied: true, writes: writes.length }, null, 2));
