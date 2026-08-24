import * as XLSX from "xlsx";
import type { InventoryItem } from "../data/contracts";
import type { Asset, AssetStatus, Condition } from "../domain/types";

export const LAPTOP_MIGRATION_VERSION = "laptop-inventory-v1";

export type LaptopImportWarningType =
  | "DUPLICATE_INVENTORY_CODE"
  | "DUPLICATE_SERIAL_NUMBER"
  | "MISSING_SERIAL_NUMBER"
  | "MISSING_USER"
  | "MISSING_LOCATION"
  | "UNKNOWN_CONDITION"
  | "LEGACY_CODE_PATTERN_WARNING"
  | "PURCHASE_DATE_PARSE_WARNING";

export interface LaptopSourceData {
  inventoryCode: string;
  brandModel: string;
  specifications: string;
  serialNumber: string;
  user: string;
  location: string;
  condition: string;
  loanContract: string;
  charger: string;
  laptopBag: string;
  mouse: string;
  purchase: string;
}

export interface LaptopImportRow {
  id: string;
  sheet: string;
  rowNumber: number;
  sourceData: LaptopSourceData;
  code: string;
  brand: string;
  model: string;
  technicalSpecifications: Record<string, string>;
  purchaseDate: string;
  purchaseYear: string;
  condition: Condition;
  status: AssetStatus;
  warnings: LaptopImportWarningType[];
  disposition: "new" | "existing" | "conflict" | "invalid";
}

export interface LaptopImportPreview {
  fileName: string;
  analyzedAt: string;
  rows: LaptopImportRow[];
  summary: {
    total: number;
    valid: number;
    newRecords: number;
    existing: number;
    conflicts: number;
    duplicateCodes: number;
    duplicateSerials: number;
    missingSerials: number;
    missingUsers: number;
    missingLocations: number;
    unknownConditions: number;
    legacyCodes: number;
    purchaseWarnings: number;
    requiringReview: number;
  };
}

const cleanHeader = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\r\n]+/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();

const textValue = (value: unknown) => String(value ?? "").trim();

const aliases: Record<keyof LaptopSourceData, string[]> = {
  inventoryCode: ["INVCODE", "INVENTORYCODE", "ASSETCODE"],
  brandModel: ["BRANDMODEL", "BRAND", "MODEL"],
  specifications: ["SPECS", "SPECIFICATIONS", "TECHNICALSPECIFICATIONS"],
  serialNumber: ["SN", "SERIALNUMBER", "SERIALNO"],
  user: ["USER", "CUSTODIAN", "ASSIGNEDUSER"],
  location: ["LOCATION", "LOCATIE"],
  condition: ["CONDITION", "CONDITIE"],
  loanContract: ["BRUIKLEENCONTRACT", "LOANCONTRACT"],
  charger: ["CHARGER", "ADAPTER"],
  laptopBag: ["LAPTOPBAG", "BAG"],
  mouse: ["MOUSE"],
  purchase: ["PURCHASEYEAR", "PURCHASE", "PURCHASEDATE"],
};

function headerMap(row: unknown[]) {
  const headers = row.map(cleanHeader);
  return Object.fromEntries(
    Object.entries(aliases).map(([key, options]) => [
      key,
      headers.findIndex((header) => options.includes(header)),
    ]),
  ) as Record<keyof LaptopSourceData, number>;
}

function findHeader(rows: unknown[][]) {
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const mapping = headerMap(rows[index]);
    if (mapping.inventoryCode >= 0 && mapping.brandModel >= 0)
      return { index, mapping };
  }
  return null;
}

function sourceFromRow(
  row: unknown[],
  mapping: Record<keyof LaptopSourceData, number>,
): LaptopSourceData {
  return Object.fromEntries(
    (Object.keys(mapping) as (keyof LaptopSourceData)[]).map((key) => [
      key,
      mapping[key] >= 0 ? textValue(row[mapping[key]]) : "",
    ]),
  ) as unknown as LaptopSourceData;
}

function splitBrandModel(value: string) {
  const parts = value.split(/\s+-\s+/);
  if (parts.length < 2) return { brand: "", model: value };
  return { brand: parts[0].trim(), model: parts.slice(1).join(" - ").trim() };
}

export function parseTechnicalSpecifications(raw: string) {
  const result: Record<string, string> = { rawSpecifications: raw };
  const ram = raw.match(/(?:RAM\s*)?(\d+)\s*GB(?=\s*(?:RAM|[-|/]))/i);
  const storage = raw.match(/(\d+)\s*GB\s*(SSD|HDD)/i);
  const clock = raw.match(/(\d+(?:[.,]\d+)?)\s*GHz/i);
  const cpu = raw.match(/(?:INTEL\s+)?CORE\s+i[3579][^|\n]*/i);
  const windows = raw.match(/WIN(?:DOWS)?\s*(\d+)\s*(PRO|HOME)?/i);
  const office = raw.match(/OFFICE\s*(\d{4})/i);
  const display = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:INCH|")/i);
  if (cpu) result.cpu = cpu[0].trim();
  if (clock) result.clockSpeed = `${clock[1].replace(",", ".")} GHz`;
  if (ram) result.ram = `${ram[1]} GB`;
  if (storage) {
    result.storageCapacity = `${storage[1]} GB`;
    result.storageType = storage[2].toUpperCase();
  }
  if (windows)
    result.operatingSystem = `Windows ${windows[1]}${windows[2] ? ` ${windows[2][0]}${windows[2].slice(1).toLowerCase()}` : ""}`;
  if (office) result.office = `Office ${office[1]}`;
  if (display) result.displaySize = `${display[1].replace(",", ".")} inch`;
  return result;
}

function parsePurchase(raw: string) {
  if (!raw) return { purchaseDate: "", purchaseYear: "", warning: false };
  if (/^\d{4}$/.test(raw))
    return { purchaseDate: "", purchaseYear: raw, warning: false };
  const full = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (full) {
    const day = Number(full[1]);
    const month = Number(full[2]);
    const year = Number(full[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    )
      return {
        purchaseDate: `${full[3]}-${full[2].padStart(2, "0")}-${full[1].padStart(2, "0")}`,
        purchaseYear: full[3],
        warning: false,
      };
  }
  return { purchaseDate: "", purchaseYear: "", warning: true };
}

function mapCondition(value: string): Condition {
  const normalized = value.toUpperCase();
  if (normalized === "GOOD") return "Good";
  if (normalized === "BAD") return "Defective";
  if (normalized === "USE FOR PARTS") return "Beyond Repair";
  if (normalized === "50%") return "Fair";
  return "Fair";
}

function knownCondition(value: string) {
  return (
    !value ||
    ["GOOD", "BAD", "USE FOR PARTS", "50%"].includes(value.toUpperCase())
  );
}

function lifecycle(source: LaptopSourceData): AssetStatus {
  const condition = source.condition.toUpperCase();
  const user = source.user.toUpperCase();
  if (user.includes("TERUG NAAR DE LEVERANCIER")) return "Under Repair";
  if (condition === "BAD" || condition === "USE FOR PARTS") return "Damaged";
  if (source.user) return "Assigned";
  return "Available";
}

function stableId(code: string) {
  let hash = 2166136261;
  for (const character of code)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `legacy-laptop-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function countWarnings(rows: LaptopImportRow[], type: LaptopImportWarningType) {
  return rows.filter((row) => row.warnings.includes(type)).length;
}

export async function analyzeLaptopInventory(
  file: File,
  existingInventory: readonly InventoryItem[],
  existingAssets: readonly Asset[],
): Promise<LaptopImportPreview> {
  if (!/\.xlsx$/i.test(file.name))
    throw new Error("Alleen .xlsx-bestanden worden ondersteund.");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
  });
  const parsed: LaptopImportRow[] = [];
  for (const sheet of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], {
      header: 1,
      raw: false,
      defval: "",
    });
    const header = findHeader(rows);
    if (!header) continue;
    rows.slice(header.index + 1).forEach((cells, offset) => {
      const sourceData = sourceFromRow(cells, header.mapping);
      if (!sourceData.inventoryCode) return;
      const { brand, model } = splitBrandModel(sourceData.brandModel);
      const purchase = parsePurchase(sourceData.purchase);
      const warnings: LaptopImportWarningType[] = [];
      if (!sourceData.serialNumber) warnings.push("MISSING_SERIAL_NUMBER");
      if (!sourceData.user) warnings.push("MISSING_USER");
      if (!sourceData.location) warnings.push("MISSING_LOCATION");
      if (!knownCondition(sourceData.condition))
        warnings.push("UNKNOWN_CONDITION");
      if (!/^KCSL\d{2,}$/i.test(sourceData.inventoryCode))
        warnings.push("LEGACY_CODE_PATTERN_WARNING");
      if (purchase.warning) warnings.push("PURCHASE_DATE_PARSE_WARNING");
      parsed.push({
        id: stableId(sourceData.inventoryCode),
        sheet,
        rowNumber: header.index + offset + 2,
        sourceData,
        code: sourceData.inventoryCode,
        brand,
        model,
        technicalSpecifications: parseTechnicalSpecifications(
          sourceData.specifications,
        ),
        purchaseDate: purchase.purchaseDate,
        purchaseYear: purchase.purchaseYear,
        condition: mapCondition(sourceData.condition),
        status: lifecycle(sourceData),
        warnings,
        disposition: "new",
      });
    });
  }
  if (!parsed.length)
    throw new Error(
      "Geen laptopinventaris met kolommen INV-CODE en BRAND - MODEL gevonden.",
    );

  const codeCounts = new Map<string, number>();
  const serialCounts = new Map<string, number>();
  parsed.forEach((row) => {
    codeCounts.set(
      row.code.toLowerCase(),
      (codeCounts.get(row.code.toLowerCase()) || 0) + 1,
    );
    const serial = row.sourceData.serialNumber.toLowerCase();
    if (serial) serialCounts.set(serial, (serialCounts.get(serial) || 0) + 1);
  });
  const inventoryCodes = new Set(
    existingInventory.map((item) => item.code.toLowerCase()),
  );
  const assetCodes = new Set(
    existingAssets.map((item) => item.code.toLowerCase()),
  );
  parsed.forEach((row) => {
    if ((codeCounts.get(row.code.toLowerCase()) || 0) > 1)
      row.warnings.push("DUPLICATE_INVENTORY_CODE");
    const serial = row.sourceData.serialNumber.toLowerCase();
    if (serial && (serialCounts.get(serial) || 0) > 1)
      row.warnings.push("DUPLICATE_SERIAL_NUMBER");
    const inInventory = inventoryCodes.has(row.code.toLowerCase());
    const inAssets = assetCodes.has(row.code.toLowerCase());
    row.disposition = row.warnings.includes("DUPLICATE_INVENTORY_CODE")
      ? "invalid"
      : inInventory && inAssets
        ? "existing"
        : inInventory || inAssets
          ? "conflict"
          : "new";
  });
  const summary = {
    total: parsed.length,
    valid: parsed.filter((row) => row.disposition !== "invalid").length,
    newRecords: parsed.filter((row) => row.disposition === "new").length,
    existing: parsed.filter((row) => row.disposition === "existing").length,
    conflicts: parsed.filter((row) => row.disposition === "conflict").length,
    duplicateCodes: countWarnings(parsed, "DUPLICATE_INVENTORY_CODE"),
    duplicateSerials: countWarnings(parsed, "DUPLICATE_SERIAL_NUMBER"),
    missingSerials: countWarnings(parsed, "MISSING_SERIAL_NUMBER"),
    missingUsers: countWarnings(parsed, "MISSING_USER"),
    missingLocations: countWarnings(parsed, "MISSING_LOCATION"),
    unknownConditions: countWarnings(parsed, "UNKNOWN_CONDITION"),
    legacyCodes: countWarnings(parsed, "LEGACY_CODE_PATTERN_WARNING"),
    purchaseWarnings: countWarnings(parsed, "PURCHASE_DATE_PARSE_WARNING"),
    requiringReview: parsed.filter(
      (row) => row.warnings.length > 0 || row.disposition === "conflict",
    ).length,
  };
  return {
    fileName: file.name,
    analyzedAt: new Date().toISOString(),
    rows: parsed,
    summary,
  };
}

export function rowsForImport(preview: LaptopImportPreview) {
  return preview.rows.filter((row) => row.disposition === "new");
}

export function validationReportCsv(preview: LaptopImportPreview) {
  const escape = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    ["Code", "Werkblad", "Rij", "Status", "Waarschuwingen"],
    ...preview.rows.map((row) => [
      row.code,
      row.sheet,
      row.rowNumber,
      row.disposition,
      row.warnings.join(" | "),
    ]),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
}
