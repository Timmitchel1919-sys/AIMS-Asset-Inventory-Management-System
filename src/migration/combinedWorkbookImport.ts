import * as XLSX from "xlsx";
import type { SourceRow } from "./legacyMigration";

export interface WorkbookSource {
  fileName: string;
  sheets: string[];
  rows: SourceRow[];
  excludedSensitiveFields: number;
  sensitiveFields: SensitiveFieldOccurrence[];
}
export interface SensitiveFieldOccurrence {
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  label: string;
  nonEmpty: boolean;
}

export interface CombinedWorkbookSource {
  master: WorkbookSource;
  history: WorkbookSource;
}

const normalizedKey = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const sensitiveKey = (value: unknown) =>
  /^(admin|administrator|localadmin)?password$|^adminpassw(ord)?$/i.test(
    normalizedKey(value),
  );
const empty = (value: unknown) => value == null || String(value).trim() === "";
const usableSerial = (value: unknown) =>
  !empty(value) &&
  !/^(?:n\/?a|nvt|none|unknown|-+)$/i.test(String(value).trim());
const validMac = (value: unknown) =>
  /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(String(value ?? "").trim());
const usableAssetCode = (value: unknown) =>
  /^[A-Z]{2,12}[\s-]*\d{1,4}$/i.test(String(value ?? "").trim());
const meaningful = (row: unknown[]) =>
  row.filter((value) => !empty(value)).length;
const masterHeaderKeys = new Set([
  "assetcode",
  "screencode",
  "invcode",
  "inventorycode",
  "deviceid",
  "code",
  "sn",
  "serial",
  "serialnumber",
  "servicetag",
  "mac",
  "macaddress",
  "macadres",
]);
const historyHeaderKeys = new Set([
  "date",
  "datum",
  "status",
  "issue",
  "probleem",
  "solution",
  "oplossing",
  "notes",
  "opmerking",
  "opmerkingen",
]);
const ignoredMasterSheets =
  /^(overzicht|overview|legenda|legend|plattegrond|floor\s*plan|pl\.|dashboard|summary|inventaris\s*wifi)/i;
const inventorySheets = new Set([
  "LAPTOP",
  "DESKTOP",
  "MINI DESK",
  "TABLET",
  "MONITOR",
  "DIGIBORD",
  "PW MODULE",
  "RT MODULE",
  "TELEFOON",
  "MOBIEL",
  "PRINTERSCANNER",
  "BEAMER",
  "UPS",
  "KEYBOARD",
  "LAPTOPS",
  "DESKTOPS",
  "ASSETS",
]);

function readWorkbook(file: File) {
  if (!/\.xlsx$/i.test(file.name))
    throw new Error(`${file.name}: alleen .xlsx-bestanden worden ondersteund.`);
  return file.arrayBuffer().then((buffer) => {
    try {
      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
        cellText: false,
        cellNF: true,
      });
      if (!workbook.SheetNames.length)
        throw new Error("Het werkboek bevat geen werkbladen.");
      return workbook;
    } catch (error) {
      throw new Error(
        `${file.name}: beschadigd of niet-ondersteund Excelbestand (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  });
}

function rowsOf(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: true,
  });
}

function excelDate(value: unknown): unknown {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString();
  if (typeof value === "number" && value > 1 && value < 100000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed)
      return new Date(
        Date.UTC(
          parsed.y,
          parsed.m - 1,
          parsed.d,
          parsed.H,
          parsed.M,
          Math.floor(parsed.S),
        ),
      ).toISOString();
  }
  return value;
}

function objectFromRow(
  headers: unknown[],
  row: unknown[],
  source: { file: string; sheet: string; row: number },
) {
  let excluded = 0;
  const sensitiveFields: SensitiveFieldOccurrence[] = [];
  const record: SourceRow = {
    __sourceFile: source.file,
    __sourceSheet: source.sheet,
    __sourceRow: source.row,
  };
  headers.forEach((header, index) => {
    const label = String(header ?? "")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!label) return;
    if (sensitiveKey(label)) {
      const nonEmpty = !empty(row[index]);
      if (nonEmpty) excluded += 1;
      sensitiveFields.push({
        sourceFile: source.file,
        sourceSheet: source.sheet,
        sourceRow: source.row,
        label,
        nonEmpty,
      });
      return;
    }
    const value = /^(date|datum|occurredat|servicedate)$/i.test(
      normalizedKey(label),
    )
      ? excelDate(row[index])
      : row[index];
    if (!empty(value)) record[label] = value;
  });
  return { record, excluded, sensitiveFields };
}

const canonicalMasterHeader = (value: unknown) => {
  const key = normalizedKey(value);
  const aliases: Record<string, string> = {
    assetcode: "Asset Code",
    screencode: "Asset Code",
    invcode: "Asset Code",
    inventorycode: "Asset Code",
    deviceid: "Asset Code",
    code: "Asset Code",
    sn: "Serial Number",
    serial: "Serial Number",
    serialnumber: "Serial Number",
    servicetag: "Serial Number",
    brandmodel: "Brand - Model",
    specs: "Specs",
    user: "User",
    location: "Location",
    locatiegroep: "Location",
    condition: "Condition",
    bruikleencontract: "Bruikleen Contract",
    purchaseyear: "Purchase Year",
    mac: "MAC Address",
    macaddress: "MAC Address",
    macadres: "MAC Address",
  };
  return (
    aliases[key] ||
    String(value ?? "")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
};

function findHeader(
  rows: unknown[][],
  candidates: Set<string>,
  minimum: number,
) {
  return rows.findIndex(
    (row) =>
      row.filter((value) => candidates.has(normalizedKey(value))).length >=
      minimum,
  );
}

export async function parseMasterWorkbook(file: File): Promise<WorkbookSource> {
  const workbook = await readWorkbook(file);
  const records: SourceRow[] = [];
  const sheets: string[] = [];
  let excludedSensitiveFields = 0;
  const sensitiveFields: SensitiveFieldOccurrence[] = [];
  for (const sheetName of workbook.SheetNames) {
    if (ignoredMasterSheets.test(sheetName.trim())) continue;
    if (!inventorySheets.has(sheetName.trim().toUpperCase())) continue;
    const rows = rowsOf(workbook.Sheets[sheetName]);
    const headerIndex = findHeader(rows, masterHeaderKeys, 1);
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex].map(canonicalMasterHeader);
    let imported = 0;
    rows.slice(headerIndex + 1).forEach((row, offset) => {
      if (meaningful(row) < 1) return;
      const {
        record,
        excluded,
        sensitiveFields: foundSensitive,
      } = objectFromRow(headers, row, {
        file: file.name,
        sheet: sheetName,
        row: headerIndex + offset + 2,
      });
      excludedSensitiveFields += excluded;
      sensitiveFields.push(...foundSensitive);
      const assetCode = Object.entries(record).find(
        ([key]) => normalizedKey(key) === "assetcode",
      )?.[1];
      const serial = Object.entries(record).find(
        ([key]) => normalizedKey(key) === "serialnumber",
      )?.[1];
      const mac = Object.entries(record).find(
        ([key]) => normalizedKey(key) === "macaddress",
      )?.[1];
      const hasIdentity =
        !empty(assetCode) ||
        usableAssetCode(assetCode) ||
        usableSerial(serial) ||
        validMac(mac);
      if (!hasIdentity) return;
      if (
        !Object.keys(record).some((key) =>
          ["category", "categorie", "type", "devicetype"].includes(
            normalizedKey(key),
          ),
        )
      )
        record.Category = sheetName;
      records.push(record);
      imported += 1;
    });
    if (imported) sheets.push(sheetName);
  }
  if (!records.length)
    throw new Error(
      `${file.name}: geen importeerbare inventarisregels gevonden.`,
    );
  return {
    fileName: file.name,
    sheets,
    rows: records,
    excludedSensitiveFields,
    sensitiveFields,
  };
}

function extractDetails(
  rows: unknown[][],
  fileName: string,
  sheetName: string,
) {
  const details: SourceRow = {};
  let excluded = 0;
  const sensitiveFields: SensitiveFieldOccurrence[] = [];
  rows.slice(0, 80).forEach((row, rowIndex) => {
    for (let index = 0; index < row.length - 1; index += 1) {
      const label = String(row[index] ?? "")
        .trim()
        .replace(/:$/, "");
      if (!label || label.length > 80 || empty(row[index + 1])) continue;
      if (sensitiveKey(label)) {
        const nonEmpty = !empty(row[index + 1]);
        if (nonEmpty) excluded += 1;
        sensitiveFields.push({
          sourceFile: fileName,
          sourceSheet: sheetName,
          sourceRow: rowIndex + 1,
          label,
          nonEmpty,
        });
        continue;
      }
      if (
        /device|asset|serial|s\/n|service tag|mac|brand|model|location|department|user|technician/i.test(
          label,
        )
      )
        details[label] = excelDate(row[index + 1]);
    }
  });
  details.__sourceFile = fileName;
  details.__sourceSheet = sheetName;
  return { details, excluded, sensitiveFields };
}

export async function parseHistoryWorkbook(
  file: File,
): Promise<WorkbookSource> {
  const workbook = await readWorkbook(file);
  const records: SourceRow[] = [];
  const sheets: string[] = [];
  let excludedSensitiveFields = 0;
  const sensitiveFields: SensitiveFieldOccurrence[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = rowsOf(sheet);
    const headerIndex = findHeader(rows, historyHeaderKeys, 2);
    if (headerIndex < 0) continue;
    const {
      details,
      excluded,
      sensitiveFields: detailSensitive,
    } = extractDetails(rows, file.name, sheetName);
    excludedSensitiveFields += excluded;
    sensitiveFields.push(...detailSensitive);
    const headers = rows[headerIndex];
    let imported = 0;
    rows.slice(headerIndex + 1).forEach((row, offset) => {
      if (
        !row.some(
          (value, index) =>
            historyHeaderKeys.has(normalizedKey(headers[index])) &&
            !empty(value),
        )
      )
        return;
      const mapped = objectFromRow(headers, row, {
        file: file.name,
        sheet: sheetName,
        row: headerIndex + offset + 2,
      });
      excludedSensitiveFields += mapped.excluded;
      sensitiveFields.push(...mapped.sensitiveFields);
      const record = { ...details, ...mapped.record };
      if (
        !Object.keys(record).some((key) =>
          ["assetcode", "code", "deviceid", "devicename"].includes(
            normalizedKey(key),
          ),
        )
      )
        record["Device Name"] = sheetName;
      records.push(record);
      imported += 1;
    });
    if (imported) sheets.push(sheetName);
  }
  if (!records.length)
    throw new Error(
      `${file.name}: geen regels onder DATE/STATUS/ISSUE/SOLUTION/NOTES gevonden.`,
    );
  return {
    fileName: file.name,
    sheets,
    rows: records,
    excludedSensitiveFields,
    sensitiveFields,
  };
}

export async function parseCombinedWorkbooks(
  masterFile: File,
  historyFile: File,
): Promise<CombinedWorkbookSource> {
  const [master, history] = await Promise.all([
    parseMasterWorkbook(masterFile),
    parseHistoryWorkbook(historyFile),
  ]);
  return { master, history };
}

const mergeSources = (
  sources: WorkbookSource[],
  fallbackName: string,
): WorkbookSource => ({
  fileName: sources.map((source) => source.fileName).join(", ") || fallbackName,
  sheets: sources.flatMap((source) => source.sheets),
  rows: sources.flatMap((source) => source.rows),
  excludedSensitiveFields: sources.reduce(
    (total, source) => total + source.excludedSensitiveFields,
    0,
  ),
  sensitiveFields: sources.flatMap((source) => source.sensitiveFields),
});

/** Detects inventory and History content independently in one to four selected workbooks. */
export async function parseSelectedWorkbooks(
  files: File[],
): Promise<CombinedWorkbookSource> {
  if (!files.length) throw new Error("Selecteer minimaal één Excelbestand.");
  const detected = await Promise.all(
    files.map(async (file) => {
      const [master, history] = await Promise.all([
        parseMasterWorkbook(file).catch(() => undefined),
        parseHistoryWorkbook(file).catch(() => undefined),
      ]);
      return { file, master, history };
    }),
  );
  const masters = detected.flatMap((item) =>
      item.master ? [item.master] : [],
    ),
    histories = detected.flatMap((item) =>
      item.history ? [item.history] : [],
    );
  if (!masters.length && !histories.length)
    throw new Error(
      "In de gekozen bestanden zijn geen herkenbare middelen- of History-regels gevonden.",
    );
  return {
    master: mergeSources(masters, "Geen middelenbestand herkend"),
    history: mergeSources(histories, "Geen History-bestand herkend"),
  };
}
