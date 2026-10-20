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

const [assetDocs, assignmentDocs] = await Promise.all([list("assets"), list("assignments")]);
const assets = assetDocs.map((doc) => ({ id: idOf(doc), ...data(doc), _raw: doc }));
const assignments = assignmentDocs.map((doc) => ({ id: idOf(doc), ...data(doc) }));

const kb19 = assets.find(a => a.code === "KB-19");
const kb20 = assets.find(a => a.code === "KB-20");

console.log("=== KB-19 ===");
console.log(JSON.stringify(kb19, null, 2));

console.log("\n=== KB-20 ===");
console.log(JSON.stringify(kb20, null, 2));

console.log("\n=== ASSIGNMENTS for KB-19 / KB-20 ===");
console.log(assignments.filter(a => a.assetCode === "KB-19" || a.assetCode === "KB-20"));
