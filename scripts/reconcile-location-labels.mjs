/**
 * Auditable location-label normalization approved on 2026-10-18.
 * Run --dry-run first. --apply uses Firestore update-time preconditions.
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
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
  throw new Error(`Unsupported Firestore value: ${JSON.stringify(value)}`);
}

function data(document) {
  return Object.fromEntries(Object.entries(document.fields || {}).map(([key, item]) => [key, decode(item)]));
}

function encode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: fields(value) } };
}

function fields(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, encode(value)]));
}

const idOf = (document) => document.name.split("/").at(-1);
const normalized = (value) => String(value || "").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
const actor = "controlled-location-label-reconciliation";
const now = new Date();
const replacements = new Map([
  ["kangoeroe school bovenbouw", "KCS Bovebouw"],
  ["kangoeroe high nieuw bouw", "KH Nieuw bouw"],
  ["practicum lokaal", "Practicum lokaal"],
  ["lokaal", "Lokaal"],
]);

const collections = ["assets", "locations", "references"];
const collectionDocs = new Map(await Promise.all(collections.map(async (collection) => [collection, await list(collection)])));
const matches = [];
for (const collection of collections) {
  for (const document of collectionDocs.get(collection)) {
    const record = data(document);
    for (const field of ["name", "location", "department", "currentLocationPath"]) {
      if (typeof record[field] !== "string") continue;
      const exact = replacements.get(normalized(record[field]));
      let after = exact;
      if (!after && field === "currentLocationPath") {
        after = record[field].split(" / ").map((segment) => replacements.get(normalized(segment)) || segment).join(" / ");
        if (after === record[field]) after = undefined;
      }
      if (after && after !== record[field]) matches.push({ collection, document, id: idOf(document), code: record.code || "", field, before: record[field], after });
    }
  }
}

const grouped = new Map();
for (const match of matches) {
  const key = `${match.collection}/${match.id}`;
  const current = grouped.get(key) || { collection: match.collection, document: match.document, id: match.id, patch: {}, changes: [] };
  current.patch[match.field] = match.after;
  current.code = match.code;
  current.changes.push({ field: match.field, before: match.before, after: match.after });
  grouped.set(key, current);
}
for (const item of grouped.values()) {
  item.patch.updatedAt = now;
  item.patch.updatedBy = actor;
  if (item.collection === "assets") {
    item.patch.lastUpdated = now.toISOString().slice(0, 10);
    item.patch.lastModifiedBy = actor;
  }
}

const summary = {
  mode: apply ? "apply" : "dry-run",
  scanned: Object.fromEntries(collections.map((collection) => [collection, collectionDocs.get(collection).length])),
  documentUpdates: grouped.size,
  byCollection: Object.fromEntries(collections.map((collection) => [collection, [...grouped.values()].filter((item) => item.collection === collection).length])),
  countsByLabel: Object.fromEntries([...replacements].map(([before, after]) => [
    `${before} -> ${after}`,
    matches.filter((match) => normalized(match.before) === before || (match.field === "currentLocationPath" && normalized(match.before).split(" / ").includes(before))).length,
  ])),
  sample: [...grouped.values()].slice(0, 20).map((item) => ({ collection: item.collection, id: item.id, code: item.code, changes: item.changes })),
};
console.log(JSON.stringify(summary, null, 2));
if (!apply) process.exit(0);

const writes = [...grouped.values()].map((item) => ({
  update: { name: item.document.name, fields: fields(item.patch) },
  updateMask: { fieldPaths: Object.keys(item.patch) },
  currentDocument: { updateTime: item.document.updateTime },
}));
writes.push({ update: {
  name: `projects/${projectId}/databases/(default)/documents/activityLogs/location-label-reconciliation-${Date.now()}`,
  fields: fields({
    action: "asset.location-labels.reconcile.approved", entityType: "asset", entityId: "location-label-batch",
    actorUserId: actor, actorEmail: "", reason: "User-approved location label normalization",
    before: { labels: [...replacements.keys()] }, after: { labels: [...replacements.values()], updatedDocuments: grouped.size },
    createdAt: now, updatedAt: now, updatedBy: actor,
  }),
} });
if (writes.length > 500) throw new Error(`Firestore commit limit exceeded: ${writes.length} writes.`);
await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log(JSON.stringify({ applied: true, writes: writes.length }, null, 2));
