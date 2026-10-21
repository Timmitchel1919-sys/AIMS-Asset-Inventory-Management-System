import { execFileSync } from "node:child_process";

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
const nowIso = new Date().toISOString();

const kcsdbLocationMapping = {
  "KCSDB54": { mainLocation: "KH nieuw bouw", subLocation: "Lokaal E5" },
  "KCSDB-54": { mainLocation: "KH nieuw bouw", subLocation: "Lokaal E5" },
  "KCSDB55": { mainLocation: "KH nieuw bouw", subLocation: "Practicum lokaal" },
  "KCSDB-55": { mainLocation: "KH nieuw bouw", subLocation: "Practicum lokaal" },
  "KCSDB56": { mainLocation: "KH nieuw bouw", subLocation: "Lokaal E6" },
  "KCSDB-56": { mainLocation: "KH nieuw bouw", subLocation: "Lokaal E6" },
  "KCSDB57": { mainLocation: "KH nieuw bouw", subLocation: "Lokaal E4" },
  "KCSDB-57": { mainLocation: "KH nieuw bouw", subLocation: "Lokaal E4" },
  "KCSDB58": { mainLocation: "KH nieuw bouw", subLocation: "Computer lokaal" },
  "KCSDB-58": { mainLocation: "KH nieuw bouw", subLocation: "Computer lokaal" },
  "KCSDB59": { mainLocation: "KH nieuw bouw", subLocation: "Lokaal B2" },
  "KCSDB-59": { mainLocation: "KH nieuw bouw", subLocation: "Lokaal B2" },
  "KCSDB60": { mainLocation: "KH nieuw bouw", subLocation: "Lokaal B3" },
  "KCSDB-60": { mainLocation: "KH nieuw bouw", subLocation: "Lokaal B3" },
  "KCSDB62": { mainLocation: "KH nieuw bouw", subLocation: "Lokaal E3" },
  "KCSDB-62": { mainLocation: "KH nieuw bouw", subLocation: "Lokaal E3" },
};

async function main() {
  const rawAssets = await list("assets");
  console.log(`Fetched ${rawAssets.length} assets from Firestore.`);

  let updatedCount = 0;
  const updates = [];

  for (const doc of rawAssets) {
    const id = idOf(doc);
    const asset = data(doc);
    const patch = {};

    // 1. All assets in ICT module should have tracking type serialized
    if (asset.assetTypeId !== "serialized") {
      patch.assetTypeId = "serialized";
    }

    // 2. Brand APC
    if (asset.brand && /^apc$/i.test(asset.brand) && asset.brand !== "APC") {
      patch.brand = "APC";
    }

    // 3. Brand HP
    if (asset.brand && /^hp$/i.test(asset.brand) && asset.brand !== "HP") {
      patch.brand = "HP";
    }

    // 4. Main location KH nieuw bouw
    if (asset.location && /^(kh|kangoeroe\s*high)\s*nieuw\s*bouw$/i.test(asset.location) && asset.location !== "KH nieuw bouw") {
      patch.location = "KH nieuw bouw";
    }

    // 5. Sub location ICT-Storage
    if (asset.department && /^ict[- ]?storage$/i.test(asset.department) && asset.department !== "ICT-Storage") {
      patch.department = "ICT-Storage";
    }

    // 6. Specific KCSDB-01: sub location Groep 1D
    const normalizedCode = asset.code?.toUpperCase().replace(/[-\s]/g, "");
    if (normalizedCode === "KCSDB01") {
      if (asset.department !== "Groep 1D") {
        patch.department = "Groep 1D";
      }
    }

    // 7. Specific KCSDB54, 55, 56, 57, 58, 59, 60, 62
    const mapped = kcsdbLocationMapping[asset.code?.toUpperCase()] || kcsdbLocationMapping[normalizedCode];
    if (mapped) {
      if (asset.location !== mapped.mainLocation) {
        patch.location = mapped.mainLocation;
      }
      if (asset.mainLocationId !== "loc-0031") {
        patch.mainLocationId = "loc-0031";
      }
      if (asset.department !== mapped.subLocation) {
        patch.department = mapped.subLocation;
      }
    }

    if (Object.keys(patch).length > 0) {
      patch.lastUpdated = nowIso;
      updates.push({ id, code: asset.code, patch });
    }
  }

  console.log(`Assets requiring update: ${updates.length}`);
  for (const u of updates.slice(0, 15)) {
    console.log(`- ${u.code} (${u.id}):`, JSON.stringify(u.patch));
  }
  if (updates.length > 15) {
    console.log(`... and ${updates.length - 15} more.`);
  }

  if (!apply) {
    console.log("\nDry-run completed. Run with --apply to commit changes to Firestore.");
    return;
  }

  console.log("\nApplying updates to Firestore...");
  for (const u of updates) {
    const fieldMask = Object.keys(u.patch).map((k) => `updateMask.fieldPaths=${k}`).join("&");
    await api(`/assets/${u.id}?${fieldMask}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: fields(u.patch) }),
    });
    updatedCount++;
    if (updatedCount % 25 === 0) {
      console.log(`Updated ${updatedCount}/${updates.length} assets...`);
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} assets in Firestore!`);
}

main().catch(console.error);
