/**
 * Set MON-19..MON-30 location to "KH Nieuw bouw" / sub-location "Computer lokaal".
 * Usage: node scripts/relocate-mon-19-30.mjs --dry-run | --apply
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
const SUB = "Computer lokaal";
const FULL = `${MAIN} / ${SUB}`;

const wanted = new Set();
for (let i = 19; i <= 30; i++) wanted.add(`MON-${i}`);

const assets = await list("assets");
const targets = assets.filter((d) => wanted.has(dec(d.fields?.code)));

const now = new Date().toISOString();
const plan = targets.map((d) => ({
  name: d.name,
  code: dec(d.fields.code),
  before: {
    location: dec(d.fields.location) || null,
    subLocation: dec(d.fields.subLocation) || null,
    locationFull: dec(d.fields.locationFull) || null,
  },
  updateTime: d.updateTime,
}));

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      matched: plan.length,
      sample: plan.slice(0, 3),
      missing: [...wanted].filter(
        (c) => !targets.some((d) => dec(d.fields.code) === c),
      ),
    },
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
      updatedAt: { timestampValue: now },
      updatedBy: { stringValue: "owner-relocate-mon-19-30" },
      lastUpdated: { stringValue: now.slice(0, 10) },
      lastModifiedBy: { stringValue: "owner-relocate-mon-19-30" },
    },
  },
  updateMask: {
    fieldPaths: [
      "location",
      "subLocation",
      "locationFull",
      "currentLocationPath",
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
    name: `projects/${projectId}/databases/(default)/documents/activityLogs/relocate-mon-19-30-${Date.now()}`,
    fields: {
      action: { stringValue: "assets.location.bulkUpdate" },
      entityType: { stringValue: "asset" },
      entityId: { stringValue: "MON-19..MON-30" },
      actorUserId: { stringValue: "owner-relocate-mon-19-30" },
      actorEmail: { stringValue: "aliendas@kangoeroeschool.com" },
      reason: {
        stringValue: `Set main location "${MAIN}" / sub "${SUB}" for MON-19..MON-30`,
      },
      after: {
        mapValue: {
          fields: {
            codes: {
              arrayValue: {
                values: plan.map((p) => ({ stringValue: p.code })),
              },
            },
          },
        },
      },
      createdAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
      updatedBy: { stringValue: "owner-relocate-mon-19-30" },
    },
  },
});

await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log(JSON.stringify({ applied: true, writes: writes.length }, null, 2));
