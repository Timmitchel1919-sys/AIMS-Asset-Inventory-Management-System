import type { MockSnapshot } from "../data/contracts";
import type { MigrationDryRun, NormalizedLegacyAsset } from "./legacyMigration";
import {
  duplicateGroups,
  IMPORT_PARSER_SCHEMA_VERSION,
  referenceProposals,
  reviewBlockers,
  reviewCreatedAssets,
  type ReviewManifest,
} from "./importReview";

export type ImportPhase =
  | "parentLocations"
  | "subLocations"
  | "categories"
  | "codeGroups"
  | "assets"
  | "history"
  | "audit";
export interface ImportWrite {
  phase: ImportPhase;
  collection: string;
  documentId: string;
  mode: "create" | "upsert";
  fingerprint: string;
  data: Record<string, unknown>;
}
export interface FinalImportPlan {
  readonly version: 1;
  readonly importBatchId: string;
  readonly fileFingerprint: string;
  readonly parserSchemaVersion: number;
  readonly createdAt: string;
  readonly actor: string;
  readonly writes: readonly ImportWrite[];
  readonly skips: readonly { reason: string; source: string }[];
  readonly counts: Readonly<Record<ImportPhase, number>>;
  readonly reviewManifest: ReviewManifest;
}
const hash = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
};
const canonical = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
const safe = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(safe);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/password|wachtwoord|adminpass/i.test(key))
        .map(([key, item]) => [key, safe(item)]),
    );
  return value;
};
const freeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const write = (
  phase: ImportPhase,
  collection: string,
  documentId: string,
  data: Record<string, unknown>,
): ImportWrite => {
  const clean = safe(data) as Record<string, unknown>;
  return {
    phase,
    collection,
    documentId,
    mode: "upsert",
    fingerprint: hash(JSON.stringify(clean)),
    data: clean,
  };
};
const completeness = (asset: NormalizedLegacyAsset) =>
  Object.values(asset).filter(
    (value) => value !== undefined && value !== null && value !== "",
  ).length;
const audit = (actor: string, at: string) => ({
  createdAt: at,
  createdBy: actor,
  updatedAt: at,
  updatedBy: actor,
});
const assetDocument = (
  asset: NormalizedLegacyAsset,
  actor: string,
  at: string,
) => ({
  code: asset.code!,
  codePrefix: asset.codePrefix!,
  codeNumber: asset.codeNumber!,
  name: asset.name || asset.code!,
  category: asset.category || "Onbekend",
  type: asset.type || "Device",
  brand: asset.brand || "",
  model: asset.model || "",
  serialNumber: asset.serialNumber || "",
  location: asset.location || "",
  department: asset.department || "",
  ...(asset.assignedTo ? { assignedTo: asset.assignedTo } : {}),
  status: asset.assetStatus || "Available",
  condition: asset.condition || "Good",
  purchaseDate: asset.purchaseDate || "",
  warrantyExpiry: "",
  lastUpdated: at,
  qr: true,
  technicalSpecifications: asset.technicalSpecifications || {},
  ...(asset.remoteAccess ? { remoteAccess: asset.remoteAccess } : {}),
  ...audit(actor, at),
});

export function buildFinalImportPlan(args: {
  dryRun: MigrationDryRun;
  manifest: ReviewManifest;
  snapshot: MockSnapshot;
  actor: string;
  importBatchId: string;
  fileFingerprint: string;
  createdAt?: string;
}): FinalImportPlan {
  const { dryRun, manifest } = args;
  if (reviewBlockers(dryRun, manifest).total)
    throw new Error("Write plan geblokkeerd: er zijn nog reviewblokkades.");
  if (manifest.fileFingerprint !== args.fileFingerprint)
    throw new Error(
      "Bestandsfingerprint wijkt af van de beoordeelde bestanden.",
    );
  if (manifest.version !== IMPORT_PARSER_SCHEMA_VERSION)
    throw new Error("Parserschemaversie wijkt af van de reviewversie.");
  const writes: ImportWrite[] = [];
  const createdAt = args.createdAt || new Date().toISOString();
  const skips: Array<{ reason: string; source: string }> = [];
  const references = [
    ...referenceProposals(dryRun).flatMap((proposal) => {
      const decision = manifest.referenceDecisions[proposal.id];
      if (!decision || decision.decision === "SKIP") return [];
      return [
        {
          kind: proposal.kind,
          value: decision.value || proposal.value,
          parent: decision.parent,
        },
      ];
    }),
    ...manifest.supplementalReferences,
  ];
  const uniqueRefs = [
    ...new Map(
      references.map((item) => [`${item.kind}:${canonical(item.value)}`, item]),
    ).values(),
  ];
  const parents = uniqueRefs.filter(
      (item) => item.kind === "location" && !item.parent,
    ),
    children = uniqueRefs.filter(
      (item) => item.kind === "location" && item.parent,
    ),
    categories = uniqueRefs.filter((item) => item.kind === "category"),
    groups = uniqueRefs.filter((item) => item.kind === "codeGroup");
  parents.forEach((item) =>
    writes.push(
      write(
        "parentLocations",
        "locations",
        `location-${hash(canonical(item.value))}`,
        {
          kind: "location",
          name: item.value,
          isParent: true,
          ...audit(args.actor, createdAt),
        },
      ),
    ),
  );
  children.forEach((item) =>
    writes.push(
      write(
        "subLocations",
        "locations",
        `location-${hash(canonical(item.value))}`,
        {
          kind: "location",
          name: item.value,
          parentName: item.parent,
          ...audit(args.actor, createdAt),
        },
      ),
    ),
  );
  categories.forEach((item) =>
    writes.push(
      write(
        "categories",
        "categories",
        `category-${hash(canonical(item.value))}`,
        {
          kind: "category",
          name: item.value,
          ...audit(args.actor, createdAt),
        },
      ),
    ),
  );
  groups.forEach((item) =>
    writes.push(
      write(
        "codeGroups",
        "codeGroups",
        `code-group-${hash(canonical(item.value))}`,
        {
          prefix: item.value,
          name:
            ("description" in item ? item.description : undefined) ||
            item.value,
          minimumNumber: 1,
          maximumNumber: 5000,
          nextAvailableNumber: 1,
          isActive: true,
          sortOrder: 0,
          ...audit(args.actor, createdAt),
        },
      ),
    ),
  );
  const duplicateIds = new Set(
    duplicateGroups(dryRun).flatMap((group) =>
      group.assets.map((asset) => asset.fingerprint),
    ),
  );
  const selected: NormalizedLegacyAsset[] = [];
  duplicateGroups(dryRun).forEach((group) => {
    const decision = manifest.duplicateDecisions[group.id];
    if (decision?.decision === "SKIP") {
      skips.push({ reason: "Duplicaatgroep overgeslagen", source: group.id });
      return;
    }
    selected.push(
      [...group.assets].sort((a, b) => completeness(b) - completeness(a))[0],
    );
  });
  dryRun.assets
    .filter(
      (asset) =>
        !duplicateIds.has(asset.fingerprint) && asset.status !== "ERROR",
    )
    .forEach((asset) => selected.push(asset));
  const assetsByCode = new Map<string, NormalizedLegacyAsset>();
  selected
    .filter((asset) => asset.code)
    .forEach((asset) => assetsByCode.set(asset.code!, asset));
  const assetDocumentIds = new Map<string, string>();
  assetsByCode.forEach((asset) => {
    assetDocumentIds.set(canonical(asset.code!), asset.id);
    writes.push(
      write(
        "assets",
        "assets",
        asset.id,
        assetDocument(asset, args.actor, createdAt),
      ),
    );
  });
  reviewCreatedAssets(manifest).forEach((asset) => {
    const parsed = asset.assetCode
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .match(/^([A-Z]+)(\d+)$/);
    if (!parsed)
      throw new Error(`Nieuwe assetcode is ongeldig: ${asset.assetCode}`);
    const documentId = `legacy-${hash(asset.assetCode)}`;
    assetDocumentIds.set(canonical(asset.assetCode), documentId);
    writes.push(
      write("assets", "assets", documentId, {
        code: asset.assetCode,
        codePrefix: parsed[1],
        codeNumber: Number(parsed[2]),
        name: asset.name,
        category: asset.category,
        type: "Device",
        brand: "",
        model: "",
        serialNumber: "",
        location: "",
        department: "",
        status: "Available",
        condition: "Good",
        purchaseDate: "",
        warrantyExpiry: "",
        lastUpdated: createdAt,
        qr: true,
        ...audit(args.actor, createdAt),
      }),
    );
  });
  const existingEvents = new Map(
    dryRun.historyEvents.map((event) => [event.sourceRecordId, event]),
  );
  dryRun.historyReview.forEach((item) => {
    const historyDecision = manifest.historyDecisions[item.fingerprint];
    if (
      historyDecision?.decision === "SKIPPED_BY_USER" ||
      historyDecision?.decision === "NOT_AN_EVENT"
    ) {
      skips.push({
        reason: historyDecision.decision,
        source: `${item.sourceSheet}:${item.sourceRow}`,
      });
      return;
    }
    const assetCode = historyDecision?.assetCode || item.assetCode;
    if (!assetCode) {
      skips.push({
        reason: "Geen definitieve assetkoppeling",
        source: `${item.sourceSheet}:${item.sourceRow}`,
      });
      return;
    }
    const dateDecision = manifest.dateDecisions[item.fingerprint];
    const occurredAt = dateDecision?.date || item.proposedDate;
    if (!occurredAt) {
      skips.push({
        reason: "Geen definitieve datum",
        source: `${item.sourceSheet}:${item.sourceRow}`,
      });
      return;
    }
    const sourceId = `${item.sourceFile}:${item.sourceSheet}:${item.sourceRow}`;
    const existing = existingEvents.get(sourceId);
    const id =
      existing?.id ||
      `legacy-event-${hash(`${assetCode}|${occurredAt}|${item.eventText}|${sourceId}`)}`;
    const existingFields = existing
      ? Object.fromEntries(
          Object.entries(existing).filter(
            ([key]) =>
              ![
                "id",
                "createdAt",
                "createdBy",
                "updatedAt",
                "updatedBy",
              ].includes(key),
          ),
        )
      : {};
    writes.push(
      write("history", "assetHistoryEvents", id, {
        ...existingFields,
        assetCode,
        assetId:
          assetDocumentIds.get(canonical(assetCode)) ||
          item.assetId ||
          `legacy-${hash(assetCode)}`,
        occurredAt,
        description: existing?.description || item.eventText,
        sourceRecordId: sourceId,
        source: "legacy_import",
        isLegacyImport: true,
        importBatchId: args.importBatchId,
        eventType: existing?.eventType || "Legacy import",
        category: existing?.category || "Legacy",
        title: existing?.title || "Legacy History-gebeurtenis",
        sourceModule: existing?.sourceModule || "combined_excel_import",
        isManual: false,
        status: "Final",
        version: existing?.version || 1,
        fingerprint: item.fingerprint,
        ...audit(args.actor, createdAt),
      }),
    );
  });
  writes.push(
    write("audit", "migrationAudits", args.importBatchId, {
      importBatchId: args.importBatchId,
      fileFingerprint: args.fileFingerprint,
      parserSchemaVersion: IMPORT_PARSER_SCHEMA_VERSION,
      actor: args.actor,
      createdAt,
      writeCount: writes.length,
      excludedSensitiveFields: dryRun.excludedSensitiveFields,
    }),
  );
  const counts = Object.fromEntries(
    (
      [
        "parentLocations",
        "subLocations",
        "categories",
        "codeGroups",
        "assets",
        "history",
        "audit",
      ] as ImportPhase[]
    ).map((phase) => [
      phase,
      writes.filter((item) => item.phase === phase).length,
    ]),
  ) as Record<ImportPhase, number>;
  return freeze({
    version: 1,
    importBatchId: args.importBatchId,
    fileFingerprint: args.fileFingerprint,
    parserSchemaVersion: IMPORT_PARSER_SCHEMA_VERSION,
    createdAt,
    actor: args.actor,
    writes,
    skips,
    counts,
    reviewManifest: safe(manifest) as ReviewManifest,
  });
}

export function createImportBackup(
  snapshot: MockSnapshot,
  plan: FinalImportPlan,
) {
  return freeze({
    version: 1,
    createdAt: new Date().toISOString(),
    importBatchId: plan.importBatchId,
    collections: {
      references: snapshot.references,
      codeGroups: snapshot.codeGroups,
      assets: snapshot.assets,
      assetHistoryEvents: snapshot.assetHistoryEvents,
    },
    plannedDocumentIds: plan.writes.map(
      (item) => `${item.collection}/${item.documentId}`,
    ),
  });
}
export function backupDownload(plan: FinalImportPlan, snapshot: MockSnapshot) {
  const backup = createImportBackup(snapshot, plan);
  return {
    filename: `AIMS-backup-${plan.importBatchId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    text: JSON.stringify(backup, null, 2),
  };
}

export interface ImportWriteAdapter {
  isIdentical(write: ImportWrite): Promise<boolean>;
  writeBatch(writes: readonly ImportWrite[]): Promise<void>;
}
export interface ImportCheckpoint {
  batchIndex: number;
  completed: number;
  skipped: number;
  failed: number;
  lastSafeCheckpoint: number;
  status: "COMPLETE" | "FAILED";
  error?: string;
}
const activeBatches = new Set<string>();
export async function executeFinalImportPlan(
  plan: FinalImportPlan,
  adapter: ImportWriteAdapter,
  options: {
    batchSize?: number;
    resumeAfterBatch?: number;
    onProgress?: (value: ImportCheckpoint) => void;
  } = {},
): Promise<ImportCheckpoint> {
  if (activeBatches.has(plan.importBatchId))
    throw new Error("Deze importbatch wordt al uitgevoerd.");
  activeBatches.add(plan.importBatchId);
  let completed = 0,
    skipped = 0;
  const size = Math.min(options.batchSize || 400, 450),
    batches = [] as ImportWrite[][];
  try {
    const pending = [] as ImportWrite[];
    for (const item of plan.writes) {
      if (await adapter.isIdentical(item)) skipped++;
      else pending.push(item);
    }
    for (let i = 0; i < pending.length; i += size)
      batches.push(pending.slice(i, i + size));
    for (
      let index = options.resumeAfterBatch || 0;
      index < batches.length;
      index++
    ) {
      try {
        await adapter.writeBatch(batches[index]);
        completed += batches[index].length;
        options.onProgress?.({
          batchIndex: index + 1,
          completed,
          skipped,
          failed: 0,
          lastSafeCheckpoint: index + 1,
          status: "COMPLETE",
        });
      } catch (error) {
        const result = {
          batchIndex: index + 1,
          completed,
          skipped,
          failed: batches[index].length,
          lastSafeCheckpoint: index,
          status: "FAILED" as const,
          error: error instanceof Error ? error.message : String(error),
        };
        options.onProgress?.(result);
        return result;
      }
    }
    return {
      batchIndex: batches.length,
      completed,
      skipped,
      failed: 0,
      lastSafeCheckpoint: batches.length,
      status: "COMPLETE",
    };
  } finally {
    activeBatches.delete(plan.importBatchId);
  }
}

export function validateProductionGate(args: {
  blockers: number;
  fingerprintsMatch: boolean;
  schemaMatches: boolean;
  isAdministrator: boolean;
  confirmed: boolean;
  typedConfirmation: string;
  backupReady: boolean;
  previewViewed: boolean;
  referencesFresh: boolean;
}) {
  const failed = Object.entries({
    ...args,
    typedConfirmation: args.typedConfirmation === "IMPORTEREN",
  })
    .filter(([, value]) => value !== true && value !== 0)
    .map(([key]) => key);
  return { allowed: failed.length === 0 && args.blockers === 0, failed };
}
