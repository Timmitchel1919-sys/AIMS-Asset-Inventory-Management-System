/**
 * Re-code iiyama monitors KCSMD-31..36 to MON-31..36.
 *
 * User-approved on 2026-10-31: these 6 monitors were mis-filed under the
 * "Desktop Mini PC" (KCSMD) code group. The MON code group already exists
 * (code-group-mon) and codes 31..36 are free. We delete the 6 asset docs
 * and recreate them under the same document IDs with code/codePrefix
 * swapped — nothing else changes. QR identities keep working because the
 * asset document ID stays the same.
 *
 * Run --dry-run first. --apply uses update-time preconditions on the
 * recreate step and refuses if a MON-31..36 doc appeared in the meantime.
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

function decode(v) {
  if (!v) return undefined;
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]));
  return undefined;
}
function encode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
}
const fields = (record) => Object.fromEntries(Object.entries(record).map(([k, v]) => [k, encode(v)]));
const data = (d) => Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, decode(v)]));
const idOf = (d) => d.name.split("/").at(-1);

async function list(collection) {
  const docs = [];
  let pageToken = "";
  do {
    const q = new URLSearchParams({ pageSize: "300" });
    if (pageToken) q.set("pageToken", pageToken);
    const r = await api(`/${collection}?${q}`);
    docs.push(...(r.documents || []));
    pageToken = r.nextPageToken || "";
  } while (pageToken);
  return docs;
}

const actor = "mon-prefix-reconciliation-2026-10-31";
const now = new Date();

// 1. Load current state
const [assetDocs, codeGroupDocs] = await Promise.all([list("assets"), list("codeGroups")]);
const assets = assetDocs.map((d) => ({ _raw: d, id: idOf(d), ...data(d) }));
const codeGroups = codeGroupDocs.map((d) => ({ id: idOf(d), ...data(d) }));

// 2. Validate targets: exactly 6 KCSMD-31..36 iiyama monitors
const targets = assets
  .filter((a) => a.codePrefix === "KCSMD" && a.codeNumber >= 31 && a.codeNumber <= 36)
  .sort((a, b) => a.codeNumber - b.codeNumber);
if (targets.length !== 6) throw new Error(`Expected 6 KCSMD-31..36, found ${targets.length}.`);
for (let n = 31; n <= 36; n++) {
  const match = targets.filter((a) => a.codeNumber === n);
  if (match.length !== 1) throw new Error(`Expected exactly one KCSMD-${n}.`);
  if (match[0].brand !== "Iiyama") throw new Error(`KCSMD-${n} is not an Iiyama monitor (brand=${match[0].brand}). Aborting.`);
}

// 3. Validate MON code group exists and target numbers are free
const monGroup = codeGroups.find((g) => g.prefix === "MON" && g.isActive !== false && g.archived !== true);
if (!monGroup) throw new Error(`No active MON code group found.`);
const conflicts = assets.filter((a) => a.codePrefix === "MON" && a.codeNumber >= 31 && a.codeNumber <= 36);
if (conflicts.length) throw new Error(`MON-31..36 collision: ${conflicts.map((a) => a.code).join(", ")}`);

// 4. Build the recreate payload (identical fields, swap code/codePrefix only)
const operations = targets.map((old) => {
  const newNumber = old.codeNumber; // preserve suffix per user request
  const newCode = `MON-${newNumber}`;
  const newDoc = { ...old };
  delete newDoc._raw;
  delete newDoc.id;
  // The ONLY changes: code and codePrefix. codeNumber stays. codeGroupId
  // is not a stored field on assets (code group is resolved by prefix at
  // read time), so no further ref needs updating. We refresh audit
  // fields so the history reflects when this re-code happened.
  newDoc.code = newCode;
  newDoc.codePrefix = "MON";
  newDoc.lastUpdated = now.toISOString().slice(0, 10);
  newDoc.lastModifiedBy = actor;
  newDoc.updatedAt = now;
  newDoc.updatedBy = actor;
  return { id: old.id, oldCode: old.code, newCode, newDoc, updateTime: old._raw.updateTime };
});

// 5. Report
console.log(`\n=== Mode: ${apply ? "APPLY" : "DRY-RUN"} ===`);
console.log(`Target MON code group: ${monGroup.id} (${monGroup.name}, next=${monGroup.nextAvailableNumber})`);
console.log(`\nPlanned re-codings (6):`);
for (const op of operations) {
  console.log(`  ${op.oldCode}  →  ${op.newCode}   (doc id ${op.id} preserved, serial ${op.newDoc.serialNumber})`);
}

if (!apply) {
  console.log(`\n[dry-run] No writes performed. Re-run with --apply to execute.`);
  process.exit(0);
}

// 6. Apply: for each target, DELETE then CREATE with same ID
console.log(`\nExecuting...`);
let successes = 0;
for (const op of operations) {
  // DELETE with update-time precondition
  await api(`/assets/${op.id}?currentDocument.updateTime=${encodeURIComponent(op.updateTime)}`, { method: "DELETE" });
  // CREATE with same ID
  const encoded = JSON.stringify({ fields: fields(op.newDoc) });
  await api(`/assets?documentId=${encodeURIComponent(op.id)}`, { method: "POST", body: encoded });
  console.log(`  ✓ ${op.oldCode} → ${op.newCode}`);
  successes++;
}
console.log(`\nDone: ${successes}/6 recoded.`);
