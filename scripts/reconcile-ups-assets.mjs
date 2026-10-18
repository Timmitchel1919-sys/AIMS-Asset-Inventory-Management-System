/**
 * Auditable UPS asset normalization approved on 2026-10-18.
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
const isUps = (value) => /^UPS(?:-|\s)?\d+$/i.test(String(value || "").trim());
const actor = "controlled-ups-asset-reconciliation";
const now = new Date();

const [assetDocs, categoryDocs, assetTypeDocs, referenceDocs] = await Promise.all([
  list("assets"), list("categories"), list("assetTypes"), list("references"),
]);
const assets = assetDocs.map((document) => ({ document, id: idOf(document), ...data(document) }));
const categories = categoryDocs.map((document) => ({ document, id: idOf(document), ...data(document) }));
const assetTypes = assetTypeDocs.map((document) => ({ document, id: idOf(document), ...data(document) }));
const references = referenceDocs.map((document) => ({ document, id: idOf(document), ...data(document) }));

const category = categories.find((item) => ["peripherals", "perpherals"].includes(normalized(item.name)) && item.isActive !== false && normalized(item.status) !== "inactive");
if (!category) throw new Error("No active Peripherals/Perpherals category exists in Master Data.");
const serializedType = assetTypes.find((item) => (normalized(item.id) === "serialized" || normalized(item.name) === "serialized") && item.isActive !== false && normalized(item.status) !== "inactive");
if (!serializedType) throw new Error("No active serialized tracking type exists in Master Data.");
if (Array.isArray(category.allowedAssetTypeIds) && category.allowedAssetTypeIds.length && !category.allowedAssetTypeIds.includes(serializedType.id))
  throw new Error(`Category ${category.name} does not allow tracking type ${serializedType.id}.`);

const targets = assets.filter((asset) => isUps(asset.code) && normalized(asset.code) !== "ups-012");
const excluded = assets.filter((asset) => normalized(asset.code) === "ups-012");
if (excluded.length !== 1) throw new Error(`Expected exactly one UPS-012, found ${excluded.length}.`);
const duplicateCodes = [...new Set(targets.map((asset) => normalized(asset.code)).filter((code, index, all) => all.indexOf(code) !== index))];
if (duplicateCodes.length) throw new Error(`Duplicate UPS codes: ${duplicateCodes.join(", ")}`);

const locationLines = /^(?:sub[ -]?location|location|locatie(?:\/groep)?)\s*:\s*(.+?)\s*$/gim;
function noteLocation(asset) {
  const notes = String(asset.notes || "");
  const matches = [...notes.matchAll(locationLines)];
  if (!matches.length) return null;
  const names = [...new Set(matches.map((match) => normalized(match[1])))];
  if (names.length !== 1) return { status: "ambiguous-note", noteValues: names };
  const value = matches[0][1].trim();
  const candidates = references.filter((item) => normalized(item.kind) === "department" && normalized(item.name) === names[0] && normalized(item.status) !== "archived");
  if (candidates.length > 1) return { status: "ambiguous-master-data", noteValues: names };
  const cleanedNotes = notes.replace(locationLines, "").replace(/\n{3,}/g, "\n\n").trim();
  return { status: "move", value, reference: candidates[0] || null, cleanedNotes };
}

const updates = [];
const review = [];
for (const asset of targets) {
  const patch = {};
  if (asset.brand !== "APC") patch.brand = "APC";
  if (asset.name !== "Battery backup") patch.name = "Battery backup";
  if (asset.category !== category.name) patch.category = category.name;
  if (asset.categoryId !== category.id) patch.categoryId = category.id;
  if (asset.assetTypeId !== serializedType.id) patch.assetTypeId = serializedType.id;
  const noteResult = noteLocation(asset);
  if (noteResult?.status === "move") {
    Object.assign(patch, {
      department: noteResult.value,
      departmentId: noteResult.reference?.id || null,
      notes: noteResult.cleanedNotes,
    });
  } else if (noteResult) {
    review.push({ code: asset.code, status: noteResult.status, noteValues: noteResult.noteValues });
  }
  if (Object.keys(patch).length) {
    Object.assign(patch, {
      lastUpdated: now.toISOString().slice(0, 10), lastModifiedBy: actor,
      updatedAt: now, updatedBy: actor,
    });
    updates.push({ asset, patch, noteResult });
  }
}

const summary = {
  mode: apply ? "apply" : "dry-run",
  assetsScanned: assets.length,
  targetCount: targets.length,
  updateCount: updates.length,
  excluded: excluded.map((asset) => ({ id: asset.id, code: asset.code, brand: asset.brand, name: asset.name, category: asset.category, assetTypeId: asset.assetTypeId })),
  classification: { categoryId: category.id, categoryName: category.name, assetTypeId: serializedType.id, assetTypeName: serializedType.name },
  noteLocationMoves: updates.filter((item) => item.noteResult?.status === "move").map((item) => ({ code: item.asset.code, subLocation: item.noteResult.value, departmentId: item.noteResult.reference?.id || null })),
  nonEmptyNotes: targets.filter((asset) => String(asset.notes || "").trim()).map((asset) => ({
    code: asset.code, subLocation: asset.department || "", notes: String(asset.notes).trim(),
  })),
  manualReview: review,
  targets: updates.map(({ asset, patch }) => ({ code: asset.code, changedFields: Object.keys(patch).filter((field) => !["lastUpdated", "lastModifiedBy", "updatedAt", "updatedBy"].includes(field)) })),
};
console.log(JSON.stringify(summary, null, 2));
if (!apply) process.exit(0);

const writes = updates.map(({ asset, patch }) => ({
  update: { name: asset.document.name, fields: fields(patch) },
  updateMask: { fieldPaths: Object.keys(patch) },
  currentDocument: { updateTime: asset.document.updateTime },
}));
writes.push({ update: {
  name: `projects/${projectId}/databases/(default)/documents/activityLogs/ups-asset-reconciliation-${Date.now()}`,
  fields: fields({
    action: "asset.reconcile.approved", entityType: "asset", entityId: "ups-asset-batch",
    actorUserId: actor, actorEmail: "", reason: "User-approved UPS asset normalization",
    before: { targetCount: targets.length, excludedCode: "UPS-012" },
    after: { updatedAssets: updates.length, category: category.name, assetTypeId: serializedType.id },
    createdAt: now, updatedAt: now, updatedBy: actor,
  }),
} });
if (writes.length > 500) throw new Error(`Firestore commit limit exceeded: ${writes.length} writes.`);
await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log(JSON.stringify({ applied: true, writes: writes.length }, null, 2));
