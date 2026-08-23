import type { MigrationDryRun, NormalizedLegacyAsset } from "./legacyMigration";

export type DuplicateDecision =
  | "UPDATE_EXISTING"
  | "USE_MASTER"
  | "MERGE"
  | "SKIP"
  | "DIFFERENT_ASSET"
  | "MANUAL_CODE";
export type HistoryDecision =
  | "USER_MATCHED_WORKSHEET"
  | "CREATE_ASSET_AND_MATCH"
  | "SKIPPED_BY_USER"
  | "NOT_AN_EVENT";
export type DateDecision = "CONFIRMED" | "CORRECTED" | "SKIPPED_BY_USER";
export type ReferenceDecision = "MAP_EXISTING" | "CREATE" | "RENAME" | "SKIP";
export interface AuditDecision {
  type: string;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  originalValue: string;
  normalizedValue: string;
  chosenAsset?: string;
  user: string;
  timestamp: string;
  reason: string;
  fingerprint: string;
}
export const IMPORT_PARSER_SCHEMA_VERSION = 6 as const;
export interface ReviewManifest {
  version: 6;
  fileFingerprint: string;
  duplicateDecisions: Record<
    string,
    {
      decision: DuplicateDecision;
      manualCode?: string;
      fields?: Record<string, "existing" | "incoming">;
    }
  >;
  historyDecisions: Record<
    string,
    {
      decision: HistoryDecision;
      assetCode?: string;
      reason: string;
      createAsset?: { assetCode: string; name: string; category: string };
    }
  >;
  dateDecisions: Record<
    string,
    { decision: DateDecision; date?: string; reason: string }
  >;
  referenceDecisions: Record<
    string,
    { decision: ReferenceDecision; value?: string; parent?: string }
  >;
  supplementalReferences: Array<{
    kind: "location" | "codeGroup";
    value: string;
    parent?: string;
    description?: string;
  }>;
  audit: AuditDecision[];
}
export interface DuplicateGroup {
  id: string;
  reason: string;
  assets: NormalizedLegacyAsset[];
}
export interface ReferenceProposal {
  id: string;
  kind: "category" | "location" | "codeGroup";
  value: string;
  normalized: string;
  count: number;
  sourceSheets: string[];
  suspicious: boolean;
}

const key = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
export const newReviewManifest = (fileFingerprint: string): ReviewManifest => ({
  version: IMPORT_PARSER_SCHEMA_VERSION,
  fileFingerprint,
  duplicateDecisions: {},
  historyDecisions: {},
  dateDecisions: {},
  referenceDecisions: {},
  supplementalReferences: [],
  audit: [],
});
const storageKey = (fingerprint: string) =>
  `aims-import-review:v${IMPORT_PARSER_SCHEMA_VERSION}:${fingerprint}`;
export function loadReviewManifest(
  storage: Pick<Storage, "getItem">,
  fingerprint: string,
) {
  try {
    const parsed = JSON.parse(
      storage.getItem(storageKey(fingerprint)) || "",
    ) as ReviewManifest;
    return parsed.version === IMPORT_PARSER_SCHEMA_VERSION &&
      parsed.fileFingerprint === fingerprint
      ? parsed
      : newReviewManifest(fingerprint);
  } catch {
    return newReviewManifest(fingerprint);
  }
}
export function saveReviewManifest(
  storage: Pick<Storage, "setItem">,
  manifest: ReviewManifest,
) {
  storage.setItem(
    storageKey(manifest.fileFingerprint),
    JSON.stringify(manifest),
  );
}
export function clearReviewManifest(
  storage: Pick<Storage, "removeItem">,
  fingerprint: string,
) {
  storage.removeItem(storageKey(fingerprint));
}
export const workbookFingerprint = (master: File, history: File) =>
  [
    master.name,
    master.size,
    master.lastModified,
    history.name,
    history.size,
    history.lastModified,
  ].join("|");
export const selectedWorkbooksFingerprint = (files: File[]) =>
  files
    .map((file) => [file.name, file.size, file.lastModified].join(":"))
    .join("|");

export function duplicateGroups(dryRun: MigrationDryRun): DuplicateGroup[] {
  const duplicates = dryRun.assets.filter(
    (asset) => asset.status === "DUPLICATE",
  );
  const grouped = new Map<string, NormalizedLegacyAsset[]>();
  duplicates.forEach((asset) =>
    (asset.duplicateKeys?.length
      ? asset.duplicateKeys
      : [`ROW:${asset.fingerprint}`]
    ).forEach((id) => grouped.set(id, [...(grouped.get(id) || []), asset])),
  );
  return [...grouped].map(([id, assets]) => ({
    id,
    reason: id.replace(":", ": "),
    assets,
  }));
}
export function referenceProposals(
  dryRun: MigrationDryRun,
): ReferenceProposal[] {
  const make = (
    kind: ReferenceProposal["kind"],
    value: string,
  ): ReferenceProposal => {
    const assets = dryRun.assets.filter((asset) =>
      kind === "category"
        ? key(asset.category) === key(value)
        : kind === "location"
          ? key(asset.location) === key(value)
          : asset.codePrefix === value,
    );
    return {
      id: `${kind}:${key(value)}`,
      kind,
      value,
      normalized: key(value),
      count: assets.length,
      sourceSheets: [...new Set(assets.map((asset) => asset.sourceSheet))],
      suspicious:
        kind === "location" && /\bKCS[A-Z]*\s*-?\s*\d+\b/i.test(value),
    };
  };
  return [
    ...dryRun.categoriesToCreate.map((value) => make("category", value)),
    ...dryRun.locationsToCreate.map((value) => make("location", value)),
    ...dryRun.codeGroupsToCreate.map((value) =>
      make("codeGroup", value.prefix),
    ),
  ];
}
export function reviewBlockers(
  dryRun: MigrationDryRun,
  manifest: ReviewManifest,
) {
  const duplicates = duplicateGroups(dryRun).filter(
    (group) => !manifest.duplicateDecisions[group.id],
  ).length;
  const history = dryRun.historyReview.filter(
    (item) =>
      (item.status === "UNMATCHED_HISTORY" ||
        item.status === "AMBIGUOUS_HISTORY") &&
      !manifest.historyDecisions[item.fingerprint],
  ).length;
  const dates = dryRun.historyReview.filter(
    (item) =>
      item.dateStatus !== "VALID_DATE" &&
      !manifest.dateDecisions[item.fingerprint],
  ).length;
  const references = referenceProposals(dryRun).filter(
    (item) => !manifest.referenceDecisions[item.id],
  ).length;
  const codeConflicts = dryRun.issues.filter(
    (issue) => issue.type === "ERROR" && /code/i.test(issue.recommendation),
  ).length;
  const sensitive = dryRun.excludedSensitiveFields < 0 ? 1 : 0;
  return {
    duplicates,
    history,
    dates,
    references,
    codeConflicts,
    sensitive,
    total:
      duplicates + history + dates + references + codeConflicts + sensitive,
  };
}
export function resolveHistoryReview(
  dryRun: MigrationDryRun,
  manifest: ReviewManifest,
) {
  return dryRun.historyReview.map((item) => {
    const decision = manifest.historyDecisions[item.fingerprint];
    return decision
      ? {
          ...item,
          status: decision.decision,
          assetCode: decision.assetCode || item.assetCode,
        }
      : item;
  });
}
export function applyWorksheetDecision(
  manifest: ReviewManifest,
  dryRun: MigrationDryRun,
  sheet: string,
  decision: { decision: HistoryDecision; assetCode?: string; reason: string },
) {
  const next = {
    ...manifest,
    historyDecisions: { ...manifest.historyDecisions },
  };
  dryRun.historyReview
    .filter(
      (item) =>
        item.sourceSheet === sheet &&
        (item.matchStatus === "UNMATCHED_HISTORY" ||
          item.matchStatus === "AMBIGUOUS_HISTORY"),
    )
    .forEach((item) => {
      next.historyDecisions[item.fingerprint] = decision;
    });
  return next;
}

export function applyApprovedBulkResolutions(
  dryRun: MigrationDryRun,
  manifest: ReviewManifest,
  options: {
    defaultDate: string;
    createAssetsBySheet: Record<
      string,
      { assetCode: string; name: string; category: string }
    >;
  },
) {
  const date = `${options.defaultDate}T00:00:00.000Z`;
  const next: ReviewManifest = {
    ...manifest,
    duplicateDecisions: { ...manifest.duplicateDecisions },
    historyDecisions: { ...manifest.historyDecisions },
    dateDecisions: { ...manifest.dateDecisions },
    audit: [...manifest.audit],
  };
  duplicateGroups(dryRun).forEach((group) => {
    next.duplicateDecisions[group.id] = { decision: "MERGE", fields: {} };
  });
  dryRun.historyReview.forEach((item) => {
    if (item.dateStatus !== "VALID_DATE")
      next.dateDecisions[item.fingerprint] =
        item.dateStatus === "TYPO_CONFIRMATION_REQUIRED" && item.proposedDate
          ? {
              decision: "CONFIRMED",
              date: item.proposedDate,
              reason: "Voorgestelde datumtypfout bevestigd door gebruiker",
            }
          : {
              decision: "CORRECTED",
              date,
              reason: `Standaarddatum ${options.defaultDate} door gebruiker toegewezen; oorspronkelijke datumstatus ${item.dateStatus}`,
            };
    if (item.matchStatus === "AMBIGUOUS_HISTORY")
      next.historyDecisions[item.fingerprint] = {
        decision: "USER_MATCHED_WORKSHEET",
        assetCode: item.normalizedCode || item.assetCode,
        reason:
          "Na samenvoegen van de duplicaatgroep gekoppeld aan de genormaliseerde assetcode",
      };
    if (item.matchStatus === "UNMATCHED_HISTORY") {
      const createAsset = options.createAssetsBySheet[item.sourceSheet];
      if (createAsset)
        next.historyDecisions[item.fingerprint] = {
          decision: "CREATE_ASSET_AND_MATCH",
          assetCode: createAsset.assetCode,
          createAsset,
          reason:
            "Gebruiker heeft aanmaak van deze ontbrekende asset expliciet toegestaan",
        };
    }
  });
  return next;
}

export function reviewCreatedAssets(manifest: ReviewManifest) {
  return [
    ...new Map(
      Object.values(manifest.historyDecisions)
        .flatMap((decision) =>
          decision.createAsset ? [decision.createAsset] : [],
        )
        .map((asset) => [asset.assetCode, asset]),
    ).values(),
  ];
}
export function applyApprovedReferenceStructure(
  dryRun: MigrationDryRun,
  manifest: ReviewManifest,
) {
  const next: ReviewManifest = {
    ...manifest,
    referenceDecisions: { ...manifest.referenceDecisions },
    supplementalReferences: [...manifest.supplementalReferences],
  };
  const locationTarget = (value: string) => {
    const compact = key(value);
    const explicitParents: Record<string, string> = {
      ICT: "KCS Onderbouw",
      STORAGE: "KCS Onderbouw",
      "KO/NSO": "KCS Onderbouw",
      FINANCE: "KCS Onderbouw",
      HRM: "KCS Onderbouw",
      "ADMIN/SECR": "KCS Onderbouw",
      FACILITAIR: "KCS Onderbouw",
      "FINANCE ADMINISTRATIE": "KCS Onderbouw",
      "DEPENDANCE ADMINISTRATIE": "KCS Onderbouw",
      SECRETARIAAT: "KCS Onderbouw",
      "ICT KANTOOR": "KCS Onderbouw",
      "CONFERENCE ROOM": "KCS Onderbouw",
      "KO-KANTOOR": "KCS Onderbouw",
      "FIN-MANAGER": "KCS Onderbouw",
      "BB-ADMIN": "KCS Onderbouw",
      "ICT STORAGE": "KCS Onderbouw",
      "KH ADMINISTRATIE": "KH",
      "KO ADMINISTRATIE": "KH",
      C1: "KH",
      "ICT CAMERA": "KH",
      "OD-KH": "KH",
      "KH-ADMIN": "KH",
      "KH DIRECTEUR OFFICE": "KH",
    };
    if (explicitParents[compact])
      return {
        value: value.trim().replace(/\s+/g, " "),
        parent: explicitParents[compact],
      };
    const group = compact.match(/^(?:GROEP\s*)?([1-8])\s*([A-D])$/);
    if (group)
      return {
        value: `Groep ${group[1]}${group[2]}`,
        parent: Number(group[1]) <= 6 ? "KCS Bovenbouw" : "KCS Onderbouw",
      };
    const room = compact.match(/^(?:LOK|LOKAAL)\s*0?([1-9]|1[0-5])$/);
    if (room) return { value: `LOK ${Number(room[1])}`, parent: "KH" };
    const cabin = compact.match(/^(?:CAB|CABIN)\s*([1-3])$/);
    if (cabin) return { value: `Cab ${cabin[1]}`, parent: "KH" };
    return undefined;
  };
  const groups = [
    "KCSL",
    "KCSMD",
    "KCSDESK",
    "KCSPW",
    "KCSRT",
    "KCSMOB",
    "TAB",
    "KCSMON",
    "KCSLT",
    "KCSAP",
    "KCSPR",
    "KCSSW",
    "KCSUPS",
    "KBW",
    "KBWS",
    "KBWC",
    "UPS",
    "PR",
    "MON",
    "KB",
    "MW",
    "MWS",
    "KHL",
    "KCSDB",
    "TL",
    "PRO",
    "FINAD",
  ];
  const allowed = new Set(groups);
  const approvedCategories = new Set([
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
  ]);
  referenceProposals(dryRun).forEach((proposal) => {
    if (
      proposal.kind === "category" &&
      approvedCategories.has(proposal.value.toUpperCase())
    )
      next.referenceDecisions[proposal.id] = {
        decision: "CREATE",
        value: proposal.value.toUpperCase(),
      };
    else if (proposal.kind === "location") {
      if (proposal.value.trim().toUpperCase() === "KH") {
        next.referenceDecisions[proposal.id] = {
          decision: "MAP_EXISTING",
          value: "KH",
        };
        return;
      }
      const target = locationTarget(proposal.value);
      if (target)
        next.referenceDecisions[proposal.id] = {
          decision: "CREATE",
          value: target.value,
          parent: target.parent,
        };
    } else if (
      proposal.kind === "codeGroup" &&
      allowed.has(proposal.value.toUpperCase())
    )
      next.referenceDecisions[proposal.id] = {
        decision: "CREATE",
        value: proposal.value.toUpperCase(),
      };
  });
  const additions = [
    { kind: "location" as const, value: "KCS Onderbouw" },
    { kind: "location" as const, value: "KCS Bovenbouw" },
    { kind: "location" as const, value: "KH" },
    ...groups.map((value) => ({
      kind: "codeGroup" as const,
      value,
      description:
        value === "MW"
          ? "Mouse wired"
          : value === "MWS"
            ? "Mouse wireless"
            : undefined,
    })),
  ];
  next.supplementalReferences = [
    ...new Map(
      [...next.supplementalReferences, ...additions].map((item) => [
        `${item.kind}:${item.value.toUpperCase()}`,
        item,
      ]),
    ).values(),
  ];
  return next;
}
export function recordDecision(
  manifest: ReviewManifest,
  decision: AuditDecision,
): ReviewManifest {
  return {
    ...manifest,
    audit: [
      ...manifest.audit.filter(
        (item) =>
          item.fingerprint !== decision.fingerprint ||
          item.type !== decision.type,
      ),
      decision,
    ],
  };
}
export function safeManifestText(manifest: ReviewManifest) {
  return JSON.stringify(manifest, (name, value) =>
    /password|wachtwoord/i.test(name) ? undefined : value,
  );
}
