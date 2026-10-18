/**
 * Auditable KB-20 through KB-45 reconciliation approved on 2026-10-18.
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
const kbNumber = (code) => {
  const match = String(code || "").trim().match(/^KB-(\d+)$/i);
  return match ? Number(match[1]) : null;
};
const actor = "controlled-keyboard-asset-reconciliation";
const now = new Date();

const [assetDocs, locationDocs, assignmentDocs] = await Promise.all([list("assets"), list("locations"), list("assignments")]);
const assets = assetDocs.map((document) => ({ document, id: idOf(document), ...data(document) }));
const locations = locationDocs.map((document) => ({ document, id: idOf(document), ...data(document) }));
const assignments = assignmentDocs.map((document) => ({ document, id: idOf(document), ...data(document) }));
const targets = assets.filter((asset) => {
  const number = kbNumber(asset.code);
  return number !== null && number >= 20 && number <= 45;
}).sort((a, b) => kbNumber(a.code) - kbNumber(b.code));
if (targets.length !== 26) throw new Error(`Expected KB-20 through KB-45 (26 assets), found ${targets.length}.`);
for (let number = 20; number <= 45; number++) {
  if (targets.filter((asset) => kbNumber(asset.code) === number).length !== 1) throw new Error(`Expected exactly one KB-${number}.`);
}
const main = locations.find((item) => item.id === "loc-0031" || normalized(item.name) === "kh nieuw bouw");
if (!main) throw new Error("Main location KH Nieuw bouw was not found.");

const updates = [];
for (const asset of targets) {
  const number = kbNumber(asset.code);
  const patch = {
    location: "KH Nieuw bouw",
    currentLocationId: main.id,
    homeLocationId: main.id,
    mainLocationId: main.id,
    currentLocationPath: "KH Nieuw bouw",
    department: number <= 30 ? "Computer lokaal" : "ICT-Storage",
    departmentId: null,
  };
  if (number <= 30) Object.assign(patch, { assignedTo: "Algemeen", assignedUserId: null, status: "Assigned" });
  else Object.assign(patch, { brand: "HP", model: "HS-P010K" });
  const changed = Object.fromEntries(Object.entries(patch).filter(([key, value]) => (asset[key] ?? null) !== value));
  if (!Object.keys(changed).length) continue;
  Object.assign(changed, {
    lastUpdated: now.toISOString().slice(0, 10), lastModifiedBy: actor,
    updatedAt: now, updatedBy: actor,
  });
  updates.push({ asset, patch: changed });
}

const relatedAssignments = assignments.filter((assignment) => targets.some((asset) =>
  assignment.assetId === asset.id || normalized(assignment.assetCode) === normalized(asset.code)));
const activeAssignments = relatedAssignments.filter((item) => item.active === true || normalized(item.status) === "active");
for (const assignment of activeAssignments) {
  const number = kbNumber(assignment.assetCode || targets.find((asset) => asset.id === assignment.assetId)?.code);
  if (number >= 20 && number <= 30 && normalized(assignment.assignee) !== "algemeen")
    throw new Error(`${assignment.assetCode || assignment.assetId} already has an active assignment to ${assignment.assignee}.`);
}
const existingReferences = new Set(assignments.map((item) => normalized(item.reference)));
let nextReference = Math.max(0, ...assignments.map((item) => {
  const match = String(item.reference || "").match(/^ASN-\d{4}-(\d+)$/i);
  return match ? Number(match[1]) : 0;
})) + 1;
const assignmentCreates = targets.filter((asset) => {
  const number = kbNumber(asset.code);
  return number <= 30 && !activeAssignments.some((item) => item.assetId === asset.id || normalized(item.assetCode) === normalized(asset.code));
}).map((asset) => {
  let reference;
  do reference = `ASN-${now.getUTCFullYear()}-${String(nextReference++).padStart(4, "0")}`;
  while (existingReferences.has(normalized(reference)));
  existingReferences.add(normalized(reference));
  return {
    id: `controlled-${normalized(asset.code).replace(/[^a-z0-9]+/g, "-")}-assignment`,
    record: {
      reference, assetId: asset.id, assetCode: asset.code, assetName: asset.name,
      category: asset.category || "", assignee: "Algemeen", assigneeType: "Employee",
      department: "Computer lokaal", location: "KH Nieuw bouw",
      assignedAt: now.toISOString().slice(0, 10), expectedReturn: "", assignedBy: actor, approvedBy: "",
      status: "Active", active: true, conditionAtIssue: asset.condition || "Good",
      operationalStatusAtIssue: asset.status || "Available", accessories: [], notes: "Assigned by approved KB-20 through KB-45 reconciliation.",
      attachments: [], assigneeSignature: "Not captured (controlled reconciliation)",
      staffSignature: "Not captured (controlled reconciliation)", signature: "Not captured (controlled reconciliation)",
      createdBy: actor, createdAt: now, modifiedBy: actor, lastUpdated: now, updatedBy: actor, updatedAt: now,
      history: [{ id: "h-1", at: now.toISOString(), user: actor, type: "Creation", description: "Assignment created and activated.", next: { status: "Active" }, relatedRecord: asset.code }],
    },
  };
});
const summary = {
  mode: apply ? "apply" : "dry-run",
  assetsScanned: assets.length,
  targets: targets.length,
  updates: updates.length,
  assignmentCreates: assignmentCreates.length,
  mainLocation: { id: main.id, name: main.name },
  currentAssignments: relatedAssignments.map((item) => ({
    id: item.id, assetId: item.assetId || "", assetCode: item.assetCode || "", assignee: item.assignee || "", status: item.status || "",
    record: Object.fromEntries(Object.entries(item).filter(([key]) => !["document"].includes(key))),
  })),
  changes: updates.map(({ asset, patch }) => ({ code: asset.code, fields: Object.keys(patch).filter((key) => !["lastUpdated", "lastModifiedBy", "updatedAt", "updatedBy"].includes(key)) })),
};
console.log(JSON.stringify(summary, null, 2));
if (!apply) process.exit(0);

const writes = updates.map(({ asset, patch }) => ({
  update: { name: asset.document.name, fields: fields(patch) },
  updateMask: { fieldPaths: Object.keys(patch) },
  currentDocument: { updateTime: asset.document.updateTime },
}));
const documentName = (collection, id) => `projects/${projectId}/databases/(default)/documents/${collection}/${id}`;
for (const item of assignmentCreates)
  writes.push({ update: { name: documentName("assignments", item.id), fields: fields(item.record) }, currentDocument: { exists: false } });
writes.push({ update: {
  name: `projects/${projectId}/databases/(default)/documents/activityLogs/keyboard-asset-reconciliation-${Date.now()}`,
  fields: fields({
    action: "asset.keyboard.reconcile.approved", entityType: "asset", entityId: "kb-20-45",
    actorUserId: actor, actorEmail: "", reason: "User-approved KB-20 through KB-45 location and ownership correction",
    before: { targetCount: targets.length }, after: { updatedAssets: updates.length, createdAssignments: assignmentCreates.length },
    createdAt: now, updatedAt: now, updatedBy: actor,
  }),
} });
if (writes.length > 500) throw new Error(`Firestore commit limit exceeded: ${writes.length} writes.`);
await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log(JSON.stringify({ applied: true, writes: writes.length }, null, 2));
