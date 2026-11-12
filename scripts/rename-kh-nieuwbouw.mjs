/**
 * Rename "KH Nieuw bouw" → "KH Nieuwbouw" across locations + asset text fields.
 * Usage: node scripts/rename-kh-nieuwbouw.mjs --dry-run | --apply
 */
import { execFileSync } from "node:child_process";

const projectId = "aims-asset-inventory-system";
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
const now = new Date().toISOString();

const OLD = "KH Nieuw bouw";
const NEW = "KH Nieuwbouw";

const [locations, assets] = await Promise.all([list("locations"), list("assets")]);

const locTargets = locations.filter(d => dec(d.fields.name) === OLD);
const assetTargets = assets.filter(d => dec(d.fields.location) === OLD);
const assetPaths = assets.filter(d => {
  const path = dec(d.fields.currentLocationPath) || dec(d.fields.locationFull) || "";
  return path.includes(OLD);
});

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  locations: locTargets.length,
  assetsLocation: assetTargets.length,
  assetsPath: assetPaths.length,
}, null, 2));
if (!apply) process.exit(0);

const writes = [];
for (const d of locTargets) {
  writes.push({
    update: {
      name: d.name,
      fields: { name: { stringValue: NEW }, updatedAt: { timestampValue: now }, updatedBy: { stringValue: "owner-rename-kh" } },
    },
    updateMask: { fieldPaths: ["name","updatedAt","updatedBy"] },
    currentDocument: { updateTime: d.updateTime },
  });
}
const assetDocsToUpdate = new Map();
for (const d of assetTargets) assetDocsToUpdate.set(d.name, d);
for (const d of assetPaths) assetDocsToUpdate.set(d.name, d);

for (const [name, d] of assetDocsToUpdate) {
  const path = dec(d.fields.currentLocationPath);
  const full = dec(d.fields.locationFull);
  const loc = dec(d.fields.location);
  const fields = {
    updatedAt: { timestampValue: now },
    updatedBy: { stringValue: "owner-rename-kh" },
    lastUpdated: { stringValue: now.slice(0,10) },
    lastModifiedBy: { stringValue: "owner-rename-kh" },
  };
  const mask = ["updatedAt","updatedBy","lastUpdated","lastModifiedBy"];
  if (loc === OLD) { fields.location = { stringValue: NEW }; mask.push("location"); }
  if (full && full.includes(OLD)) { fields.locationFull = { stringValue: full.replaceAll(OLD, NEW) }; mask.push("locationFull"); }
  if (path && path.includes(OLD)) { fields.currentLocationPath = { stringValue: path.replaceAll(OLD, NEW) }; mask.push("currentLocationPath"); }
  writes.push({ update: { name, fields }, updateMask: { fieldPaths: mask }, currentDocument: { updateTime: d.updateTime } });
}
writes.push({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/activityLogs/rename-kh-nieuwbouw-${Date.now()}`,
    fields: {
      action: { stringValue: "masterData.location.rename" },
      entityType: { stringValue: "location" },
      entityId: { stringValue: "KH Nieuw bouw → KH Nieuwbouw" },
      actorUserId: { stringValue: "owner-rename-kh" },
      actorEmail: { stringValue: "aliendas@kangoeroeschool.com" },
      reason: { stringValue: `Rename ${OLD} → ${NEW}` },
      after: { mapValue: { fields: {
        locations: { integerValue: String(locTargets.length) },
        assets: { integerValue: String(assetDocsToUpdate.size) },
      } } },
      createdAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
      updatedBy: { stringValue: "owner-rename-kh" },
    },
  },
});
await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log(JSON.stringify({ applied: true, writes: writes.length }, null, 2));
