import { normalizeAssetCode } from "../domain/assetCode";
import type { Asset } from "../domain/types";
import type {
  AssetHistoryEvent,
  CodeGroup,
  ReferenceRecord,
} from "../data/contracts";

export type MigrationStatus =
  | "VALID"
  | "VALID_WITH_WARNING"
  | "ERROR"
  | "AMBIGUOUS"
  | "DUPLICATE"
  | "SKIPPED"
  | "EXCLUDED_SENSITIVE_FIELD";
export type SourceRow = Record<string, unknown>;

export interface NormalizedLegacyAsset {
  sourceRow: number;
  sourceFile: string;
  sourceSheet: string;
  status: MigrationStatus;
  id: string;
  code?: string;
  codePrefix?: string;
  codeNumber?: number;
  name: string;
  type: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  macAddress?: string;
  location: string;
  department: string;
  assignedTo?: string;
  condition: string;
  assetStatus: string;
  purchaseDate?: string;
  purchaseYear?: string;
  accessories?: string;
  loanInformation?: string;
  technicalSpecifications: Record<string, string>;
  remoteAccess?: { anydeskId?: string; teamviewerId?: string };
  fingerprint: string;
  warnings: string[];
  duplicateKeys?: string[];
}

export interface MigrationIssue {
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  submitted: string;
  normalized: string;
  type:
    | MigrationStatus
    | "INVALID_DATE"
    | "UNMATCHED_HISTORY"
    | "AMBIGUOUS_HISTORY"
    | "CONFLICT";
  blocking: boolean;
  recommendation: string;
  affectedCount?: number;
  details?: Array<{ sourceRow: number; submitted: string }>;
}

export type HistoryMatchStatus =
  | "AUTO_MATCHED_BY_CODE"
  | "AUTO_MATCHED_BY_SERIAL"
  | "AUTO_MATCHED_BY_MAC"
  | "UNMATCHED_HISTORY"
  | "AMBIGUOUS_HISTORY";
export type HistoryDateStatus =
  "VALID_DATE" | "TYPO_CONFIRMATION_REQUIRED" | "INVALID_DATE" | "PARTIAL_DATE";
export type HistoryImportStatus = "READY" | "REVIEW_REQUIRED" | "SKIPPED";
export interface HistoryReviewRecord {
  fingerprint: string;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  rawCode: string;
  rawSerial: string;
  rawMac: string;
  normalizedCode: string;
  assetId?: string;
  assetCode?: string;
  status: HistoryMatchStatus;
  matchStatus: HistoryMatchStatus;
  dateStatus: HistoryDateStatus;
  importStatus: HistoryImportStatus;
  rawDate: string;
  proposedDate?: string;
  eventText: string;
}

export interface MigrationDryRun {
  mode: "DRY_RUN";
  assets: NormalizedLegacyAsset[];
  historyEvents: AssetHistoryEvent[];
  historyReview: HistoryReviewRecord[];
  assetsWithoutLegacyHistory: string[];
  categoriesToCreate: string[];
  locationsToCreate: string[];
  codeGroupsToCreate: Array<
    Pick<
      CodeGroup,
      | "name"
      | "prefix"
      | "minimumNumber"
      | "maximumNumber"
      | "nextAvailableNumber"
    >
  >;
  excludedSensitiveFields: number;
  duplicates: number;
  ambiguous: number;
  errors: number;
  warnings: number;
  issues: MigrationIssue[];
  expectedCreates: number;
  expectedUpdates: number;
  expectedSkips: number;
}

const header = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const text = (value: unknown) => String(value ?? "").trim();
const field = (row: SourceRow, names: string[]) => {
  const wanted = new Set(names.map(header));
  const entry = Object.entries(row).find(([key]) => wanted.has(header(key)));
  return text(entry?.[1]);
};
const sensitive = (key: string) =>
  /^(admin|administrator|localadmin)?password$|^adminpassw(ord)?$/i.test(
    header(key),
  );
const referenceKey = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const canonical = (value: string, existing: string[]) =>
  existing.find((item) => referenceKey(item) === referenceKey(value)) ||
  value.trim().replace(/\s+/g, " ");
const validMac = (value: string) =>
  /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(value.trim());
const suspiciousLocation = (value: string) =>
  /\bKCS[A-Z]*\s*-?\s*\d*\b/i.test(value) ||
  /\b(?:desk|laptop|device)\s*-?\s*$/i.test(value);
const normalizedCodeCandidate = (value: string) => {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const corrected = /^KSCL\d+$/.test(compact)
    ? compact.replace(/^KSCL/, "KCSL")
    : /^KCSDESKK\d+$/.test(compact)
      ? compact.replace(/^KCSDESKK/, "KCSDESK")
      : compact;
  const known = normalizeAssetCode(corrected);
  const generic = corrected.match(/^([A-Z]{2,12})(\d{1,4})$/);
  const codeNumber = Number(generic?.[2] || 0);
  const parsed =
    known ||
    (generic && codeNumber >= 0 && codeNumber <= 5000
      ? {
          codePrefix: generic[1],
          codeNumber,
          fullAssetCode: `${generic[1]}-${codeNumber < 100 ? String(codeNumber).padStart(2, "0") : codeNumber}`,
        }
      : null);
  return {
    submitted: value,
    corrected,
    wasCorrected: corrected !== compact,
    parsed,
  };
};
const normalizedCondition = (value: string) => {
  const key = value.toLowerCase();
  if (/nieuw|new/.test(key)) return "New";
  if (/excellent|uitstekend/.test(key)) return "Excellent";
  if (/fair|redelijk/.test(key)) return "Fair";
  if (/poor|slecht/.test(key)) return "Poor";
  if (/defect/.test(key)) return "Defective";
  if (/beyond|onherstelbaar/.test(key)) return "Beyond Repair";
  return "Good";
};
const normalizedStatus = (value: string) => {
  const key = value.toLowerCase();
  if (/assign|toegewezen|in use/.test(key)) return "Assigned";
  if (/borrow|bruikleen/.test(key)) return "Borrowed";
  if (/repair|repar/.test(key)) return "Under Repair";
  if (/maintenance|onderhoud/.test(key)) return "Under Maintenance";
  if (/lost|verloren/.test(key)) return "Lost";
  if (/missing|vermist/.test(key)) return "Missing";
  if (/damaged|beschadigd/.test(key)) return "Damaged";
  if (/disposed|afgevoerd/.test(key)) return "Disposed";
  if (/archived|gearchiveerd/.test(key)) return "Archived";
  return "Available";
};
const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};
const fingerprint = (...parts: unknown[]) =>
  stableHash(parts.map((part) => text(part).toLowerCase()).join("|"));
const sourceMeta = (row: SourceRow, fallbackRow: number) => ({
  sourceFile: text(row.__sourceFile) || "Unknown workbook",
  sourceSheet: text(row.__sourceSheet) || "Unknown sheet",
  sourceRow: Number(row.__sourceRow || fallbackRow),
});
const months: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mrt: 3,
  maart: 3,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  aug: 8,
  augustus: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};
const correctedMonths: Record<string, number> = {
  febr: 2,
  mmart: 3,
  aproil: 4,
  julie: 7,
};
const isoDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date.toISOString()
    : undefined;
};
export function normalizeLegacyDate(value: unknown): string | undefined {
  const analysis = analyzeLegacyDate(value);
  return analysis.status === "VALID_DATE" ? analysis.proposedDate : undefined;
}

export function analyzeLegacyDate(value: unknown): {
  status: HistoryDateStatus;
  proposedDate?: string;
} {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return { status: "VALID_DATE", proposedDate: value.toISOString() };
  if (typeof value === "number" && value > 1 && value < 100000)
    return {
      status: "VALID_DATE",
      proposedDate: new Date(
        Date.UTC(1899, 11, 30 + Math.floor(value)),
      ).toISOString(),
    };
  const raw = text(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[,]/g, " ")
    .replace(/\s*[-/]\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return { status: "INVALID_DATE" };
  if (
    /^\d{4}$/.test(raw) ||
    /^\d{1,2}[-/]\d{4}$/.test(raw) ||
    /^[a-z]+\s+\d{4}$/.test(raw)
  )
    return { status: "PARTIAL_DATE" };
  if (/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(?:\.\d+)?z$/i.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime())
      ? { status: "INVALID_DATE" }
      : { status: "VALID_DATE", proposedDate: parsed.toISOString() };
  }
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const proposedDate = isoDate(
      Number(iso[1]),
      Number(iso[2]),
      Number(iso[3]),
    );
    return proposedDate
      ? { status: "VALID_DATE", proposedDate }
      : { status: "INVALID_DATE" };
  }
  const named = raw.match(/^(\d{1,2})\s*-?\s*([a-z]+)\s*-?\s*(\d{2}|\d{4})$/);
  if (named && months[named[2]]) {
    const year =
      Number(named[3]) +
      (named[3].length === 2 ? (Number(named[3]) <= 50 ? 2000 : 1900) : 0);
    const proposedDate = isoDate(year, months[named[2]], Number(named[1]));
    return proposedDate
      ? { status: "VALID_DATE", proposedDate }
      : { status: "INVALID_DATE" };
  }
  if (named && correctedMonths[named[2]]) {
    const year =
      Number(named[3]) +
      (named[3].length === 2 ? (Number(named[3]) <= 50 ? 2000 : 1900) : 0);
    const proposedDate = isoDate(
      year,
      correctedMonths[named[2]],
      Number(named[1]),
    );
    return proposedDate
      ? { status: "TYPO_CONFIRMATION_REQUIRED", proposedDate }
      : { status: "INVALID_DATE" };
  }
  const numeric = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/);
  if (numeric) {
    const short = Number(numeric[3]);
    const year =
      short + (numeric[3].length === 2 ? (short <= 50 ? 2000 : 1900) : 0);
    const proposedDate = isoDate(year, Number(numeric[2]), Number(numeric[1]));
    return proposedDate
      ? { status: "VALID_DATE", proposedDate }
      : { status: "INVALID_DATE" };
  }
  return { status: "INVALID_DATE" };
}

export function containsSensitiveAdminPasswordField(rows: SourceRow[]) {
  return rows.some((row) => Object.keys(row).some(sensitive));
}

export function sanitizeSourceRow(row: SourceRow) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !sensitive(key)),
  );
}

export function classifyLegacyEvent(value: string) {
  const normalized = value.toLowerCase();
  if (/ram|ssd|disk|charger|touch|hardware|vervang/.test(normalized))
    return "hardware_replaced";
  if (/repair|repar|defect|fault|werkt niet|would not/.test(normalized))
    return "repair_completed";
  if (/windows|software|bios|firmware|update/.test(normalized))
    return "software_updated";
  if (/clean|schoon/.test(normalized)) return "device_cleaned";
  if (/inspect|scan|controle/.test(normalized)) return "inspection_completed";
  if (/service|maintenance|onderhoud/.test(normalized))
    return "maintenance_completed";
  if (/dispose|afvoer|gesloopt|spare parts/.test(normalized))
    return "disposal_completed";
  if (/move|verplaats|location/.test(normalized)) return "location_changed";
  return "legacy_import";
}

export function dryRunLegacyMigration({
  masterRows,
  historyRows,
  existingAssets,
  references,
  codeGroups,
  importBatchId,
}: {
  masterRows: SourceRow[];
  historyRows: SourceRow[];
  existingAssets: Asset[];
  references: ReferenceRecord[];
  codeGroups: CodeGroup[];
  importBatchId: string;
}): MigrationDryRun {
  const cleanMaster = masterRows.map(sanitizeSourceRow);
  const cleanHistory = historyRows.map(sanitizeSourceRow);
  const categories = references
    .filter((item) => item.kind === "category")
    .map((item) => item.name);
  const locations = references
    .filter((item) => item.kind === "location")
    .map((item) => item.name);
  const sourceIdentities = cleanMaster.map((row) => {
    const candidate = normalizedCodeCandidate(
      field(row, [
        "asset code",
        "inv code",
        "inventory code",
        "code",
        "asset id",
        "device id",
      ]),
    );
    const serial = field(row, [
      "serial number",
      "s/n",
      "serial",
      "service tag",
    ]).toLowerCase();
    const rawMac = field(row, ["mac address", "mac", "macadres"]);
    return {
      code: candidate.parsed?.fullAssetCode || "",
      serial,
      mac: validMac(rawMac) ? rawMac.toUpperCase().replaceAll("-", ":") : "",
    };
  });
  const frequencies = (values: string[]) =>
    values.reduce(
      (map, value) => (value && map.set(value, (map.get(value) || 0) + 1), map),
      new Map<string, number>(),
    );
  const codeFrequency = frequencies(sourceIdentities.map((item) => item.code));
  const serialFrequency = frequencies(
    sourceIdentities.map((item) => item.serial),
  );
  const macFrequency = frequencies(sourceIdentities.map((item) => item.mac));
  const issues: MigrationIssue[] = [];
  const normalizedAssets: NormalizedLegacyAsset[] = cleanMaster.map(
    (row, index) => {
      const rawCode = field(row, [
        "asset code",
        "inv code",
        "inventory code",
        "code",
        "asset id",
        "device id",
      ]);
      const codeCandidate = normalizedCodeCandidate(rawCode);
      const correctedRawCode = codeCandidate.corrected;
      const parsedCode = codeCandidate.parsed;
      const candidateCode = correctedRawCode.match(
        /^(KCS[A-Z0-9]{1,13}?)(\d{1,4})$/,
      );
      const candidateNumber = Number(candidateCode?.[2] || 0);
      const candidatePrefix =
        candidateCode && candidateNumber >= 1 && candidateNumber <= 5000
          ? candidateCode[1]
          : undefined;
      const serialNumber = field(row, [
        "serial number",
        "s/n",
        "serial",
        "service tag",
      ]);
      const submittedMac = field(row, ["mac address", "mac", "macadres"]);
      const macAddress = validMac(submittedMac)
        ? submittedMac.toUpperCase().replaceAll("-", ":")
        : "";
      const submittedLocation = field(row, ["location", "locatie", "room"]);
      const rawLocation = suspiciousLocation(submittedLocation)
        ? ""
        : submittedLocation;
      const rawCategory = field(row, [
        "category",
        "categorie",
        "device type",
        "item",
      ]);
      const existingConflict = existingAssets.some(
        (asset) =>
          (parsedCode && asset.code === parsedCode.fullAssetCode) ||
          (serialNumber &&
            asset.serialNumber.toLowerCase() === serialNumber.toLowerCase()),
      );
      const duplicateKeys = [
        parsedCode && (codeFrequency.get(parsedCode.fullAssetCode) || 0) > 1
          ? `CODE:${parsedCode.fullAssetCode}`
          : "",
        serialNumber &&
        (serialFrequency.get(serialNumber.toLowerCase()) || 0) > 1
          ? `SERIAL:${serialNumber.toUpperCase()}`
          : "",
        macAddress && (macFrequency.get(macAddress) || 0) > 1
          ? `MAC:${macAddress}`
          : "",
        existingConflict
          ? `EXISTING:${parsedCode?.fullAssetCode || serialNumber.toUpperCase()}`
          : "",
      ].filter(Boolean) as string[];
      const codeDuplicate = duplicateKeys.some(
        (value) => value.startsWith("CODE:") || value.startsWith("EXISTING:"),
      );
      const serialDuplicate = duplicateKeys.some((value) =>
        value.startsWith("SERIAL:"),
      );
      const macDuplicate = duplicateKeys.some((value) =>
        value.startsWith("MAC:"),
      );
      const warnings: string[] = [];
      if (codeCandidate.wasCorrected)
        warnings.push(
          `Waarschijnlijke codefout gecorrigeerd: ${rawCode} → ${correctedRawCode}.`,
        );
      if (!parsedCode)
        warnings.push(
          "Asset code missing or invalid; existing code-group allocator must assign a code.",
        );
      if (submittedMac && !macAddress)
        warnings.push("Ongeldig MAC-adres genegeerd als identiteit.");
      if (submittedLocation && !rawLocation)
        warnings.push(
          `Verdachte samengestelde locatie niet automatisch overgenomen: ${submittedLocation}.`,
        );
      if (!rawLocation)
        warnings.push(
          "Locatie ontbreekt en moet tijdens review worden aangevuld.",
        );
      const reliableIdentity = Boolean(
        parsedCode || serialNumber || macAddress,
      );
      const missingRequired = [
        !reliableIdentity && "betrouwbare identiteit",
      ].filter(Boolean) as string[];
      const duplicate = codeDuplicate || serialDuplicate || macDuplicate;
      const meta = sourceMeta(row, index + 2);
      if (duplicate)
        issues.push({
          ...meta,
          submitted: rawCode || serialNumber || macAddress,
          normalized: parsedCode?.fullAssetCode || "",
          type: "DUPLICATE",
          blocking: true,
          recommendation:
            "Los de dubbele assetcode, het serienummer of MAC-adres op voordat u importeert.",
        });
      if (missingRequired.length)
        issues.push({
          ...meta,
          submitted: rawCode,
          normalized: parsedCode?.fullAssetCode || "",
          type: "ERROR",
          blocking: true,
          recommendation: `Vul verplichte velden aan: ${missingRequired.join(", ")}.`,
        });
      warnings.forEach((warning) =>
        issues.push({
          ...meta,
          submitted: rawCode,
          normalized: parsedCode?.fullAssetCode || "",
          type: "VALID_WITH_WARNING",
          blocking: false,
          recommendation: warning,
        }),
      );
      const idSeed =
        parsedCode?.fullAssetCode || serialNumber || `source-row-${index + 2}`;
      return {
        sourceRow: meta.sourceRow,
        sourceFile: meta.sourceFile,
        sourceSheet: meta.sourceSheet,
        status: duplicate
          ? "DUPLICATE"
          : missingRequired.length
            ? "ERROR"
            : warnings.length
              ? "VALID_WITH_WARNING"
              : "VALID",
        id: `legacy-${stableHash(idSeed.toLowerCase())}`,
        code: parsedCode?.fullAssetCode,
        codePrefix: parsedCode?.codePrefix || candidatePrefix,
        codeNumber: parsedCode?.codeNumber,
        name:
          field(row, [
            "name",
            "device name",
            "asset name",
            "item",
            "brand - model",
          ]) || "Legacy asset",
        type:
          field(row, ["type", "device type", "asset type", "item type"]) ||
          rawCategory ||
          "Device",
        category: canonical(rawCategory, categories),
        brand:
          field(row, ["brand", "merk"]) ||
          field(row, ["brand - model"]).split(/\s+-\s+|\s+/)[0] ||
          "",
        model:
          field(row, ["model"]) ||
          field(row, ["brand - model"])
            .split(/\s+-\s+|\s+/)
            .slice(1)
            .join(" "),
        serialNumber,
        macAddress: macAddress || undefined,
        location: canonical(rawLocation, locations),
        department: field(row, ["department", "afdeling"]),
        assignedTo:
          field(row, [
            "user",
            "gebruiker",
            "assigned to",
            "employee",
            "medewerker",
          ]) || undefined,
        condition: normalizedCondition(field(row, ["condition", "conditie"])),
        assetStatus: normalizedStatus(
          field(row, ["asset status", "current status", "status"]),
        ),
        purchaseDate: normalizeLegacyDate(
          field(row, ["purchase date", "aankoopdatum", "date purchased"]),
        ),
        purchaseYear: field(row, ["purchase year", "aankoopjaar"]) || undefined,
        accessories: field(row, ["accessories", "accessoires"]) || undefined,
        loanInformation:
          field(row, [
            "loan",
            "bruikleen",
            "loan information",
            "bruikleeninformatie",
            "bruikleen contract",
          ]) || undefined,
        technicalSpecifications: Object.fromEntries(
          [
            ["cpu", field(row, ["cpu", "processor"])],
            ["ram", field(row, ["ram", "memory"])],
            ["storage", field(row, ["ssd", "hdd", "storage"])],
            ["windows", field(row, ["windows", "operating system", "os"])],
            ["office", field(row, ["office"])],
            ["specs", field(row, ["specs", "technical specifications"])],
          ].filter((entry): entry is [string, string] => Boolean(entry[1])),
        ),
        remoteAccess: {
          anydeskId: field(row, ["anydesk", "anydesk id"]) || undefined,
          teamviewerId:
            field(row, ["teamviewer", "teamviewer id"]) || undefined,
        },
        fingerprint: fingerprint(
          parsedCode?.fullAssetCode,
          serialNumber,
          field(row, ["mac address", "mac"]),
          index + 2,
        ),
        warnings,
        duplicateKeys,
      };
    },
  );

  const canonicalAssets = [
    ...existingAssets.map((item) => ({
      id: item.id,
      code: item.code,
      serialNumber: item.serialNumber,
      macAddress: undefined as string | undefined,
    })),
    ...normalizedAssets
      .filter(
        (item) =>
          !item.duplicateKeys?.some((key) => key.startsWith("EXISTING:")),
      )
      .map((item) => ({
        id: item.id,
        code: item.code || "",
        serialNumber: item.serialNumber,
        macAddress: item.macAddress,
      })),
  ];
  const historyConflicts = new Map<
    string,
    {
      meta: ReturnType<typeof sourceMeta>;
      type: "AMBIGUOUS_HISTORY" | "UNMATCHED_HISTORY";
      details: Array<{ sourceRow: number; submitted: string }>;
    }
  >();
  const reportedHistoryCorrections = new Set<string>();
  const historyReview: HistoryReviewRecord[] = [];
  const historyEvents: AssetHistoryEvent[] = cleanHistory.flatMap(
    (row, index) => {
      const deviceName = field(row, [
        "device name",
        "asset code",
        "code",
        "asset id",
        "device id",
      ]);
      const deviceCandidate = normalizedCodeCandidate(deviceName);
      const sheetCandidate = normalizedCodeCandidate(text(row.__sourceSheet));
      const deviceCode = deviceCandidate.parsed?.fullAssetCode || "";
      const sheetCode = sheetCandidate.parsed?.fullAssetCode || "";
      const serial = field(row, [
        "serial number",
        "serial",
        "s/n",
        "service tag",
      ]);
      const submittedHistoryMac = field(row, [
        "mac address",
        "mac",
        "macadres",
      ]);
      const mac = validMac(submittedHistoryMac)
        ? submittedHistoryMac.toUpperCase().replaceAll("-", ":")
        : "";
      const byDeviceName = deviceCode
        ? canonicalAssets.filter((asset) => asset.code === deviceCode)
        : [];
      const bySheet =
        !byDeviceName.length && sheetCode
          ? canonicalAssets.filter((asset) => asset.code === sheetCode)
          : [];
      const bySerial =
        !byDeviceName.length && !bySheet.length && serial
          ? canonicalAssets.filter(
              (asset) =>
                asset.serialNumber &&
                asset.serialNumber.toLowerCase() === serial.toLowerCase(),
            )
          : [];
      const byMac =
        !byDeviceName.length && !bySheet.length && !bySerial.length && mac
          ? canonicalAssets.filter(
              (asset) => asset.macAddress?.toUpperCase() === mac,
            )
          : [];
      const matches = byDeviceName.length
        ? byDeviceName
        : bySheet.length
          ? bySheet
          : bySerial.length
            ? bySerial
            : byMac;
      const code = deviceCode || sheetCode;
      const rawDate = field(row, [
        "date",
        "datum",
        "occurred at",
        "service date",
      ]);
      const dateAnalysis = analyzeLegacyDate(rawDate);
      const occurredAt = dateAnalysis.proposedDate;
      const issue = field(row, ["issue", "probleem", "fault"]);
      const solution = field(row, ["solution", "oplossing", "repair"]);
      const description = field(row, [
        "description",
        "status",
        "maintenance",
        "service",
        "opmerkingen",
        "notes",
      ]);
      const meta = sourceMeta(row, index + 2);
      const reviewFingerprint = fingerprint(
        meta.sourceFile,
        meta.sourceSheet,
        meta.sourceRow,
        deviceName,
        serial,
        submittedHistoryMac,
      );
      const method: HistoryMatchStatus =
        matches.length > 1
          ? "AMBIGUOUS_HISTORY"
          : matches.length === 0
            ? "UNMATCHED_HISTORY"
            : byDeviceName.length || bySheet.length
              ? "AUTO_MATCHED_BY_CODE"
              : bySerial.length
                ? "AUTO_MATCHED_BY_SERIAL"
                : "AUTO_MATCHED_BY_MAC";
      const appliedCorrection =
        deviceCandidate.wasCorrected && byDeviceName.length
          ? deviceCandidate
          : sheetCandidate.wasCorrected && bySheet.length
            ? sheetCandidate
            : undefined;
      if (
        appliedCorrection &&
        !reportedHistoryCorrections.has(meta.sourceSheet)
      ) {
        reportedHistoryCorrections.add(meta.sourceSheet);
        issues.push({
          ...meta,
          submitted: appliedCorrection.submitted,
          normalized:
            appliedCorrection.parsed?.fullAssetCode ||
            appliedCorrection.corrected,
          type: "VALID_WITH_WARNING",
          blocking: false,
          recommendation: `Reviewbare History-codecorrectie toegepast: ${appliedCorrection.submitted} → ${appliedCorrection.parsed?.fullAssetCode || appliedCorrection.corrected}.`,
        });
      }
      if (dateAnalysis.status !== "VALID_DATE") {
        issues.push({
          ...meta,
          submitted: field(row, [
            "date",
            "datum",
            "occurred at",
            "service date",
          ]),
          normalized: "",
          type: "INVALID_DATE",
          blocking: true,
          recommendation:
            dateAnalysis.status === "TYPO_CONFIRMATION_REQUIRED"
              ? "Bevestig de voorgestelde correctie van de datumtypfout."
              : dateAnalysis.status === "PARTIAL_DATE"
                ? "Vul de ontbrekende dag aan; AIMS verzint geen dag."
                : "Vul een volledige, controleerbare datum in; AIMS verzint geen exacte datum.",
        });
      }
      if (matches.length !== 1) {
        historyReview.push({
          fingerprint: reviewFingerprint,
          ...meta,
          rawCode: deviceName || text(row.__sourceSheet),
          rawSerial: serial,
          rawMac: mac,
          normalizedCode: code,
          status: method,
          matchStatus: method,
          dateStatus: dateAnalysis.status,
          importStatus: "REVIEW_REQUIRED",
          rawDate,
          proposedDate: dateAnalysis.proposedDate,
          eventText: [description, issue, solution].filter(Boolean).join(" | "),
        });
        const type = matches.length ? "AMBIGUOUS_HISTORY" : "UNMATCHED_HISTORY";
        const key = `${meta.sourceFile}|${meta.sourceSheet}|${type}`;
        const conflict = historyConflicts.get(key) || {
          meta,
          type,
          details: [] as Array<{ sourceRow: number; submitted: string }>,
        };
        conflict.details.push({
          sourceRow: meta.sourceRow,
          submitted: code || serial || mac,
        });
        historyConflicts.set(key, conflict);
        return [];
      }
      if (dateAnalysis.status !== "VALID_DATE" || !occurredAt) {
        historyReview.push({
          fingerprint: reviewFingerprint,
          ...meta,
          rawCode: deviceName || text(row.__sourceSheet),
          rawSerial: serial,
          rawMac: mac,
          normalizedCode: code,
          assetId: matches[0].id,
          assetCode: matches[0].code,
          status: method,
          matchStatus: method,
          dateStatus: dateAnalysis.status,
          importStatus: "REVIEW_REQUIRED",
          rawDate,
          proposedDate: dateAnalysis.proposedDate,
          eventText: [description, issue, solution].filter(Boolean).join(" | "),
        });
        return [];
      }
      const asset = matches[0];
      historyReview.push({
        fingerprint: reviewFingerprint,
        ...meta,
        rawCode: deviceName || text(row.__sourceSheet),
        rawSerial: serial,
        rawMac: mac,
        normalizedCode: code,
        assetId: asset.id,
        assetCode: asset.code,
        status: method,
        matchStatus: method,
        dateStatus: dateAnalysis.status,
        importStatus: "READY",
        rawDate,
        proposedDate: occurredAt,
        eventText: [description, issue, solution].filter(Boolean).join(" | "),
      });
      const originalLegacyText = [description, issue, solution]
        .filter(Boolean)
        .join(" | ");
      return [
        {
          id: `legacy-event-${fingerprint(asset.id, occurredAt, originalLegacyText, index + 2)}`,
          assetId: asset.id,
          assetCode: asset.code || code,
          eventType: classifyLegacyEvent(originalLegacyText),
          category: "legacy",
          title: field(row, ["title", "status"]) || "Imported legacy record",
          description,
          issue: issue || undefined,
          solution: solution || undefined,
          notes: field(row, ["notes", "opmerkingen"]) || undefined,
          sourceModule: "legacy_migration",
          sourceRecordId: `${meta.sourceFile}:${meta.sourceSheet}:${meta.sourceRow}`,
          source: "legacy_import",
          createdAt: new Date().toISOString(),
          occurredAt,
          createdBy: "legacy_migration",
          performedBy:
            field(row, ["performed by", "technician", "user"]) || undefined,
          importBatchId,
          originalLegacyText,
          isLegacyImport: true,
          isManual: false,
          status: "Final",
          version: 1,
          fingerprint: fingerprint(asset.id, occurredAt, originalLegacyText),
        },
      ];
    },
  );
  historyConflicts.forEach((conflict) =>
    issues.push({
      ...conflict.meta,
      submitted: conflict.meta.sourceSheet,
      normalized: "",
      type: conflict.type,
      blocking: true,
      affectedCount: conflict.details.length,
      details: conflict.details,
      recommendation: `Koppel dit werkblad handmatig aan precies één asset; ${conflict.details.length} gebeurtenissen zijn hierdoor getroffen.`,
    }),
  );
  const uniqueReferences = (values: string[], existing: string[]) => [
    ...new Map(
      values
        .filter(
          (value) =>
            value &&
            !existing.some(
              (item) => referenceKey(item) === referenceKey(value),
            ),
        )
        .map((value) => [referenceKey(value), value]),
    ).values(),
  ];
  const categoriesToCreate = uniqueReferences(
    normalizedAssets.map((item) => item.category),
    categories,
  );
  const locationsToCreate = uniqueReferences(
    normalizedAssets.map((item) => item.location),
    locations,
  );
  const detectedPrefixes = [
    ...new Set(
      normalizedAssets
        .map((item) => item.codePrefix)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const codeGroupsToCreate = detectedPrefixes
    .filter(
      (prefix) =>
        !codeGroups.some(
          (group) => group.prefix.toLowerCase() === prefix.toLowerCase(),
        ),
    )
    .map((prefix) => ({
      name: `Legacy ${prefix}`,
      prefix,
      minimumNumber: 1,
      maximumNumber: 5000,
      nextAvailableNumber: 1,
    }));
  const allRows = [...masterRows, ...historyRows];
  const assetsWithHistory = new Set(
    historyReview
      .filter((item) => item.assetCode && item.matchStatus.startsWith("AUTO_"))
      .map((item) => item.assetCode),
  );
  const uniqueAssetCodes = [
    ...new Set(
      normalizedAssets
        .map((item) => item.code)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const assetsWithoutLegacyHistory = uniqueAssetCodes.filter(
    (code) => !assetsWithHistory.has(code),
  );
  return {
    mode: "DRY_RUN",
    assets: normalizedAssets,
    historyEvents,
    historyReview,
    assetsWithoutLegacyHistory,
    categoriesToCreate,
    locationsToCreate,
    codeGroupsToCreate,
    excludedSensitiveFields: allRows.reduce(
      (count, row) => count + Object.keys(row).filter(sensitive).length,
      0,
    ),
    duplicates: normalizedAssets.filter((item) => item.status === "DUPLICATE")
      .length,
    ambiguous: issues
      .filter(
        (issue) =>
          issue.type === "AMBIGUOUS" || issue.type === "UNMATCHED_HISTORY",
      )
      .reduce((total, issue) => total + (issue.affectedCount || 1), 0),
    errors: issues.filter(
      (issue) => issue.type === "INVALID_DATE" || issue.type === "ERROR",
    ).length,
    warnings: normalizedAssets.filter(
      (item) => item.status === "VALID_WITH_WARNING",
    ).length,
    issues,
    expectedCreates:
      normalizedAssets.filter(
        (item) =>
          item.status === "VALID" || item.status === "VALID_WITH_WARNING",
      ).length +
      historyEvents.length +
      categoriesToCreate.length +
      locationsToCreate.length +
      codeGroupsToCreate.length,
    expectedUpdates: 0,
    expectedSkips:
      normalizedAssets.filter(
        (item) => item.status === "DUPLICATE" || item.status === "ERROR",
      ).length +
      cleanHistory.length -
      historyEvents.length,
  };
}
