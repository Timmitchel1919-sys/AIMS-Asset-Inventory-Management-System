/**
 * Rename category reference labels in Firestore.
 *   "Netwerk" → "Netwerk & Internet"
 *   "Cable"   → "Kabels"
 * Run with --dry-run first, then --apply.
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
  ["-NoProfile", "-Command", `& '${gcloud}' auth print-access-token`],
  { encoding: "utf8" },
).trim();

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function list(coll) {
  const docs = [];
  let tok = "";
  do {
    const q = new URLSearchParams({ pageSize: "300" });
    if (tok) q.set("pageToken", tok);
    const result = await api(`/${coll}?${q}`);
    docs.push(...(result.documents || []));
    tok = result.nextPageToken || "";
  } while (tok);
  return docs;
}

function dec(value) {
  if (!value) return;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("mapValue" in value)
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]),
    );
  if ("arrayValue" in value)
    return (value.arrayValue.values || []).map(dec);
}
function data(doc) {
  return Object.fromEntries(
    Object.entries(doc.fields || {}).map(([k, v]) => [k, dec(v)]),
  );
}
const norm = (value) =>
  String(value || "").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");

const renames = [
  { from: ["netwerk", "network"], to: "Netwerk & Internet" },
  { from: ["cable", "cables", "kabel"], to: "Kabels" },
];

const [categoryDocs, referenceDocs, assetDocs] = await Promise.all([
  list("categories"),
  list("references"),
  list("assets"),
]);

const updates = [];
const assetUpdates = [];
const now = new Date();

function pickRename(name) {
  const n = norm(name);
  return renames.find((rename) => rename.from.includes(n));
}

for (const doc of categoryDocs) {
  const row = data(doc);
  const rename = pickRename(row.name);
  if (!rename || rename.to === row.name) continue;
  updates.push({
    collection: "categories",
    name: doc.name,
    before: row.name,
    after: rename.to,
    updateTime: doc.updateTime,
  });
}
for (const doc of referenceDocs) {
  const row = data(doc);
  if (row.kind !== "category" && row.kind !== "Category") continue;
  const rename = pickRename(row.name);
  if (!rename || rename.to === row.name) continue;
  updates.push({
    collection: "references",
    name: doc.name,
    before: row.name,
    after: rename.to,
    updateTime: doc.updateTime,
  });
}

for (const doc of assetDocs) {
  const row = data(doc);
  const rename = pickRename(row.category);
  if (!rename || rename.to === row.category) continue;
  assetUpdates.push({
    name: doc.name,
    id: doc.name.split("/").at(-1),
    code: row.code || "",
    before: row.category,
    after: rename.to,
    updateTime: doc.updateTime,
  });
}

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      scanned: {
        categories: categoryDocs.length,
        references: referenceDocs.length,
        assets: assetDocs.length,
      },
      updates,
      assetUpdates: assetUpdates.length,
      assetSample: assetUpdates.slice(0, 20),
    },
    null,
    2,
  ),
);

if (!apply) process.exit(0);

const writes = updates.map((update) => ({
  update: {
    name: update.name,
    fields: {
      name: { stringValue: update.after },
      updatedAt: { timestampValue: now.toISOString() },
      updatedBy: { stringValue: "owner-category-rename" },
    },
  },
  updateMask: { fieldPaths: ["name", "updatedAt", "updatedBy"] },
  currentDocument: { updateTime: update.updateTime },
}));

for (const asset of assetUpdates) {
  writes.push({
    update: {
      name: asset.name,
      fields: {
        category: { stringValue: asset.after },
        updatedAt: { timestampValue: now.toISOString() },
        updatedBy: { stringValue: "owner-category-rename" },
        lastUpdated: { stringValue: now.toISOString().slice(0, 10) },
        lastModifiedBy: { stringValue: "owner-category-rename" },
      },
    },
    updateMask: {
      fieldPaths: [
        "category",
        "updatedAt",
        "updatedBy",
        "lastUpdated",
        "lastModifiedBy",
      ],
    },
    currentDocument: { updateTime: asset.updateTime },
  });
}

writes.push({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/activityLogs/category-rename-${Date.now()}`,
    fields: {
      action: { stringValue: "masterData.category.rename" },
      entityType: { stringValue: "masterData" },
      entityId: { stringValue: "category-rename-batch" },
      actorUserId: { stringValue: "owner-category-rename" },
      actorEmail: { stringValue: "aliendas@kangoeroeschool.com" },
      reason: {
        stringValue: "Owner-approved rename: Netwerk→Netwerk & Internet; Cable→Kabels",
      },
      before: {
        mapValue: {
          fields: {
            renames: {
              arrayValue: {
                values: updates.map((u) => ({
                  stringValue: `${u.collection}/${u.before} → ${u.after}`,
                })),
              },
            },
          },
        },
      },
      after: {
        mapValue: {
          fields: {
            updated: { integerValue: String(updates.length) },
            assets: { integerValue: String(assetUpdates.length) },
          },
        },
      },
      createdAt: { timestampValue: now.toISOString() },
      updatedAt: { timestampValue: now.toISOString() },
      updatedBy: { stringValue: "owner-category-rename" },
    },
  },
});

await api(":commit", { method: "POST", body: JSON.stringify({ writes }) });
console.log(
  JSON.stringify({ applied: true, writes: writes.length }, null, 2),
);
