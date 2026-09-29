/**
 * Controlled one-off legacy laptop import.
 *
 * Usage:
 *   node scripts/import-pasted-laptops.mjs <tab-separated-source.txt> --dry-run
 *   node scripts/import-pasted-laptops.mjs <tab-separated-source.txt> --apply
 *
 * This tool deliberately does not create code groups, users, locations, or
 * departments. It requires the existing KHL and KCSL groups, preserves the
 * original row in sourceData, and uses Firestore preconditions so a changed
 * asset aborts the whole import rather than being overwritten.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const projectId = "aims-asset-inventory-system";
const sourcePath = process.argv[2];
const apply = process.argv.includes("--apply");
if (!sourcePath || (!apply && !process.argv.includes("--dry-run"))) {
  throw new Error("Use --dry-run or --apply and provide the pasted TSV source path.");
}

function parseTsv(input) {
  const rows = [], row = [], cell = [];
  let quoted = false;
  const pushCell = () => { row.push(cell.join("").trim()); cell.length = 0; };
  const pushRow = () => { pushCell(); if (row.some(Boolean)) rows.push([...row]); row.length = 0; };
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { cell.push(ch); i += 1; }
      else quoted = !quoted;
    } else if (ch === "\t" && !quoted) pushCell();
    else if (ch === "\n" && !quoted) pushRow();
    else if (ch !== "\r") cell.push(ch);
  }
  if (cell.length || row.length) pushRow();
  return rows;
}

const compactHeader = (value) => String(value || "").replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
const headers = ["INVCODE", "BRANDMODEL", "SPECS", "SN", "USER", "LOCATION", "CONDITION", "BRUIKLEENCONTRACT", "CHARGER", "LAPTOPBAG", "MOUSE", "PURCHASEYEAR"];
const aliases = { INVENTORYCODE: "INVCODE", SERIALNUMBER: "SN", PURCHASE: "PURCHASEYEAR" };

function sourceRows(text) {
  const rows = parseTsv(text);
  const headerIndex = rows.findIndex((row) => row.map(compactHeader).some((item) => item === "INVCODE"));
  if (headerIndex < 0) throw new Error("No INV-CODE header found in source.");
  const headerMap = new Map(rows[headerIndex].map((item, index) => [aliases[compactHeader(item)] || compactHeader(item), index]));
  return rows.slice(headerIndex + 1).flatMap((row) => {
    const sourceData = Object.fromEntries(headers.map((header) => [header, String(row[headerMap.get(header)] || "").trim()]));
    if (!sourceData.INVCODE) return [];
    return [sourceData];
  });
}

function codeFrom(raw) {
  const source = raw.toUpperCase().replace(/\s+/g, "");
  const normalized = source.replace(/^KSCL/, "KCSL");
  const match = normalized.match(/^([A-Z][A-Z0-9]*?)(\d+)$/);
  if (!match) throw new Error(`Unsupported inventory code: ${raw}`);
  const [, prefix, numberText] = match;
  const number = Number(numberText);
  if (!Number.isInteger(number) || number < 1) throw new Error(`Invalid sequence number: ${raw}`);
  return { source, prefix, number, code: `${prefix}-${String(number).padStart(2, "0")}` };
}

function splitBrandModel(value) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  const [brand = "", ...rest] = cleaned.split(/\s+-\s+|\s+/);
  return { brand, model: rest.join(" ").trim() };
}

function specs(raw) {
  const value = raw.replace(/\s*\n\s*/g, " | ").replace(/\s+/g, " ").trim();
  const result = { rawSpecifications: value };
  const cpu = value.match(/(?:INTEL\s+)?CORE\s+i[3579][^|]*/i);
  const ram = value.match(/RAM\s*(\d+)\s*GB/i);
  const storage = value.match(/(\d+)\s*GB\s*(SSD|HDD)/i);
  const os = value.match(/WIN(?:DOWS)?\s*(\d+)\s*(PRO|HOME)?/i);
  const office = value.match(/OFFICE\s*(\d{4})/i);
  if (cpu) result.cpu = cpu[0].trim();
  if (ram) result.ram = `${ram[1]} GB`;
  if (storage) { result.storageCapacity = `${storage[1]} GB`; result.storageType = storage[2].toUpperCase(); }
  if (os) result.operatingSystem = `Windows ${os[1]}${os[2] ? ` ${os[2][0]}${os[2].slice(1).toLowerCase()}` : ""}`;
  if (office) result.office = `Office ${office[1]}`;
  return result;
}

function conditionAndStatus(row) {
  const condition = row.CONDITION.toUpperCase();
  const user = row.USER.toUpperCase();
  if (user.includes("TERUG NAAR DE LEVERANCIER")) return { condition: "Unknown", status: "Under Repair", note: "Bronstatus: terug naar de leverancier; inspectie vereist." };
  if (condition === "USE FOR PARTS") return { condition: "Use for parts", status: "Damaged" };
  if (condition === "BAD") return { condition: "Bad", status: "Damaged" };
  if (condition === "50%") return { condition: "Unknown", status: row.USER ? "Assigned" : "Available", note: "Bronconditie: 50%; inspectie vereist." };
  if (condition === "GOOD") return { condition: "Good", status: row.USER ? "Assigned" : "Available" };
  return { condition: "Unknown", status: row.USER ? "Assigned" : "Available", note: "Bronconditie ontbreekt; inspectie vereist." };
}

function notes(row, extra = []) {
  const lines = [
    row.BRUIKLEENCONTRACT && `Bruikleencontract: ${row.BRUIKLEENCONTRACT}`,
    row.CHARGER && `Charger: ${row.CHARGER}`,
    row.LAPTOPBAG && `Laptop bag: ${row.LAPTOPBAG}`,
    row.MOUSE && `Mouse: ${row.MOUSE}`,
    row.PURCHASEYEAR && `Aankoopjaar: ${row.PURCHASEYEAR.replace(/O/g, "0")}`,
    row.LOCATION && `Bronlocatie: ${row.LOCATION}`,
    ...extra,
  ].filter(Boolean);
  return lines.join("\n");
}

function value(data) {
  if (data === null || data === undefined) return { nullValue: null };
  if (typeof data === "string") return { stringValue: data };
  if (typeof data === "boolean") return { booleanValue: data };
  if (typeof data === "number") return Number.isInteger(data) ? { integerValue: String(data) } : { doubleValue: data };
  if (Array.isArray(data)) return { arrayValue: { values: data.map(value) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(data).map(([key, item]) => [key, value(item)])) } };
}

function fields(data) { return Object.fromEntries(Object.entries(data).map(([key, item]) => [key, value(item)])); }
function canonical(code) { return code.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function hash(text) { let h = 2166136261; for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619); return (h >>> 0).toString(16).padStart(8, "0"); }
function gcloudToken() { return execFileSync("C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd", ["auth", "print-access-token"], { encoding: "utf8" }).trim(); }
async function api(path, options = {}) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents${path}`, { ...options, headers: { Authorization: `Bearer ${gcloudToken()}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}
async function list(collection) { const result = await api(`/${collection}?pageSize=300`); return result.documents || []; }
function stringField(document, name) { return document.fields?.[name]?.stringValue || ""; }

const rows = sourceRows(readFileSync(sourcePath, "utf8"));
const [groups, existingAssets, existingCodes] = await Promise.all([list("codeGroups"), list("assets"), list("assetCodes")]);
const groupByPrefix = new Map(groups.map((item) => [stringField(item, "prefix").toUpperCase(), item]));
for (const prefix of ["KHL", "KCSL"]) {
  const group = groupByPrefix.get(prefix);
  if (!group || group.fields?.isActive?.booleanValue === false) throw new Error(`Required active code group ${prefix} is absent.`);
}
const assetsByCode = new Map(existingAssets.map((asset) => [canonical(stringField(asset, "code")), asset]));
const codeReservations = new Set(existingCodes.map((item) => item.name.split("/").at(-1)));
const now = new Date().toISOString();
const sourceName = "Pasted inventory laptop list";
const duplicateSerial = new Set(["KCSL43"]);
const prepared = rows.map((row) => {
  const identity = codeFrom(row.INVCODE);
  const brandModel = splitBrandModel(row.BRANDMODEL);
  const lifecycle = conditionAndStatus(row);
  const existing = assetsByCode.get(canonical(identity.code));
  const serialHeldInNotes = duplicateSerial.has(identity.prefix + identity.number);
  const extra = [lifecycle.note, row.source !== identity.source && `Broncode gecorrigeerd: ${row.INVCODE} → ${identity.code}.`, serialHeldInNotes && `Bron-serienummer: ${row.SN}; conflict met KCSL42, niet als primaire identiteit gebruikt.`].filter(Boolean);
  const data = {
    code: identity.code, codePrefix: identity.prefix, codeNumber: identity.number,
    name: `${brandModel.brand} ${brandModel.model}`.trim() || `Laptop ${identity.code}`,
    category: "Laptops", type: "Laptop", brand: brandModel.brand, model: brandModel.model,
    serialNumber: serialHeldInNotes ? "" : row.SN,
    location: row.LOCATION, department: "ICT", assignedTo: row.USER,
    status: lifecycle.status, condition: lifecycle.condition,
    purchaseDate: "", warrantyExpiry: "", lastUpdated: now.slice(0, 10),
    technicalSpecifications: specs(row.SPECS), notes: notes(row, extra), qr: true,
    sourceData: { inventoryCode: row.INVCODE, brandModel: row.BRANDMODEL, specifications: row.SPECS, serialNumber: row.SN, user: row.USER, location: row.LOCATION, condition: row.CONDITION, loanContract: row.BRUIKLEENCONTRACT, charger: row.CHARGER, laptopBag: row.LAPTOPBAG, mouse: row.MOUSE, purchase: row.PURCHASEYEAR },
    importMetadata: { source: "KCS Laptop Inventory", sourceType: "legacy_inventory", importedAt: now, importedBy: "controlled-legacy-import", sourceRecordCode: row.INVCODE, migrationVersion: "laptop-inventory-v1" },
    updatedAt: now, updatedBy: "controlled-legacy-import",
  };
  return { ...identity, row, existing, data };
});
const collisions = prepared.filter((item) => item.existing && item.existing.name.split("/").at(-1) !== `legacy-laptop-${hash(item.code.toLowerCase())}-asset`);
const creates = prepared.filter((item) => !item.existing);
const updates = prepared.filter((item) => item.existing);
const summary = { sourceRows: rows.length, creates: creates.length, updates: updates.length, codeGroupsCreated: 0, correctedCodes: prepared.filter((item) => item.source !== item.code.replace("-", "")).map((item) => ({ source: item.source, stored: item.code })), orphanReservationReused: codeReservations.has("KCSL-01"), duplicateSerialStoredAsNote: "KCSL43" };
console.log(JSON.stringify(summary, null, 2));
if (!apply) process.exit(0);

const writes = [];
for (const item of prepared) {
  const documentId = item.existing ? item.existing.name.split("/").at(-1) : `legacy-laptop-${hash(item.code.toLowerCase())}-asset`;
  const documentName = `projects/${projectId}/databases/(default)/documents/assets/${documentId}`;
  if (item.existing) {
    const patch = { ...item.data };
    delete patch.code; delete patch.codePrefix; delete patch.codeNumber;
    writes.push({ update: { name: documentName, fields: fields(patch) }, updateMask: { fieldPaths: Object.keys(patch) }, currentDocument: { updateTime: item.existing.updateTime } });
  } else {
    writes.push({ update: { name: documentName, fields: fields({ ...item.data, createdAt: now, createdBy: "controlled-legacy-import" }) }, currentDocument: { exists: false } });
  }
  if (!codeReservations.has(item.code)) {
    const group = groupByPrefix.get(item.prefix);
    writes.push({ update: { name: `projects/${projectId}/databases/(default)/documents/assetCodes/${item.code}`, fields: fields({ code: item.code, codeGroupId: group.name.split("/").at(-1), assetId: documentId, reservedBy: "controlled-legacy-import", createdAt: now }) }, currentDocument: { exists: false } });
  }
}
writes.push({ update: { name: `projects/${projectId}/databases/(default)/documents/activityLogs/legacy-laptop-import-${Date.now()}`, fields: fields({ action: "asset.import.legacy_laptops", entityType: "asset", entityId: "legacy-laptop-batch", actorUserId: "controlled-legacy-import", actorEmail: "", reason: "Approved import of pasted laptop inventory", before: { existingAssetsUpdated: updates.length }, after: { assetsCreated: creates.length, sourceRows: rows.length, codeGroupsCreated: 0, correctedLegacyPrefixCodes: ["KSCL40", "KSCL44"] }, createdAt: now, updatedAt: now, updatedBy: "controlled-legacy-import" }) } });
if (writes.length > 500) throw new Error(`Import has ${writes.length} writes, exceeding Firestore commit limit.`);
const token = gcloudToken();
const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ writes }) });
if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
console.log(JSON.stringify({ applied: true, writes: writes.length, creates: creates.length, updates: updates.length }, null, 2));
