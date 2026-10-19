import crypto from "node:crypto";

export const OVERVIEW_PREFIX = "OVERZICHT";
export const UNKNOWN_OCCURRED_AT = "1900-01-01T00:00:00.000Z";

const MONTHS = new Map([
  ["jan", 0], ["januari", 0], ["feb", 1], ["februari", 1],
  ["mrt", 2], ["maart", 2], ["mar", 2], ["march", 2],
  ["apr", 3], ["april", 3], ["mei", 4], ["may", 4],
  ["jun", 5], ["juni", 5], ["june", 5], ["jul", 6],
  ["juli", 6], ["july", 6], ["aug", 7], ["augustus", 7],
  ["august", 7], ["sep", 8], ["sept", 8], ["september", 8],
  ["okt", 9], ["oktober", 9], ["oct", 9], ["october", 9],
  ["nov", 10], ["november", 10], ["dec", 11], ["december", 11],
]);

const CATEGORY_DEFINITIONS = {
  Laptop: { category: "Laptops", name: "Laptop" },
  Desktop: { category: "Desktops", name: "Desktop" },
  "Mini Desktop": { category: "Mini-desktops", name: "Mini Desktop" },
  Digiboard: { category: "Digibords", name: "Digiboard" },
  Module: { category: "Modules", name: "Module" },
  Printer: { category: "Printers", name: "Printer" },
  Phone: { category: "Phones", name: "Phone" },
  Tablet: { category: "Tablets", name: "Tablet" },
  Scanner: { category: "Scanners", name: "Scanner" },
};

const GENERATED_CODES = new Map([
  ["MODULE KHL", "KCSPW-10"],
  ["CANON G3110-HRM", "PR-01"],
  ["CANON G3110 - FINANCE", "PR-02"],
  ["KYOCERA ECOSYS - ADMIN", "PR-03"],
  ["KYOCERA ECOSYS - KH", "PR-04"],
  ["TELEFOON FACILITAIR", "KCSMOB-08"],
  ["SCANNER CONFERENCE ROOM", "SCN-01"],
]);

const clean = (value) => value == null ? "" : String(value).trim();
export const normalizeIdentity = (value) => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");

export function extractFields(rows) {
  const result = {};
  const accepted = new Set([
    "device name", "user", "item", "brand", "model", "cpu", "departement",
    "department", "location", "s/n", "mac adres", "mac address", "ram",
    "ssd/hdd", "condition",
  ]);
  for (const row of rows.slice(0, 30)) {
    const values = Array.from(row || [], clean);
    for (let index = 0; index < values.length - 1; index += 1) {
      const key = values[index].replace(/:$/, "").trim().toLowerCase();
      if (accepted.has(key) && !(key in result)) result[key] = values[index + 1];
    }
  }
  return result;
}

export function classifySheet(sheetName, fields) {
  const upperSheet = sheetName.toUpperCase();
  const haystack = [sheetName, fields.item, fields.brand, fields.model].map(clean).join(" ").toUpperCase();
  if (upperSheet === "MODULE KHL" || upperSheet.startsWith("KCSPW")) return "Module";
  if (haystack.includes("LAPTOP") || upperSheet.startsWith("KCSL") || upperSheet.startsWith("KHL")) return "Laptop";
  if (haystack.includes("MINI") || upperSheet.startsWith("KCSMD")) return "Mini Desktop";
  if (upperSheet.startsWith("KCSDB") || haystack.includes("DIGIB")) return "Digiboard";
  if (/\bMODULE\b/.test(haystack)) return "Module";
  if (haystack.includes("PRINTER") || haystack.includes("CANON") || haystack.includes("KYOCERA")) return "Printer";
  if (haystack.includes("TABLET")) return "Tablet";
  if (haystack.includes("SCANNER")) return "Scanner";
  if (haystack.includes("TELEFOON") || haystack.includes("SMARTPHONE") || upperSheet.startsWith("KCSMOB")) return "Phone";
  if (haystack.includes("DESK") || haystack.includes("COMPUTER")) return "Desktop";
  throw new Error(`Unsupported History Log sheet: ${sheetName}`);
}

function formatCode(prefix, number) {
  return `${prefix}-${number < 100 ? String(number).padStart(2, "0") : number}`;
}

export function proposedCode(sheetName, fields) {
  const upperSheet = sheetName.toUpperCase();
  if (GENERATED_CODES.has(upperSheet)) return GENERATED_CODES.get(upperSheet);
  const tablet = upperSheet.match(/^TABLET[- ]?0*(\d+)$/);
  if (tablet) return formatCode("TAB", Number(tablet[1]));
  const candidates = [fields["device name"], sheetName];
  for (const candidate of candidates) {
    const matches = clean(candidate).toUpperCase().match(/\b(KCSDESK|KCSMD|KCSDB|KCSL|KHL|KCSPW|KCSMOB)[- ]*0*(\d+)\b/);
    if (matches) return formatCode(matches[1], Number(matches[2]));
  }
  throw new Error(`No safe inventory code can be derived for ${sheetName}`);
}

export function parseLegacyDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  const raw = clean(value);
  if (!raw) return undefined;
  const normalized = raw.toLowerCase().replace(/[,\.]/g, " ").replace(/\s+/g, " ").trim();
  const named = normalized.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{2,4})$/i);
  if (named && MONTHS.has(named[2])) {
    let year = Number(named[3]);
    if (year < 100) year += 2000;
    if (year >= 2000 && year <= 2100) {
      const date = new Date(Date.UTC(year, MONTHS.get(named[2]), Number(named[1])));
      if (date.getUTCDate() === Number(named[1])) return date.toISOString();
    }
  }
  const numeric = normalized.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (numeric) {
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;
    const date = new Date(Date.UTC(year, Number(numeric[2]) - 1, Number(numeric[1])));
    if (date.getUTCDate() === Number(numeric[1]) && date.getUTCMonth() === Number(numeric[2]) - 1) return date.toISOString();
  }
  const native = new Date(raw);
  return Number.isNaN(native.getTime()) ? undefined : native.toISOString();
}

export function extractHistoryRows(rows) {
  let headerIndex = -1;
  let columns = {};
  for (let index = 0; index < rows.length; index += 1) {
    const upper = Array.from(rows[index] || [], value => clean(value).toUpperCase().replace(/:$/, ""));
    if (upper.includes("DATE") && upper.some(value => ["STATUS", "ISSUE", "SOLUTION", "OPMERKING", "OPMERKINGEN"].includes(value))) {
      headerIndex = index;
      for (const name of ["DATE", "STATUS", "ISSUE", "SOLUTION", "OPMERKING", "OPMERKINGEN"]) {
        const found = upper.indexOf(name);
        if (found >= 0) columns[name] = found;
      }
      break;
    }
  }
  if (headerIndex < 0) return [];
  const events = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = Array.from(rows[index] || []);
    const rawDate = clean(row[columns.DATE]);
    const status = clean(row[columns.STATUS]);
    const issue = clean(row[columns.ISSUE]);
    const solution = clean(row[columns.SOLUTION]);
    const notes = clean(row[columns.OPMERKINGEN ?? columns.OPMERKING]);
    if (![rawDate, status, issue, solution, notes].some(Boolean)) continue;
    if (!rawDate && events.length) {
      const previous = events.at(-1);
      previous.status = [previous.status, status].filter(Boolean).join(" | ");
      previous.issue = [previous.issue, issue].filter(Boolean).join(" | ");
      previous.solution = [previous.solution, solution].filter(Boolean).join(" | ");
      previous.notes = [previous.notes, notes].filter(Boolean).join(" | ");
      previous.sourceRows.push(index + 1);
      continue;
    }
    events.push({ rawDate, occurredAt: parseLegacyDate(row[columns.DATE]), status, issue, solution, notes, sourceRows: [index + 1] });
  }
  return events;
}

function condition(value) {
  const upper = clean(value).toUpperCase();
  if (upper.includes("FAIR")) return "Fair";
  if (upper.includes("BAD") || upper.includes("POOR") || upper.includes("BROKEN") || upper.includes("DEFECT")) return "Poor";
  return "Good";
}

function codeParts(code) {
  const match = code.match(/^([A-Z0-9]+)-(\d+)$/);
  if (!match) throw new Error(`Unsafe generated code: ${code}`);
  return { prefix: match[1], number: Number(match[2]) };
}

export function buildAssetCandidate(sheetName, rows) {
  const fields = extractFields(rows);
  const kind = classifySheet(sheetName, fields);
  const definition = CATEGORY_DEFINITIONS[kind];
  const code = proposedCode(sheetName, fields);
  const parts = codeParts(code);
  const user = clean(fields.user);
  const technicalSpecifications = Object.fromEntries([
    ["CPU", clean(fields.cpu)], ["RAM", clean(fields.ram)],
    ["Storage", clean(fields["ssd/hdd"])],
    ["MAC address", clean(fields["mac adres"] || fields["mac address"])],
  ].filter(([, value]) => value));
  const notes = [
    `Imported from History Log workbook; source sheet: ${sheetName}.`,
    user ? `Legacy user: ${user}` : "",
  ].filter(Boolean).join("\n");
  return {
    sheetName, kind, code, codePrefix: parts.prefix, codeNumber: parts.number,
    deviceName: clean(fields["device name"]),
    asset: {
      code, codePrefix: parts.prefix, codeNumber: parts.number, previousCodes: [],
      name: definition.name, description: "", category: definition.category,
      subcategory: kind, type: "Device", brand: clean(fields.brand) || "Unspecified",
      model: clean(fields.model) || "Unspecified", serialNumber: clean(fields["s/n"]),
      barcode: code, location: clean(fields.location), department: clean(fields.departement || fields.department),
      assignedTo: "", status: "Available", condition: condition(fields.condition),
      purchaseDate: "", warrantyExpiry: "", lastUpdated: new Date().toISOString().slice(0, 10),
      maintenanceRequired: false, technicalSpecifications, attachments: [], photos: [],
      notes, qr: false,
    },
    history: extractHistoryRows(rows),
  };
}

export function chooseCanonicalAsset(records) {
  return [...records].sort((left, right) => {
    const leftAst = String(left.id).startsWith("ast-") ? 0 : 1;
    const rightAst = String(right.id).startsWith("ast-") ? 0 : 1;
    if (leftAst !== rightAst) return leftAst - rightAst;
    if (left.status === "Assigned" && right.status !== "Assigned") return -1;
    if (right.status === "Assigned" && left.status !== "Assigned") return 1;
    return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
  })[0];
}

export function eventIdentity({ fileHash, sheetName, sourceRows, assetId, status, issue, solution, notes, rawDate }) {
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ fileHash, sheetName, sourceRows, assetId, status, issue, solution, notes, rawDate })).digest("hex");
  return { id: `historylog-${fingerprint.slice(0, 40)}`, fingerprint };
}

export function classifyEvent(event) {
  const text = [event.status, event.issue, event.solution, event.notes].join(" ").toLowerCase();
  if (/afgifte|terug|assigned|uitgeleend/.test(text)) return "assignment";
  if (/repair|repar|fixed|opgelost|vervang/.test(text)) return "repair";
  if (/service|update|scan|schoon|clean|onderhoud/.test(text)) return "maintenance";
  if (/defect|issue|probleem|broken|out of order/.test(text)) return "incident";
  return "legacy_import";
}

export function buildHistoryDocument(event, context) {
  const identity = eventIdentity({ ...event, ...context });
  const rawText = [event.status, event.issue, event.solution, event.notes].filter(Boolean).join(" | ");
  const unknownDateNote = event.occurredAt ? "" : `Legacy date unavailable${event.rawDate ? ` (raw: ${event.rawDate})` : ""}.`;
  return {
    id: identity.id,
    data: {
      assetId: context.assetId, assetCode: context.assetCode,
      eventType: classifyEvent(event), category: "legacy",
      title: event.status || "Imported legacy record",
      description: event.issue || event.solution || event.notes || event.status,
      issue: event.issue, solution: event.solution,
      notes: [event.notes, unknownDateNote, `Source sheet ${context.sheetName}, row(s) ${event.sourceRows.join(", ")}.`].filter(Boolean).join("\n"),
      sourceModule: "history_log_migration",
      sourceRecordId: `${context.sheetName}:${event.sourceRows.join("-")}`,
      source: "legacy_import", occurredAt: event.occurredAt || UNKNOWN_OCCURRED_AT,
      importBatchId: context.importBatchId, originalLegacyText: rawText,
      isLegacyImport: true, isManual: false, status: "Final", version: 1,
      fingerprint: identity.fingerprint,
    },
  };
}

export function stableAssetDocumentId(code) {
  return `history-log-${normalizeIdentity(code).toLowerCase()}`;
}

export function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
