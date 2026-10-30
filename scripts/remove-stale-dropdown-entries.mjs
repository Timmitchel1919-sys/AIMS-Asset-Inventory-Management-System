/**
 * Remove stale Hoofdlocatie / Sub-locatie entries from the ICT asset form
 * dropdowns. User-approved on 2026-10-30 by the Owner.
 * Run with --dry-run first, then --apply.
 */
import { execFileSync } from "node:child_process";

const projectId = "aims-asset-inventory-system";
const apply = process.argv.includes("--apply");
if (!apply && !process.argv.includes("--dry-run")) throw new Error("Use --dry-run or --apply.");

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const gcloud = "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd";
const token = execFileSync(
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ["-NoProfile", "-Command", `& '${gcloud}' auth print-access-token`],
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
    const q = new URLSearchParams({ pageSize: "300" });
    if (tok) q.set("pageToken", tok);
    const r = await api(`/${coll}?${q}`);
    docs.push(...(r.documents || []));
    tok = r.nextPageToken || "";
  } while (tok);
  return docs;
}
function dec(v){if(!v)return;if("stringValue"in v)return v.stringValue;if("integerValue"in v)return Number(v.integerValue);if("booleanValue"in v)return v.booleanValue;if("timestampValue"in v)return v.timestampValue;if("mapValue"in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,dec(x)]));if("arrayValue"in v)return(v.arrayValue.values||[]).map(dec);}
function data(d){return Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,dec(v)]));}
const norm = (s) => String(s || "").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");

const hoofdlocatieToRemove = new Set(["ict-storage", "computer lokaal"].map(norm));
const sublocatieToRemove = new Set([
  "admin/secr", "administratie/secr", "facilitaire",
  "ict-kaantoor", "ict kantoor", "ict-storage",
  "ict", "kcs ko/o.b", "kcs ko/nso", "storage", "ko/nso", "lok",
].map(norm));

const [locationDocs, departmentDocs, referenceDocs, assetDocs] = await Promise.all([
  list("locations"), list("departments"), list("references"), list("assets"),
]);

const deletes = [];

for (const d of locationDocs) {
  const r = data(d);
  const name = norm(r.name);
  if (hoofdlocatieToRemove.has(name)) {
    deletes.push({ collection: "locations", name: d.name, display: r.name, kind: `Hoofdlocatie (${r.type || "?"})`, updateTime: d.updateTime });
  }
}
for (const d of departmentDocs) {
  const r = data(d);
  const name = norm(r.name);
  if (sublocatieToRemove.has(name)) {
    deletes.push({ collection: "departments", name: d.name, display: r.name, kind: "Sub-locatie", updateTime: d.updateTime });
  }
}
for (const d of referenceDocs) {
  const r = data(d);
  const kind = r.kind || r.type;
  const name = norm(r.name);
  if ((kind === "department" || kind === "Department") && sublocatieToRemove.has(name)) {
    deletes.push({ collection: "references", name: d.name, display: r.name, kind: "Sub-locatie (references)", updateTime: d.updateTime });
  }
  if ((kind === "location" || kind === "Location") && hoofdlocatieToRemove.has(name)) {
    deletes.push({ collection: "references", name: d.name, display: r.name, kind: "Hoofdlocatie (references)", updateTime: d.updateTime });
  }
}

// Clear the asset.department string on any asset still carrying one of the
// stale labels — otherwise the Sub-locatie dropdown rebuilds it from assets.
const now = new Date();
const assetClears = [];
for (const d of assetDocs) {
  const r = data(d);
  const dep = String(r.department || "").trim();
  if (!dep) continue;
  if (sublocatieToRemove.has(norm(dep))) {
    assetClears.push({ name: d.name, id: d.name.split("/").at(-1), code: r.code || "", before: dep, updateTime: d.updateTime });
  }
}

const summary = {
  mode: apply ? "apply" : "dry-run",
  scanned: { locations: locationDocs.length, departments: departmentDocs.length, references: referenceDocs.length, assets: assetDocs.length },
  deleteCount: deletes.length,
  items: deletes.map((d) => ({ collection: d.collection, id: d.name.split("/").at(-1), kind: d.kind, display: d.display })),
  assetClearCount: assetClears.length,
  assetSample: assetClears.slice(0, 40).map((a) => ({ id: a.id, code: a.code, before: a.before })),
};
console.log(JSON.stringify(summary, null, 2));
if (!apply) process.exit(0);

const writes = deletes.map((d) => ({
  delete: d.name,
  currentDocument: { updateTime: d.updateTime },
}));
for (const a of assetClears) {
  writes.push({
    update: {
      name: a.name,
      fields: {
        department: { stringValue: "" },
        departmentId: { nullValue: null },
        updatedAt: { timestampValue: now.toISOString() },
        updatedBy: { stringValue: "owner-dropdown-cleanup" },
        lastUpdated: { stringValue: now.toISOString().slice(0, 10) },
        lastModifiedBy: { stringValue: "owner-dropdown-cleanup" },
      },
    },
    updateMask: { fieldPaths: ["department", "departmentId", "updatedAt", "updatedBy", "lastUpdated", "lastModifiedBy"] },
    currentDocument: { updateTime: a.updateTime },
  });
}
writes.push({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/activityLogs/stale-dropdown-removal-${Date.now()}`,
    fields: {
      action: { stringValue: "masterData.dropdown.cleanup" },
      entityType: { stringValue: "masterData" },
      entityId: { stringValue: "dropdown-cleanup-batch" },
      actorUserId: { stringValue: "owner-dropdown-cleanup" },
      actorEmail: { stringValue: "aliendas@kangoeroeschool.com" },
      reason: { stringValue: "Owner-approved removal of stale ICT dropdown entries" },
      before: { mapValue: { fields: { items: { arrayValue: { values: deletes.map((d) => ({ stringValue: `${d.collection}/${d.display}` })) } } } } },
      after: { mapValue: { fields: { removed: { integerValue: String(deletes.length) } } } },
      createdAt: { timestampValue: new Date().toISOString() },
      updatedAt: { timestampValue: new Date().toISOString() },
      updatedBy: { stringValue: "owner-dropdown-cleanup" },
    },
  },
});
await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log(JSON.stringify({ applied: true, writes: writes.length }, null, 2));
