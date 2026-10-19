import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import xlsx from "xlsx";
import {
  OVERVIEW_PREFIX,
  buildAssetCandidate,
  buildHistoryDocument,
  chooseCanonicalAsset,
  normalizeIdentity,
  sha256,
  stableAssetDocumentId,
} from "./history-log-import-lib.mjs";

const PROJECT = "aims-asset-inventory-system";
const API_ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`;
const apply = process.argv.includes("--apply");
const sourceArg = process.argv.indexOf("--source");
const sourcePath = sourceArg >= 0 ? process.argv[sourceArg + 1] : "";
if (!sourcePath || !fs.existsSync(sourcePath)) {
  console.error("Usage: node scripts/import-history-log.mjs --source <History Log.xlsx> [--apply]");
  process.exit(1);
}

function accessToken() {
  const gcloud = "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd";
  return execFileSync(
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    ["-NoProfile", "-Command", `& '${gcloud}' auth print-access-token`],
    { encoding: "utf8", windowsHide: true },
  ).trim();
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken()}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${options.method || "GET"} ${url}: ${response.status} ${body}`);
  return body ? JSON.parse(body) : {};
}

function decodeValue(value) {
  if (!value || typeof value !== "object") return undefined;
  for (const key of ["stringValue", "integerValue", "doubleValue", "booleanValue", "timestampValue"]) {
    if (key in value) return key === "integerValue" ? Number(value[key]) : value[key];
  }
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decodeValue(item)]));
  return undefined;
}

function encodeValue(value) {
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  throw new Error(`Unsupported Firestore value: ${typeof value}`);
}

function encodeFields(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined).map(([key, value]) => [key, encodeValue(value)]));
}

async function fetchCollection(name) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const payload = await request(`${API_ROOT}/documents/${name}?${query}`);
    documents.push(...(payload.documents || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
  return documents.map(document => ({
    id: document.name.split("/").at(-1),
    ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decodeValue(value)])),
  }));
}

function workbookCandidates(buffer) {
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true, raw: true });
  return workbook.SheetNames
    .filter(sheetName => !sheetName.toUpperCase().startsWith(OVERVIEW_PREFIX))
    .map(sheetName => {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "" });
      return buildAssetCandidate(sheetName, rows);
    });
}

function indexAssets(assets) {
  const byCode = new Map();
  const bySerial = new Map();
  for (const asset of assets) {
    const code = normalizeIdentity(asset.code);
    if (code) byCode.set(code, [...(byCode.get(code) || []), asset]);
    const serial = normalizeIdentity(asset.serialNumber);
    if (serial) bySerial.set(serial, [...(bySerial.get(serial) || []), asset]);
  }
  return { byCode, bySerial };
}

function matchAsset(candidate, index) {
  const keys = [candidate.code, candidate.sheetName, candidate.deviceName].map(normalizeIdentity).filter(Boolean);
  for (const key of keys) {
    const records = index.byCode.get(key) || [];
    if (records.length) return { asset: chooseCanonicalAsset(records), duplicateCodeCount: records.length };
  }
  const serial = normalizeIdentity(candidate.asset.serialNumber);
  const serialMatches = serial ? index.bySerial.get(serial) || [] : [];
  if (serialMatches.length === 1) return { asset: serialMatches[0], duplicateCodeCount: 1 };
  return undefined;
}

function documentName(collection, id) {
  return `projects/${PROJECT}/databases/(default)/documents/${collection}/${id}`;
}

function write(collection, id, data) {
  return {
    update: { name: documentName(collection, id), fields: encodeFields(data) },
    currentDocument: { exists: false },
  };
}

async function commit(writes) {
  const chunks = [];
  for (let index = 0; index < writes.length; index += 300) chunks.push(writes.slice(index, index + 300));
  for (const [index, chunk] of chunks.entries()) {
    await request(`${API_ROOT}/documents:commit`, { method: "POST", body: JSON.stringify({ writes: chunk }) });
    console.log(`Committed batch ${index + 1}/${chunks.length} (${chunk.length} writes).`);
  }
}

async function main() {
  const buffer = fs.readFileSync(sourcePath);
  const fileHash = sha256(buffer);
  const importBatchId = `history-log-${fileHash.slice(0, 16)}`;
  const candidates = workbookCandidates(buffer);
  const assets = await fetchCollection("assets");
  const histories = await fetchCollection("assetHistoryEvents");
  const historyIds = new Set(histories.map(event => event.id));
  const index = indexAssets(assets);
  const plannedAssets = [];
  const plannedHistory = [];
  const categories = new Map();
  const duplicateCodes = new Map();
  const usedCodes = new Set(assets.map(asset => normalizeIdentity(asset.code)));

  for (const candidate of candidates) {
    let match = matchAsset(candidate, index);
    if (!match) {
      const normalizedCode = normalizeIdentity(candidate.code);
      if (usedCodes.has(normalizedCode)) throw new Error(`Unsafe duplicate code plan for ${candidate.sheetName}: ${candidate.code}`);
      usedCodes.add(normalizedCode);
      const id = stableAssetDocumentId(candidate.code);
      const now = new Date();
      const data = {
        ...candidate.asset,
        createdAt: now, createdBy: "history-log-migration",
        updatedAt: now, updatedBy: "history-log-migration",
      };
      plannedAssets.push({ id, sheetName: candidate.sheetName, data });
      const asset = { id, ...data };
      match = { asset, duplicateCodeCount: 1 };
      index.byCode.set(normalizedCode, [asset]);
      if (asset.serialNumber) index.bySerial.set(normalizeIdentity(asset.serialNumber), [asset]);
    }
    if (match.duplicateCodeCount > 1) duplicateCodes.set(candidate.code, match.duplicateCodeCount);
    categories.set(candidate.kind, (categories.get(candidate.kind) || 0) + 1);
    for (const event of candidate.history) {
      const document = buildHistoryDocument(event, {
        fileHash, importBatchId, sheetName: candidate.sheetName,
        assetId: match.asset.id, assetCode: match.asset.code || candidate.code,
      });
      if (!historyIds.has(document.id)) plannedHistory.push(document);
    }
  }

  const unknownDates = plannedHistory.filter(item => item.data.occurredAt === "1900-01-01T00:00:00.000Z").length;
  const report = {
    mode: apply ? "APPLY" : "DRY_RUN",
    source: path.basename(sourcePath), fileHash, importBatchId,
    sheets: candidates.length, categories: Object.fromEntries(categories),
    productionAssetsBefore: assets.length,
    existingHistoryBefore: histories.length,
    assetsToCreate: plannedAssets.length,
    assetCodesToCreate: plannedAssets.map(item => item.data.code),
    historyToCreate: plannedHistory.length,
    historyAlreadyImported: candidates.reduce((count, candidate) => count + candidate.history.length, 0) - plannedHistory.length,
    unknownDateEvents: unknownDates,
    duplicateProductionCodesResolvedToCanonicalAsset: Object.fromEntries(duplicateCodes),
    excludedSensitiveFields: ["password", "admin password", "Wi-Fi password", "AnyDesk", "TeamViewer"],
  };
  console.log(JSON.stringify(report, null, 2));
  if (!apply) return;

  await commit(plannedAssets.map(item => write("assets", item.id, item.data)));
  await commit(plannedHistory.map(item => write("assetHistoryEvents", item.id, {
    ...item.data,
    createdAt: new Date(), createdBy: "history-log-migration",
    updatedAt: new Date(), updatedBy: "history-log-migration",
  })));
  console.log(`IMPORT_COMPLETE assets=${plannedAssets.length} history=${plannedHistory.length} batch=${importBatchId}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
