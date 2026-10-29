/**
 * Prefix every sub-department whose name matches 1A..8D with "Groep ".
 * Also updates the department string on every asset that referenced the
 * old bare label. Run with --dry-run first, then --apply.
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
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function list(collection) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const result = await api(`/${collection}?${query}`);
    documents.push(...(result.documents || []));
    pageToken = result.nextPageToken || "";
  } while (pageToken);
  return documents;
}

function decode(value) {
  if (!value) return undefined;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decode(v)]));
  throw new Error(`Unsupported Firestore value: ${JSON.stringify(value)}`);
}
function dataOf(d) { return Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, decode(v)])); }
function encode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: fieldsOf(value) } };
}
function fieldsOf(record) { return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, encode(v)])); }

const idOf = (d) => d.name.split("/").at(-1);
const subPattern = /^[1-8][A-D]$/;
const actor = "subdepartment-groep-prefix";
const now = new Date();

const collectionsScanned = ["departments", "references"];
const allDocs = new Map();
for (const coll of collectionsScanned) {
  try { allDocs.set(coll, await list(coll)); }
  catch (e) { allDocs.set(coll, []); console.error(`[warn] list ${coll}: ${e.message}`); }
}

// The renameMap is driven by the pattern itself so that even assets whose
// bare `department` string has no matching department document still get
// renormalized to the "Groep X" label.
const renameMap = new Map();
for (let grade = 1; grade <= 8; grade++)
  for (const section of ["A", "B", "C", "D"])
    renameMap.set(`${grade}${section}`, `Groep ${grade}${section}`);

const docRenames = [];
for (const coll of collectionsScanned) {
  for (const doc of allDocs.get(coll)) {
    const record = dataOf(doc);
    // In `departments` every doc is a department. In `references` only kind=department qualifies.
    if (coll === "references") {
      const kind = record.kind || record.type;
      if (kind !== "department" && kind !== "Department") continue;
    }
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!subPattern.test(name)) continue;
    const after = renameMap.get(name);
    if (!after || after === name) continue;
    docRenames.push({ collection: coll, document: doc, id: idOf(doc), before: name, after });
  }
}

const assetDocs = await list("assets");
const assetUpdates = [];
for (const doc of assetDocs) {
  const record = dataOf(doc);
  const dep = typeof record.department === "string" ? record.department.trim() : "";
  const after = renameMap.get(dep);
  if (!after || after === dep) continue;
  assetUpdates.push({ document: doc, id: idOf(doc), code: record.code || "", before: dep, after });
}

const summary = {
  mode: apply ? "apply" : "dry-run",
  scanned: Object.fromEntries(collectionsScanned.map((c) => [c, (allDocs.get(c) || []).length])),
  assetsScanned: assetDocs.length,
  departmentRenames: docRenames.length,
  renameMap: Object.fromEntries(renameMap),
  assetUpdates: assetUpdates.length,
  sampleDepartments: docRenames.slice(0, 40).map((r) => ({ collection: r.collection, id: r.id, before: r.before, after: r.after })),
  sampleAssets: assetUpdates.slice(0, 20).map((a) => ({ id: a.id, code: a.code, before: a.before, after: a.after })),
};
console.log(JSON.stringify(summary, null, 2));
if (!apply) process.exit(0);

const writes = [];
for (const r of docRenames) {
  const patch = { name: r.after, updatedAt: now, updatedBy: actor };
  writes.push({
    update: { name: r.document.name, fields: fieldsOf(patch) },
    updateMask: { fieldPaths: Object.keys(patch) },
    currentDocument: { updateTime: r.document.updateTime },
  });
}
for (const a of assetUpdates) {
  const patch = {
    department: a.after,
    updatedAt: now,
    updatedBy: actor,
    lastUpdated: now.toISOString().slice(0, 10),
    lastModifiedBy: actor,
  };
  writes.push({
    update: { name: a.document.name, fields: fieldsOf(patch) },
    updateMask: { fieldPaths: Object.keys(patch) },
    currentDocument: { updateTime: a.document.updateTime },
  });
}
writes.push({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/activityLogs/subdepartment-groep-prefix-${Date.now()}`,
    fields: fieldsOf({
      action: "department.groep-prefix.applied",
      entityType: "department",
      entityId: "sub-department-batch",
      actorUserId: actor,
      actorEmail: "",
      reason: "User-approved: prepend 'Groep ' to sub-locations 1A..8D",
      before: { labels: [...renameMap.keys()] },
      after: { labels: [...renameMap.values()], updatedDocuments: docRenames.length, updatedAssets: assetUpdates.length },
      createdAt: now,
      updatedAt: now,
      updatedBy: actor,
    }),
  },
});

const chunks = [];
for (let i = 0; i < writes.length; i += 450) chunks.push(writes.slice(i, i + 450));
for (const [i, chunk] of chunks.entries()) {
  await api(":commit", { method: "POST", body: JSON.stringify({ writes: chunk }) });
  console.log(`committed chunk ${i + 1}/${chunks.length} (${chunk.length} writes)`);
}
console.log(JSON.stringify({ applied: true, totalWrites: writes.length }, null, 2));
