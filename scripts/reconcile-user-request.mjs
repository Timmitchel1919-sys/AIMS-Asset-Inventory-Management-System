import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const projectId = "aims-asset-inventory-system";
const apply = process.argv.includes("--apply");

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
const now = new Date();
const actor = "controlled-ict-asset-reconciliation";

const [assetDocs, locationDocs, assignmentDocs] = await Promise.all([
  list("assets"),
  list("locations"),
  list("assignments"),
]);

const assets = assetDocs.map((doc) => ({ document: doc, id: idOf(doc), ...data(doc) }));
const locations = locationDocs.map((doc) => ({ document: doc, id: idOf(doc), ...data(doc) }));
const assignments = assignmentDocs.map((doc) => ({ document: doc, id: idOf(doc), ...data(doc) }));

const mainLoc = locations.find((l) => l.id === "loc-0031" || /kh\s*nieuw\s*bouw/i.test(l.name));
const computerRoom = locations.find((l) => l.id === "sub-kh-new-computer-room" || (/computer\s*lokaal/i.test(l.name) && l.mainLocationId === mainLoc?.id));

console.log("Main location:", mainLoc ? `${mainLoc.id} (${mainLoc.name})` : "NOT FOUND");
console.log("Sub location Computer lokaal:", computerRoom ? `${computerRoom.id} (${computerRoom.name})` : "NOT FOUND");

const updates = [];

// 1. Check all assets for brand "Hp" -> "HP"
for (const asset of assets) {
  const patch = {};
  if (asset.brand && asset.brand.toLowerCase() === "hp" && asset.brand !== "HP") {
    patch.brand = "HP";
  }
  // Model HS-P010K check
  if (asset.model && asset.model.toLowerCase() === "hs-p010k" && asset.model !== "HS-P010K") {
    patch.model = "HS-P010K";
  }
  // Model PN-L862B check
  if (asset.model && asset.model.toLowerCase() === "pn-l862b" && asset.model !== "PN-L862B") {
    patch.model = "PN-L862B";
  }
  if (Object.keys(patch).length > 0) {
    patch.lastUpdated = now.toISOString().slice(0, 10);
    patch.lastModifiedBy = actor;
    patch.updatedAt = now;
    patch.updatedBy = actor;
    updates.push({ asset, patch, reason: "Brand/model casing standardization" });
  }
}

// 2. KB-19 reconciliation:
// "bij de KB-19 asset verander de main location naar KH nieuw bouw en sub location Computer lokaal, user is Algemeen."
const kb19 = assets.find((a) => a.code === "KB-19");
let assignmentCreate = null;

if (kb19) {
  const kb19Patch = {
    brand: "HP",
    model: "HS-P010K",
    name: "Keyboard wired",
    mainLocationId: mainLoc?.id || "loc-0031",
    currentLocationId: computerRoom?.id || "sub-kh-new-computer-room",
    homeLocationId: computerRoom?.id || "sub-kh-new-computer-room",
    location: "KH Nieuw bouw",
    department: "Computer lokaal",
    departmentId: null,
    currentLocationPath: "KH Nieuw bouw / Computer lokaal",
    assignedTo: "Algemeen",
    assignedUserId: null,
    status: "Assigned",
    lastUpdated: now.toISOString().slice(0, 10),
    lastModifiedBy: actor,
    updatedAt: now,
    updatedBy: actor,
  };
  
  // Check what differs from current kb19
  const changed = Object.fromEntries(
    Object.entries(kb19Patch).filter(([k, v]) => (kb19[k] ?? null) !== v)
  );
  if (Object.keys(changed).length > 0) {
    Object.assign(changed, {
      lastUpdated: now.toISOString().slice(0, 10),
      lastModifiedBy: actor,
      updatedAt: now,
      updatedBy: actor,
    });
    // Remove if already in updates
    const existingIdx = updates.findIndex((u) => u.asset.id === kb19.id);
    if (existingIdx >= 0) updates.splice(existingIdx, 1);
    updates.push({ asset: kb19, patch: changed, reason: "KB-19 location and user update" });
  }

  // Check if KB-19 has an active assignment
  const existingAssign = assignments.find(
    (a) => (a.assetId === kb19.id || a.assetCode === "KB-19") && (a.active === true || a.status === "Active")
  );
  if (!existingAssign) {
    let nextReference = Math.max(0, ...assignments.map((item) => {
      const match = String(item.reference || "").match(/^ASN-\d{4}-(\d+)$/i);
      return match ? Number(match[1]) : 0;
    })) + 1;
    const reference = `ASN-${now.getUTCFullYear()}-${String(nextReference).padStart(4, "0")}`;
    assignmentCreate = {
      id: `controlled-kb-19-assignment`,
      record: {
        reference,
        assetId: kb19.id,
        assetCode: "KB-19",
        assetName: kb19.name || "Keyboard wired",
        category: kb19.category || "Accessories",
        assignee: "Algemeen",
        assigneeType: "Employee",
        department: "Computer lokaal",
        location: "KH Nieuw bouw",
        assignedAt: now.toISOString().slice(0, 10),
        expectedReturn: "",
        assignedBy: actor,
        approvedBy: "",
        status: "Active",
        active: true,
        conditionAtIssue: kb19.condition || "Good",
        operationalStatusAtIssue: "Assigned",
        accessories: [],
        notes: "Assigned by approved KB-19 reconciliation.",
        attachments: [],
        assigneeSignature: "Not captured (controlled reconciliation)",
        staffSignature: "Not captured (controlled reconciliation)",
        signature: "Not captured (controlled reconciliation)",
        createdBy: actor,
        createdAt: now,
        modifiedBy: actor,
        lastUpdated: now,
        updatedBy: actor,
        updatedAt: now,
        history: [{
          id: "h-1",
          at: now.toISOString(),
          user: actor,
          type: "Creation",
          description: "Assignment created and activated.",
          next: { status: "Active" },
          relatedRecord: "KB-19"
        }],
      }
    };
  }
} else {
  console.warn("Asset KB-19 not found!");
}

console.log(`Plan: ${updates.length} asset updates, ${assignmentCreate ? "1" : "0"} assignment creates.`);
for (const u of updates) {
  console.log(`Update ${u.asset.code} (${u.reason}):`, u.patch);
}
if (assignmentCreate) {
  console.log("Create assignment:", assignmentCreate.record.reference, "for", assignmentCreate.record.assetCode);
}

if (!apply) {
  console.log("Dry run finished. Run with --apply to commit.");
  process.exit(0);
}

// Build commit writes
const writes = updates.map(({ asset, patch }) => ({
  update: { name: asset.document.name, fields: fields(patch) },
  updateMask: { fieldPaths: Object.keys(patch) },
  currentDocument: { updateTime: asset.document.updateTime },
}));

if (assignmentCreate) {
  writes.push({
    update: {
      name: `projects/${projectId}/databases/(default)/documents/assignments/${assignmentCreate.id}`,
      fields: fields(assignmentCreate.record)
    },
    // We don't enforce exists: false if it already exists
  });
}

// Activity log
writes.push({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/activityLogs/reconcile-ict-assets-${Date.now()}`,
    fields: fields({
      action: "asset.update",
      event: "ASSET_UPDATE",
      entityType: "asset",
      entityId: "kb-19",
      actor: actor,
      user: actor,
      at: now.toISOString(),
      result: "Success",
      detail: "Reconciled KB-19 location and assignee, brand HP and models",
      createdAt: now,
      updatedAt: now,
      createdBy: "VogTjC6S1aXHO6ySBbdiQ7LNOYG3",
      updatedBy: "VogTjC6S1aXHO6ySBbdiQ7LNOYG3"
    })
  }
});

const result = await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log("Committed successfully:", JSON.stringify(result));
