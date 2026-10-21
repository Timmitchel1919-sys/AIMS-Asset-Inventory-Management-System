import { execFileSync } from "node:child_process";

const projectId = "aims-asset-inventory-system";
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

const idOf = (document) => document.name.split("/").at(-1);

async function main() {
  const rawAssets = await list("assets");
  const assets = rawAssets.map((doc) => ({ id: idOf(doc), ...data(doc) }));
  console.log(`Total assets: ${assets.length}`);

  const rawRefs = await list("references");
  const refs = rawRefs.map((doc) => ({ id: idOf(doc), ...data(doc) }));
  console.log(`Total references: ${refs.length}`);

  // Find references matching KH Nieuw bouw and related locations
  const khRefs = refs.filter((r) => /kh|nieuw\s*bouw|computer|lokaal|practicum|storage/i.test(r.name));
  console.log("Relevant references:", khRefs.map((r) => ({ id: r.id, kind: r.kind, name: r.name, parentId: r.parentId, details: r.details })));

  // Target codes:
  const targetCodes = ["KCSDB-01", "KCSDB54", "KCSDB55", "KCSDB56", "KCSDB57", "KCSDB58", "KCSDB59", "KCSDB60", "KCSDB62"];
  const targetAssets = assets.filter((a) => targetCodes.some((code) => a.code?.toUpperCase().replace(/[-\s]/g, "") === code.toUpperCase().replace(/[-\s]/g, "")));
  console.log("Target assets found:", targetAssets.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    brand: a.brand,
    location: a.location,
    mainLocationId: a.mainLocationId,
    department: a.department,
    currentLocationId: a.currentLocationId,
    assetTypeId: a.assetTypeId,
  })));

  // Check Hp brands
  const hpAssets = assets.filter((a) => /^hp$/i.test(a.brand || ""));
  console.log(`HP assets count: ${hpAssets.length}, distinct values:`, [...new Set(hpAssets.map((a) => a.brand))]);

  // Check Apc brands
  const apcAssets = assets.filter((a) => /^apc$/i.test(a.brand || ""));
  console.log(`APC assets count: ${apcAssets.length}, distinct values:`, [...new Set(apcAssets.map((a) => a.brand))]);

  // Check tracking types
  const withoutTracking = assets.filter((a) => a.assetTypeId !== "serialized");
  console.log(`Assets with assetTypeId !== "serialized": ${withoutTracking.length}`);
}

main().catch(console.error);
