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

const [assetDocs, locationDocs] = await Promise.all([list("assets"), list("locations")]);
const assets = assetDocs.map((doc) => ({ id: idOf(doc), ...data(doc) }));
const locations = locationDocs.map((doc) => ({ id: idOf(doc), ...data(doc) }));

console.log("=== LOCATIONS ===");
for (const loc of locations) {
  console.log(`ID: ${loc.id}, Name: "${loc.name}", Type: "${loc.type}", MainId: "${loc.mainLocationId}"`);
}

console.log("\n=== BRAND 'Hp' or 'HP' ===");
const hpAssets = assets.filter(a => a.brand === "Hp" || a.brand === "HP" || String(a.brand).toLowerCase() === "hp");
console.log(`Found ${hpAssets.length} assets with brand hp/Hp/HP:`);
for (const a of hpAssets) {
  console.log(`Code: ${a.code}, Brand: "${a.brand}", Model: "${a.model}", Name: "${a.name}", Location: "${a.location}", MainLoc: "${a.mainLocationId}", Path: "${a.currentLocationPath}"`);
}

console.log("\n=== KB ASSETS (KB-19 to KB-45) ===");
const kbAssets = assets.filter(a => /^KB-/i.test(a.code)).sort((a, b) => {
  const na = parseInt(a.code.replace(/\D/g, ""), 10);
  const nb = parseInt(b.code.replace(/\D/g, ""), 10);
  return na - nb;
});
for (const a of kbAssets) {
  console.log(`Code: ${a.code}, Brand: "${a.brand}", Model: "${a.model}", Name: "${a.name}", Loc: "${a.location}", Dept: "${a.department}", Path: "${a.currentLocationPath}", AssignedTo: "${a.assignedTo}", Status: "${a.status}"`);
}

console.log("\n=== SHARP / DIGIBORD / PN-L862B ASSETS ===");
const sharpOrDigibord = assets.filter(a =>
  String(a.brand).toLowerCase().includes("sharp") ||
  String(a.model).toLowerCase().includes("pn-l862b") ||
  String(a.name).toLowerCase().includes("digibord") ||
  /^KCSDB/i.test(a.code)
);
console.log(`Found ${sharpOrDigibord.length} sharp/digibord assets:`);
for (const a of sharpOrDigibord) {
  console.log(`Code: ${a.code}, Brand: "${a.brand}", Model: "${a.model}", Name: "${a.name}", Loc: "${a.location}", Path: "${a.currentLocationPath}"`);
}
