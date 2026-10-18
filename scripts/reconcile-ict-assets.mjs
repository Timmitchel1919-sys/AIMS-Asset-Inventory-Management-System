/**
 * One-off, auditable reconciliation for the ICT asset corrections approved on
 * 2026-10-17. Run --dry-run first; --apply uses update-time preconditions so a
 * concurrent production change aborts instead of being overwritten.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const projectId = "aims-asset-inventory-system";
const apply = process.argv.includes("--apply");
if (!apply && !process.argv.includes("--dry-run"))
  throw new Error("Use --dry-run or --apply.");

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
  if ("mapValue" in value)
    return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
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
const canonical = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const normalizedLocation = (value) => String(value || "").toUpperCase().replace(/[^A-Z]/g, "");
const isComputerRoomLegacy = (value) => [
  "LERARENKAMERCOMPUTERLOKAAL",
  "LERERARENKAMERCOMPUTERLOKAAL",
  "LERARENKAMERCOMPUTERLOKAAL",
].includes(normalizedLocation(value));
const kbNumber = (code) => {
  const match = String(code || "").toUpperCase().match(/^KB-(\d+)$/);
  return match ? Number(match[1]) : null;
};

const dependencyCollections = [
  "assignments", "borrows", "repairs", "maintenanceRecords", "assetMovements",
  "audits", "auditDiscrepancies", "correctiveActions", "disposals",
];
const [assetDocs, locationDocs, groupDocs, codeDocs, qrDocs, historyDocs, dependencySets] = await Promise.all([
  list("assets"), list("locations"), list("codeGroups"), list("assetCodes"),
  list("qrIdentities"), list("assetHistoryEvents"),
  Promise.all(dependencyCollections.map(async (collection) => [collection, await list(collection)])),
]);
const assets = assetDocs.map((document) => ({ document, id: idOf(document), ...data(document) }));
const byCode = new Map(assets.map((asset) => [canonical(asset.code), asset]));
const targetCodeCounts = new Map();
for (const asset of assets) {
  const code = canonical(asset.code);
  if (code === "FINAD01" || code === "FINAD02" || code === "UPS102" || code === "UPS103" || /^KB(?:19|2\d|3\d|4[0-5])$/.test(code))
    targetCodeCounts.set(code, (targetCodeCounts.get(code) || 0) + 1);
}
const duplicateTargetCodes = [...targetCodeCounts].filter(([, count]) => count > 1).map(([code]) => code);
if (duplicateTargetCodes.length)
  throw new Error(`Duplicate target asset codes: ${duplicateTargetCodes.join(", ")}`);

const main = locationDocs.map((document) => ({ document, id: idOf(document), ...data(document) }))
  .find((item) => item.id === "loc-0031" || String(item.name).toLowerCase() === "kh nieuw bouw");
if (!main) throw new Error("Main location KH Nieuw Bouw was not found.");
const upsGroup = groupDocs.map((document) => ({ document, id: idOf(document), ...data(document) }))
  .find((item) => String(item.prefix).toUpperCase() === "UPS" && item.isActive !== false);
if (!upsGroup) throw new Error("Active UPS code group was not found.");

const now = new Date();
const actor = "controlled-ict-asset-reconciliation";
const mainName = "KH Nieuw bouw";
const locationDefinitions = [
  { id: "sub-kh-new-computer-room", name: "Computer lokaal" },
  { id: "sub-kh-new-ict-storage", name: "ICT-Storage" },
];
const existingLocations = locationDocs.map((document) => ({ document, id: idOf(document), ...data(document) }));
const resolvedLocations = locationDefinitions.map((definition) => {
  const existing = existingLocations.find((item) =>
    item.mainLocationId === main.id && String(item.name).trim().toLowerCase() === definition.name.toLowerCase());
  return existing || { ...definition, document: null };
});
const [computerRoom, ictStorage] = resolvedLocations;

const deletes = ["Fin.Ad01", "Fin.Ad02"].map((code) => byCode.get(canonical(code)));
if (deletes.some((item) => !item)) throw new Error("Fin.Ad01 and Fin.Ad02 must both exist before deletion.");
const deleteIds = new Set(deletes.map((item) => item.id));
const deleteCodes = new Set(deletes.map((item) => canonical(item.code)));

const locationTargets = assets.filter((asset) => isComputerRoomLegacy(asset.location));
const keyboardTargets = assets.filter((asset) => {
  const number = kbNumber(asset.code);
  return number !== null && number >= 19 && number <= 45;
});
if (keyboardTargets.length !== 27)
  throw new Error(`Expected KB-19 through KB-45 (27 assets), found ${keyboardTargets.length}.`);

const updateMap = new Map();
function addPatch(asset, patch, reason) {
  const current = updateMap.get(asset.id) || { asset, patch: {}, reasons: [] };
  Object.assign(current.patch, patch);
  current.reasons.push(reason);
  updateMap.set(asset.id, current);
}
for (const asset of locationTargets)
  addPatch(asset, {
    location: computerRoom.name,
    currentLocationId: computerRoom.id,
    homeLocationId: computerRoom.id,
    mainLocationId: main.id,
    currentLocationPath: `${mainName} / ${computerRoom.name}`,
  }, "legacy computer-room location");
for (const asset of keyboardTargets) {
  const number = kbNumber(asset.code);
  addPatch(asset, { name: "Keyborad wired" }, "KB-19 through KB-45 name");
  if (number >= 31)
    addPatch(asset, {
      location: ictStorage.name,
      currentLocationId: ictStorage.id,
      homeLocationId: ictStorage.id,
      mainLocationId: main.id,
      currentLocationPath: `${mainName} / ${ictStorage.name}`,
    }, "KB-31 through KB-45 storage location");
}
for (const item of updateMap.values()) {
  item.patch.lastUpdated = now.toISOString().slice(0, 10);
  item.patch.lastModifiedBy = actor;
  item.patch.updatedAt = now;
  item.patch.updatedBy = actor;
}

const upsDefinitions = [
  { code: "UPS-102", number: 102, serialNumber: "0B2423P05088", assignedTo: "REGINA", location: "Finance", department: "Finance", condition: "Good", notes: "" },
  { code: "UPS-103", number: 103, serialNumber: "0B2141P02836", assignedTo: "Switch Conference room", location: "", department: "", condition: "Fair", notes: "UPS bleef een geluid maken nadat stroom was uitgevallen" },
];
const upsCreates = upsDefinitions.map((definition) => {
  const existing = byCode.get(canonical(definition.code));
  if (existing) return { existing, definition };
  return {
    id: `manual-ups-${definition.number}`,
    definition,
    record: {
      code: definition.code, codePrefix: "UPS", codeNumber: definition.number,
      codeGroupId: upsGroup.id, name: "APC", description: "", category: "BATTERY BACKUP",
      subcategory: "", type: "Device", brand: "APC", model: "", serialNumber: definition.serialNumber,
      barcode: "", location: definition.location, department: definition.department,
      assignedTo: definition.assignedTo, status: definition.assignedTo ? "Assigned" : "Available",
      condition: definition.condition, purchaseDate: "", warrantyExpiry: "", lastUpdated: now.toISOString().slice(0, 10),
      lastModifiedBy: actor, maintenanceRequired: false, attachments: [], photos: [], notes: definition.notes,
      qr: true, qrToken: randomBytes(18).toString("base64url"), createdAt: now, createdBy: actor,
      updatedAt: now, updatedBy: actor,
    },
  };
});

const linkedCodeDocs = codeDocs.filter((document) => {
  const record = data(document);
  return deleteIds.has(record.assetId) || deleteCodes.has(canonical(record.code || idOf(document)));
});
const linkedQrDocs = qrDocs.filter((document) => deleteIds.has(data(document).assetId));
const linkedHistoryDocs = historyDocs.filter((document) => deleteIds.has(data(document).assetId));
const linkedOperational = Object.fromEntries(dependencySets.map(([collection, documents]) => [
  collection,
  documents.filter((document) => {
    const record = data(document);
    return deleteIds.has(record.assetId) || deleteCodes.has(canonical(record.assetCode));
  }).map((document) => idOf(document)),
]));
const operationalDependencyCount = Object.values(linkedOperational).reduce((sum, ids) => sum + ids.length, 0);
if (operationalDependencyCount)
  throw new Error(`Fin.Ad assets still have operational dependencies: ${JSON.stringify(linkedOperational)}`);
const summary = {
  mode: apply ? "apply" : "dry-run",
  productionAssetsScanned: assets.length,
  permanentDeletes: deletes.map((item) => ({ id: item.id, code: item.code })),
  linkedDeletes: {
    assetCodes: linkedCodeDocs.map((item) => ({ id: idOf(item), assetId: data(item).assetId || "", code: data(item).code || "" })),
    qrIdentities: linkedQrDocs.map((item) => ({ id: idOf(item), assetId: data(item).assetId || "" })),
    assetHistoryEvents: linkedHistoryDocs.map((item) => ({ id: idOf(item), assetId: data(item).assetId || "" })),
    operationalDependencies: linkedOperational,
  },
  mainLocation: { id: main.id, before: main.name, after: mainName, prefix: main.details?.prefix || "" },
  subLocations: resolvedLocations.map((item) => ({ id: item.id, name: item.name, create: !item.document })),
  legacyComputerRoomMoves: locationTargets.length,
  keyboardRenames: keyboardTargets.length,
  ictStorageMoves: keyboardTargets.filter((item) => kbNumber(item.code) >= 31).length,
  totalAssetUpdates: updateMap.size,
  ups: upsCreates.map((item) => ({ code: item.definition.code, action: item.existing ? "already-exists" : "create" })),
};
console.log(JSON.stringify(summary, null, 2));
if (!apply) process.exit(0);

const writes = [];
const documentName = (collection, id) => `projects/${projectId}/databases/(default)/documents/${collection}/${id}`;
const deleteWrite = (document) => ({ delete: document.name, currentDocument: { updateTime: document.updateTime } });
for (const asset of deletes) writes.push(deleteWrite(asset.document));
for (const document of [...linkedCodeDocs, ...linkedQrDocs, ...linkedHistoryDocs]) writes.push(deleteWrite(document));

if (main.name !== mainName)
  writes.push({
    update: { name: main.document.name, fields: fields({ name: mainName, updatedAt: now, updatedBy: actor }) },
    updateMask: { fieldPaths: ["name", "updatedAt", "updatedBy"] },
    currentDocument: { updateTime: main.document.updateTime },
  });
for (const location of resolvedLocations) {
  if (location.document) continue;
  writes.push({
    update: { name: documentName("locations", location.id), fields: fields({
      kind: "location", name: location.name, type: "Sub-location", typeId: "sub-location",
      status: "Active", parentId: main.id, parentLocationId: main.id,
      containerLocationId: main.id, mainLocationId: main.id, relatedCount: 0,
      details: { manuallyCreated: true }, createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
    }) },
    currentDocument: { exists: false },
  });
}
for (const { asset, patch } of updateMap.values())
  writes.push({
    update: { name: asset.document.name, fields: fields(patch) },
    updateMask: { fieldPaths: Object.keys(patch) },
    currentDocument: { updateTime: asset.document.updateTime },
  });
for (const item of upsCreates) {
  if (item.existing) continue;
  writes.push({ update: { name: documentName("assets", item.id), fields: fields(item.record) }, currentDocument: { exists: false } });
  writes.push({ update: { name: documentName("assetCodes", item.definition.code), fields: fields({
    code: item.definition.code, codeGroupId: upsGroup.id, assetId: item.id, reservedBy: actor, createdAt: now,
  }) }, currentDocument: { exists: false } });
  writes.push({ update: { name: documentName("qrIdentities", item.record.qrToken), fields: fields({
    assetId: item.id, status: "ACTIVE", source: "created", createdAt: now, updatedAt: now, createdBy: actor, updatedBy: actor,
  }) }, currentDocument: { exists: false } });
}
writes.push({ update: { name: documentName("activityLogs", `ict-asset-reconciliation-${Date.now()}`), fields: fields({
  action: "asset.reconcile.approved", entityType: "asset", entityId: "ict-asset-batch",
  actorUserId: actor, actorEmail: "", reason: "User-approved ICT asset cleanup and location reconciliation",
  before: { deletedCodes: deletes.map((item) => item.code), legacyComputerRoomAssets: locationTargets.length },
  after: { updatedAssets: updateMap.size, createdAssets: upsCreates.filter((item) => !item.existing).map((item) => item.definition.code) },
  createdAt: now, updatedAt: now, updatedBy: actor,
}) } });
if (writes.length > 500) throw new Error(`Firestore commit limit exceeded: ${writes.length} writes.`);

await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log(JSON.stringify({ applied: true, writes: writes.length }, null, 2));
