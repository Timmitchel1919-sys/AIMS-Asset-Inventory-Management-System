import { ArrowLeft, FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "../components/ui";
import {
  MutationFeedback,
  OfflineGate,
  PageHeader,
} from "../components/WorkflowUi";
import { useApp } from "../context/AppContext";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { firebaseAuth, firestore } from "../lib/firebase";
import {
  parseSelectedWorkbooks,
  type CombinedWorkbookSource,
} from "../migration/combinedWorkbookImport";
import {
  dryRunLegacyMigration,
  type MigrationDryRun,
} from "../migration/legacyMigration";
import {
  applyWorksheetDecision,
  applyApprovedBulkResolutions,
  applyApprovedReferenceStructure,
  clearReviewManifest,
  duplicateGroups,
  IMPORT_PARSER_SCHEMA_VERSION,
  loadReviewManifest,
  newReviewManifest,
  recordDecision,
  referenceProposals,
  reviewCreatedAssets,
  reviewBlockers,
  saveReviewManifest,
  selectedWorkbooksFingerprint,
  type ReviewManifest,
} from "../migration/importReview";
import {
  backupDownload,
  buildFinalImportPlan,
  executeFinalImportPlan,
  validateProductionGate,
  type FinalImportPlan,
  type ImportCheckpoint,
} from "../migration/finalImportPlan";
import { createFirestoreImportAdapter } from "../migration/firebaseImportWriter";

const stages = [
  "Bestanden selecteren",
  "Excel analyseren",
  "Normaliseren",
  "Valideren",
  "Review en correcties",
  "Bevestigen",
  "Import uitvoeren",
  "Eindrapport",
];
const tabs = [
  "Samenvatting",
  "Assets",
  "Duplicaten",
  "History-koppelingen",
  "Datumconflicten",
  "Categorieën en locaties",
  "Definitieve wijzigingen",
] as const;
type Tab = (typeof tabs)[number];
const gateLabels: Record<string, string> = {
  blockers: "Alle inhoudelijke blokkades oplossen",
  fingerprintsMatch: "De beoordeelde bestanden opnieuw analyseren",
  schemaMatches: "Review opnieuw uitvoeren met de actuele parser",
  isAdministrator: "Aanmelden met de rol administrator",
  confirmed: "Het bevestigingsvak aanvinken",
  typedConfirmation: "Exact IMPORTEREN typen",
  backupReady: "De verplichte JSON-backup downloaden",
  previewViewed: "Het definitieve write plan openklappen en bekijken",
  referencesFresh: "De actuele referenties opnieuw controleren",
};

export default function CombinedAssetImport() {
  const navigate = useNavigate(),
    repository = useRepository(),
    snapshot = useMockSnapshot(),
    app = useApp();
  const [files, setFiles] = useState<Array<File | undefined>>([
      undefined,
      undefined,
      undefined,
      undefined,
    ]),
    [source, setSource] = useState<CombinedWorkbookSource>(),
    [dryRun, setDryRun] = useState<MigrationDryRun>();
  const [manifest, setManifest] = useState<ReviewManifest>(() =>
      newReviewManifest("pending"),
    ),
    [tab, setTab] = useState<Tab>("Samenvatting"),
    [query, setQuery] = useState("");
  const [confirmed, setConfirmed] = useState(false),
    [stage, setStage] = useState(1),
    [feedback, setFeedback] = useState<{
      status: "idle" | "loading" | "success" | "error";
      message: string;
    }>({ status: "idle", message: "" });
  const [analyzedAt, setAnalyzedAt] = useState<string>();
  const [writePlan, setWritePlan] = useState<FinalImportPlan>(),
    [typedConfirmation, setTypedConfirmation] = useState(""),
    [backupReady, setBackupReady] = useState(false),
    [previewViewed, setPreviewViewed] = useState(false),
    [checkpoint, setCheckpoint] = useState<ImportCheckpoint>(),
    [importStartedAt, setImportStartedAt] = useState<string>(),
    [importFinishedAt, setImportFinishedAt] = useState<string>();
  const blockers = useMemo(
    () => (dryRun ? reviewBlockers(dryRun, manifest) : undefined),
    [dryRun, manifest],
  );
  const productionGate = validateProductionGate({
    blockers: blockers?.total ?? 1,
    fingerprintsMatch:
      !!writePlan && writePlan.fileFingerprint === manifest.fileFingerprint,
    schemaMatches: manifest.version === IMPORT_PARSER_SCHEMA_VERSION,
    isAdministrator: app.user?.role === "administrator",
    confirmed,
    typedConfirmation,
    backupReady,
    previewViewed,
    referencesFresh: !!writePlan,
  });
  const duplicates = dryRun ? duplicateGroups(dryRun) : [],
    references = dryRun ? referenceProposals(dryRun) : [];
  const historySheets = dryRun
    ? [
        ...new Set(
          dryRun.historyReview
            .filter(
              (item) =>
                item.status === "UNMATCHED_HISTORY" ||
                item.status === "AMBIGUOUS_HISTORY",
            )
            .map((item) => item.sourceSheet),
        ),
      ]
    : [];
  const matches = (...values: unknown[]) =>
    !query ||
    values.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  useEffect(() => {
    if (dryRun && manifest.fileFingerprint !== "pending")
      saveReviewManifest(localStorage, manifest);
  }, [dryRun, manifest]);
  const decide = (next: ReviewManifest) =>
    setManifest(
      recordDecision(next, {
        type: "REVIEW_DECISION",
        sourceFile: "combined",
        sourceSheet: tab,
        sourceRow: 0,
        originalValue: "",
        normalizedValue: "",
        user: app.user?.name || "unknown",
        timestamp: new Date().toISOString(),
        reason: "Expliciete gebruikersbeslissing",
        fingerprint: `${tab}:${next.audit.length}`,
      }),
    );
  async function analyze() {
    const selected = files.filter((file): file is File => Boolean(file));
    if (!selected.length)
      return setFeedback({
        status: "error",
        message: "Selecteer minimaal één Excelbestand.",
      });
    setDryRun(undefined);
    setSource(undefined);
    setConfirmed(false);
    setStage(2);
    setFeedback({
      status: "loading",
      message: "Gekozen Excelbestand(en) analyseren…",
    });
    try {
      const parsed = await parseSelectedWorkbooks(selected);
      setStage(3);
      setSource(parsed);
      await Promise.resolve();
      const importBatchId = `aims-${Date.now().toString(36)}`;
      const result = dryRunLegacyMigration({
        masterRows: parsed.master.rows,
        historyRows: parsed.history.rows,
        existingAssets: snapshot.assets,
        references: snapshot.references,
        codeGroups: snapshot.codeGroups,
        importBatchId,
      });
      setStage(4);
      result.excludedSensitiveFields =
        parsed.master.excludedSensitiveFields +
        parsed.history.excludedSensitiveFields;
      const loadedManifest = loadReviewManifest(
        localStorage,
        selectedWorkbooksFingerprint(selected),
      );
      const resolvedManifest = applyApprovedBulkResolutions(
        result,
        loadedManifest,
        {
          defaultDate: "2024-01-01",
          createAssetsBySheet: {
            KCSDB15: {
              assetCode: "KCSDB-15",
              name: "Digibord KCSDB15",
              category: "DIGIBORD",
            },
            "KYOCERA ECOSYS - ADMIN": {
              assetCode: "PR-10",
              name: "KYOCERA ECOSYS - ADMIN",
              category: "PRINTERSCANNER",
            },
          },
        },
      );
      setManifest(applyApprovedReferenceStructure(result, resolvedManifest));
      const finalManifest = applyApprovedReferenceStructure(
        result,
        resolvedManifest,
      );
      setWritePlan(
        buildFinalImportPlan({
          dryRun: result,
          manifest: finalManifest,
          snapshot,
          actor: app.user?.name || "unknown",
          importBatchId,
          fileFingerprint: selectedWorkbooksFingerprint(selected),
        }),
      );
      setBackupReady(false);
      setPreviewViewed(false);
      setTypedConfirmation("");
      setDryRun(result);
      setAnalyzedAt(new Date().toISOString());
      setConfirmed(false);
      setStage(5);
      setTab("Samenvatting");
      setFeedback({
        status: "success",
        message: `Analyse voltooid voor ${selected.length} bestand(en): ${result.assets.length} assets en ${result.historyReview.length} History-regels.`,
      });
    } catch (error) {
      setStage(1);
      setFeedback({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  function resetLocalReview() {
    const selected = files.filter((file): file is File => Boolean(file));
    const fingerprint = selectedWorkbooksFingerprint(selected);
    clearReviewManifest(localStorage, fingerprint);
    setManifest(newReviewManifest(fingerprint));
    setDryRun(undefined);
    setSource(undefined);
    setAnalyzedAt(undefined);
    setWritePlan(undefined);
    setBackupReady(false);
    setPreviewViewed(false);
    setTypedConfirmation("");
    setConfirmed(false);
    setStage(1);
    setFeedback({
      status: "success",
      message:
        "Lokale dry-run en niet-geïmporteerde reviewstatus zijn gewist. Firebase is niet gewijzigd.",
    });
  }
  function downloadBackup() {
    if (!writePlan) return;
    const backup = backupDownload(writePlan, repository.snapshot());
    const url = URL.createObjectURL(
      new Blob([backup.text], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = backup.filename;
    link.click();
    URL.revokeObjectURL(url);
    setBackupReady(true);
  }
  async function commit() {
    if (
      !dryRun ||
      !source ||
      !blockers ||
      !productionGate.allowed ||
      !writePlan
    )
      return;
    setStage(7);
    const current = repository.snapshot(),
      fresh = dryRunLegacyMigration({
        masterRows: source.master.rows,
        historyRows: source.history.rows,
        existingAssets: current.assets,
        references: current.references,
        codeGroups: current.codeGroups,
        importBatchId: `aims-${Date.now().toString(36)}`,
      });
    if (
      referenceProposals(fresh).some(
        (item) => !manifest.referenceDecisions[item.id],
      )
    ) {
      setStage(5);
      return setFeedback({
        status: "error",
        message:
          "Referentiegegevens zijn gewijzigd. Analyseer opnieuw en keur de actuele voorstellen goed.",
      });
    }
    const actorUid = firebaseAuth?.currentUser?.uid;
    if (!firestore || !actorUid) {
      setStage(6);
      return setFeedback({
        status: "error",
        message: "Firebase of de aangemelde beheerder is niet beschikbaar.",
      });
    }
    setImportStartedAt(new Date().toISOString());
    setFeedback({
      status: "loading",
      message: "Definitieve import wordt veilig uitgevoerd…",
    });
    const result = await executeFinalImportPlan(
      writePlan,
      createFirestoreImportAdapter(firestore, actorUid),
      { batchSize: 400, onProgress: setCheckpoint },
    );
    setCheckpoint(result);
    setImportFinishedAt(new Date().toISOString());
    setStage(result.status === "COMPLETE" ? 8 : 7);
    setFeedback({
      status: result.status === "COMPLETE" ? "success" : "error",
      message:
        result.status === "COMPLETE"
          ? `Import voltooid: ${result.completed} writes en ${result.skipped} idempotente skips.`
          : `Import gestopt na checkpoint ${result.lastSafeCheckpoint}: ${result.error}`,
    });
  }
  function downloadFinalReport() {
    if (!writePlan || !checkpoint) return;
    const report = {
      importBatchId: writePlan.importBatchId,
      fileFingerprint: writePlan.fileFingerprint,
      parserSchemaVersion: writePlan.parserSchemaVersion,
      actor: writePlan.actor,
      startedAt: importStartedAt,
      finishedAt: importFinishedAt,
      planned: writePlan.counts,
      result: checkpoint,
      excludedSensitiveFields: dryRun?.excludedSensitiveFields || 0,
      documentIds: writePlan.writes.map(
        (item) => `${item.collection}/${item.documentId}`,
      ),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `AIMS-import-rapport-${writePlan.importBatchId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <OfflineGate>
      <div className="page asset-import-page">
        <button className="back" onClick={() => navigate("/assets")}>
          <ArrowLeft />
          Terug
        </button>
        <PageHeader
          title="Middelen importeren"
          description="Master Data en History Log analyseren, uitzonderingen beoordelen en pas daarna importeren."
        />
        <div className="import-steps" aria-label="Importfasen">
          {stages.map((label, index) => (
            <span className={stage >= index + 1 ? "active" : ""} key={label}>
              {index + 1}. {label}
            </span>
          ))}
        </div>
        <Card>
          <div className="combined-import-files">
            {files.map((file, index) => (
              <label className="field" key={index}>
                <span>Bestand {index + 1}</span>
                <input
                  type="file"
                  aria-label={`Bestand ${index + 1}`}
                  accept=".xlsx"
                  onChange={(e) => {
                    const next = [...files];
                    next[index] = e.target.files?.[0];
                    setFiles(next);
                    setDryRun(undefined);
                    setSource(undefined);
                    setConfirmed(false);
                    setStage(next.some(Boolean) ? 1 : 0);
                  }}
                />
                <small>{file?.name || "Geen bestand gekozen"}</small>
              </label>
            ))}
          </div>
          <p className="muted">
            Kies één tot vier Excelbestanden. AIMS herkent middelen- en
            History-gegevens per bestand; de analyse schrijft niets naar
            Firebase.
          </p>
          <div className="migration-file-actions">
            <Button onClick={analyze} disabled={!files.some(Boolean)}>
              <Upload />
              Bestand analyseren
            </Button>
            <Button
              variant="secondary"
              onClick={resetLocalReview}
              disabled={!files.some(Boolean)}
            >
              Dry-run en lokale reviewstatus opnieuw instellen
            </Button>
          </div>
          <MutationFeedback {...feedback} />
        </Card>
        {dryRun && source && blockers ? (
          <>
            <div className="status-summary migration-counts">
              {[
                [dryRun.assets.length, "Master-assets"],
                [
                  new Set(dryRun.assets.map((a) => a.code).filter(Boolean))
                    .size,
                  "Unieke assetcodes",
                ],
                [
                  dryRun.assetsWithoutLegacyHistory.length,
                  "Zonder legacy-history",
                ],
                [dryRun.historyReview.length, "History-gebeurtenissen"],
                [
                  dryRun.historyReview.filter((h) => h.importStatus === "READY")
                    .length,
                  "Direct importeerbaar",
                ],
                [
                  dryRun.historyReview.filter((h) =>
                    h.matchStatus.startsWith("AUTO_"),
                  ).length,
                  "Automatisch gekoppeld",
                ],
                [
                  dryRun.historyReview.filter(
                    (h) => h.status === "UNMATCHED_HISTORY",
                  ).length,
                  "Unmatched",
                ],
                [
                  dryRun.historyReview.filter(
                    (h) => h.status === "AMBIGUOUS_HISTORY",
                  ).length,
                  "Ambiguous",
                ],
                [
                  dryRun.issues.filter((issue) => issue.type === "INVALID_DATE")
                    .length,
                  "Datumconflicten",
                ],
                [duplicates.length, "Unieke duplicaatgroepen"],
                [
                  new Set(dryRun.assets.map((a) => a.category).filter(Boolean))
                    .size,
                  "Unieke categorieën",
                ],
                [
                  new Set(dryRun.assets.map((a) => a.location).filter(Boolean))
                    .size,
                  "Unieke locaties",
                ],
                [
                  new Set(
                    dryRun.assets.map((a) => a.codePrefix).filter(Boolean),
                  ).size,
                  "Unieke codegroepen",
                ],
                [dryRun.excludedSensitiveFields, "Gevoelige velden verwijderd"],
              ].map(([value, label]) => (
                <Card key={String(label)}>
                  <b>{value}</b>
                  <small>{label}</small>
                </Card>
              ))}
            </div>
            <Card>
              <div
                className="migration-review-toolbar"
                role="tablist"
                aria-label="Migratiereview"
              >
                {tabs.map((item) => (
                  <button
                    role="tab"
                    aria-selected={tab === item}
                    className={tab === item ? "active" : ""}
                    key={item}
                    onClick={() => {
                      setTab(item);
                      setStage(item === "Definitieve wijzigingen" ? 6 : 5);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <label className="field migration-search">
                <span>Zoeken in deze stap</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Code, werkblad, locatie…"
                />
              </label>
              {tab === "Samenvatting" ? (
                <div className="import-source-summary">
                  <span>
                    Master: {source.master.sheets.length} werkbladen /{" "}
                    {source.master.rows.length} regels
                  </span>
                  <span>
                    History: {source.history.sheets.length} werkbladen /{" "}
                    {source.history.rows.length} regels
                  </span>
                  <span>
                    Status:{" "}
                    <b>
                      {blockers.total
                        ? "NOT READY"
                        : productionGate.allowed
                          ? "READY FOR IMPORT"
                          : "READY FOR FINAL CHECKS"}
                    </b>
                  </span>
                  <span>Resterende blokkades: {blockers.total}</span>
                  <span>Lokale auditbeslissingen: {manifest.audit.length}</span>
                  <span>
                    Goedgekeurde nieuwe assets:{" "}
                    {reviewCreatedAssets(manifest)
                      .map((asset) => asset.assetCode)
                      .join(", ") || "—"}
                  </span>
                  <span>
                    Aanvullende goedgekeurde referenties:{" "}
                    {manifest.supplementalReferences.length}
                  </span>
                  <span>
                    Gevoelige labels Master:{" "}
                    {
                      new Set(
                        source.master.sensitiveFields.map((item) =>
                          item.label.toLowerCase(),
                        ),
                      ).size
                    }
                  </span>
                  <span>
                    Niet-lege gevoelige waarden Master:{" "}
                    {
                      source.master.sensitiveFields.filter(
                        (item) => item.nonEmpty,
                      ).length
                    }
                  </span>
                  <span>
                    Gevoelige labels History:{" "}
                    {
                      new Set(
                        source.history.sensitiveFields.map((item) =>
                          item.label.toLowerCase(),
                        ),
                      ).size
                    }
                  </span>
                  <span>
                    Niet-lege gevoelige waarden History:{" "}
                    {
                      source.history.sensitiveFields.filter(
                        (item) => item.nonEmpty,
                      ).length
                    }
                  </span>
                  <span>Applicatiebuild: {import.meta.env.MODE}</span>
                  <span>
                    Parserschemaversie: {IMPORT_PARSER_SCHEMA_VERSION}
                  </span>
                  <span>Bestandsfingerprints: {manifest.fileFingerprint}</span>
                  <span>
                    Analysetijdstip:{" "}
                    {analyzedAt ? app.formatDateTime(analyzedAt) : "—"}
                  </span>
                </div>
              ) : null}
              {tab === "Assets" ? (
                <div className="table-scroll migration-assets-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Inv.code</th>
                        <th>Werkblad / rij</th>
                        <th>Merk/model</th>
                        <th>Serienummer</th>
                        <th>Locatie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dryRun.assets
                        .filter((a) =>
                          matches(
                            a.code,
                            a.sourceSheet,
                            a.serialNumber,
                            a.location,
                          ),
                        )
                        .map((a) => (
                          <tr key={a.fingerprint}>
                            <td>
                              <span
                                className={`badge ${a.status === "DUPLICATE" ? "badge-danger" : "badge-success"}`}
                              >
                                {dryRun.assetsWithoutLegacyHistory.includes(
                                  a.code || "",
                                )
                                  ? "ASSET_WITHOUT_LEGACY_HISTORY"
                                  : a.status}
                              </span>
                            </td>
                            <td>{a.code || "—"}</td>
                            <td>
                              {a.sourceSheet} / {a.sourceRow}
                            </td>
                            <td>
                              {a.brand} {a.model}
                            </td>
                            <td>{a.serialNumber || "—"}</td>
                            <td>{a.location || "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {tab === "Duplicaten" ? (
                <ReviewList>
                  {duplicates
                    .filter((g) => matches(g.assets[0]?.code, g.reason))
                    .map((g) => {
                      const choice =
                        manifest.duplicateDecisions[g.id]?.decision;
                      return (
                        <ReviewItem
                          key={g.id}
                          title={g.assets[0]?.code || "Onbekende code"}
                          status={choice || "ONBEOORDEELD"}
                          resolved={!!choice}
                        >
                          <p>{g.reason}</p>
                          <p>
                            {g.assets[0]?.sourceFile} ·{" "}
                            {g.assets[0]?.sourceSheet} · rij{" "}
                            {g.assets[0]?.sourceRow}
                          </p>
                          <div className="form-actions">
                            {(
                              [
                                ["MERGE", "Samenvoegen"],
                                ["UPDATE_EXISTING", "Bestaande bijwerken"],
                                ["USE_MASTER", "Master gebruiken"],
                                ["SKIP", "Overslaan"],
                                ["DIFFERENT_ASSET", "Verschillende assets"],
                              ] as const
                            ).map(([decision, label]) => (
                              <Button
                                key={decision}
                                variant="secondary"
                                onClick={() =>
                                  decide({
                                    ...manifest,
                                    duplicateDecisions: {
                                      ...manifest.duplicateDecisions,
                                      [g.id]: { decision },
                                    },
                                  })
                                }
                              >
                                {label}
                              </Button>
                            ))}
                          </div>
                        </ReviewItem>
                      );
                    })}
                </ReviewList>
              ) : null}
              {tab === "History-koppelingen" ? (
                <ReviewList>
                  {historySheets.filter(matches).map((sheet) => {
                    const rows = dryRun.historyReview.filter(
                        (i) =>
                          i.sourceSheet === sheet &&
                          (i.status === "UNMATCHED_HISTORY" ||
                            i.status === "AMBIGUOUS_HISTORY"),
                      ),
                      resolved = rows.every(
                        (i) => manifest.historyDecisions[i.fingerprint],
                      );
                    return (
                      <ReviewItem
                        key={sheet}
                        title={sheet}
                        status={`${rows.length} gebeurtenissen · ${resolved ? "OPGELOST" : "REVIEW NODIG"}`}
                        resolved={resolved}
                      >
                        <p>
                          Ruwe code: {rows[0]?.rawCode || "—"} · genormaliseerd:{" "}
                          {rows[0]?.normalizedCode || "—"}
                        </p>
                        <div className="form-actions">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const code = prompt(
                                "Assetcode voor het volledige werkblad:",
                                rows[0]?.normalizedCode,
                              );
                              if (code)
                                decide(
                                  applyWorksheetDecision(
                                    manifest,
                                    dryRun,
                                    sheet,
                                    {
                                      decision: "USER_MATCHED_WORKSHEET",
                                      assetCode: code,
                                      reason: "Handmatig gekoppeld",
                                    },
                                  ),
                                );
                            }}
                          >
                            Werkblad koppelen
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              decide(
                                applyWorksheetDecision(
                                  manifest,
                                  dryRun,
                                  sheet,
                                  {
                                    decision: "SKIPPED_BY_USER",
                                    reason: "Expliciet overgeslagen",
                                  },
                                ),
                              )
                            }
                          >
                            Werkblad overslaan
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              decide(
                                applyWorksheetDecision(
                                  manifest,
                                  dryRun,
                                  sheet,
                                  {
                                    decision: "NOT_AN_EVENT",
                                    reason: "Geen gebeurtenissen",
                                  },
                                ),
                              )
                            }
                          >
                            NOT_AN_EVENT
                          </Button>
                        </div>
                      </ReviewItem>
                    );
                  })}
                </ReviewList>
              ) : null}
              {tab === "Datumconflicten" ? (
                <ReviewList>
                  {dryRun.historyReview
                    .filter(
                      (i) =>
                        i.dateStatus !== "VALID_DATE" &&
                        matches(i.sourceSheet, i.rawDate, i.assetCode),
                    )
                    .map((i) => {
                      const choice = manifest.dateDecisions[i.fingerprint];
                      return (
                        <ReviewItem
                          key={i.fingerprint}
                          title={`${i.sourceSheet} · rij ${i.sourceRow}`}
                          status={choice?.decision || "ONBEOORDEELD"}
                          resolved={!!choice}
                        >
                          <p>
                            {i.assetCode || i.normalizedCode || "—"} · datum:{" "}
                            <code>{i.rawDate || "leeg"}</code> · {i.eventText}
                          </p>
                          <div className="form-actions">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                const date = prompt(
                                  "Volledige datum (jjjj-mm-dd):",
                                  i.proposedDate?.slice(0, 10) || "",
                                );
                                if (date && /^\d{4}-\d{2}-\d{2}$/.test(date))
                                  decide({
                                    ...manifest,
                                    dateDecisions: {
                                      ...manifest.dateDecisions,
                                      [i.fingerprint]: {
                                        decision: "CORRECTED",
                                        date: new Date(
                                          `${date}T00:00:00.000Z`,
                                        ).toISOString(),
                                        reason: "Handmatig gecorrigeerd",
                                      },
                                    },
                                  });
                              }}
                            >
                              {i.dateStatus === "TYPO_CONFIRMATION_REQUIRED"
                                ? "Voorstel bevestigen"
                                : "Datum corrigeren"}
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                decide({
                                  ...manifest,
                                  dateDecisions: {
                                    ...manifest.dateDecisions,
                                    [i.fingerprint]: {
                                      decision: "SKIPPED_BY_USER",
                                      reason: "Onvolledige datum overgeslagen",
                                    },
                                  },
                                })
                              }
                            >
                              Gebeurtenis overslaan
                            </Button>
                          </div>
                        </ReviewItem>
                      );
                    })}
                </ReviewList>
              ) : null}
              {tab === "Categorieën en locaties" ? (
                <ReviewList>
                  {references
                    .filter((i) =>
                      matches(i.value, i.kind, i.sourceSheets.join(" ")),
                    )
                    .map((i) => {
                      const choice = manifest.referenceDecisions[i.id];
                      return (
                        <ReviewItem
                          key={i.id}
                          title={`${i.kind}: ${i.value}`}
                          status={choice?.decision || "GOEDKEURING NODIG"}
                          resolved={!!choice}
                        >
                          <p>
                            Genormaliseerd: {i.normalized} · {i.count} assets ·{" "}
                            {i.sourceSheets.join(", ") || "geen bronwerkblad"}
                          </p>
                          {i.suspicious ? (
                            <p className="text-danger">
                              Mogelijke assetcode in locatie; aanmaken is
                              geblokkeerd.
                            </p>
                          ) : null}
                          <div className="form-actions">
                            <Button
                              variant="secondary"
                              disabled={i.suspicious}
                              onClick={() =>
                                decide({
                                  ...manifest,
                                  referenceDecisions: {
                                    ...manifest.referenceDecisions,
                                    [i.id]: {
                                      decision: "CREATE",
                                      value: i.value,
                                    },
                                  },
                                })
                              }
                            >
                              Nieuwe referentie goedkeuren
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                const value = prompt(
                                  "Bestaande of vervangende waarde:",
                                  i.value,
                                );
                                if (value)
                                  decide({
                                    ...manifest,
                                    referenceDecisions: {
                                      ...manifest.referenceDecisions,
                                      [i.id]: {
                                        decision: "MAP_EXISTING",
                                        value,
                                      },
                                    },
                                  });
                              }}
                            >
                              Koppelen / hernoemen
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                decide({
                                  ...manifest,
                                  referenceDecisions: {
                                    ...manifest.referenceDecisions,
                                    [i.id]: { decision: "SKIP" },
                                  },
                                })
                              }
                            >
                              Records overslaan
                            </Button>
                          </div>
                        </ReviewItem>
                      );
                    })}
                </ReviewList>
              ) : null}
              {tab === "Definitieve wijzigingen" ? (
                <>
                  <div className="import-source-summary">
                    <span>
                      Asset creates:{" "}
                      {
                        dryRun.assets.filter(
                          (a) =>
                            a.status === "VALID" ||
                            a.status === "VALID_WITH_WARNING",
                        ).length
                      }
                    </span>
                    <span>History creates: {dryRun.historyEvents.length}</span>
                    <span>
                      Assets zonder legacy-history:{" "}
                      {dryRun.assetsWithoutLegacyHistory.length}
                    </span>
                    <span>Blokkades: {blockers.total}</span>
                    <span>
                      Write plan: {writePlan?.writes.length || 0} documentwrites
                    </span>
                    <span>
                      Collecties:{" "}
                      {[
                        ...new Set(
                          writePlan?.writes.map((item) => item.collection) ||
                            [],
                        ),
                      ].join(", ")}
                    </span>
                  </div>
                  {writePlan ? (
                    <details
                      onToggle={(event) => {
                        if ((event.currentTarget as HTMLDetailsElement).open)
                          setPreviewViewed(true);
                      }}
                    >
                      <summary>Definitief write plan bekijken</summary>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Fase</th>
                              <th>Collectie</th>
                              <th>Document-ID</th>
                              <th>Actie</th>
                            </tr>
                          </thead>
                          <tbody>
                            {writePlan.writes.map((item) => (
                              <tr key={`${item.collection}:${item.documentId}`}>
                                <td>{item.phase}</td>
                                <td>{item.collection}</td>
                                <td>{item.documentId}</td>
                                <td>{item.mode}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ) : null}
                  <div className="form-actions">
                    <Button
                      variant="secondary"
                      onClick={downloadBackup}
                      disabled={!writePlan}
                    >
                      Verplichte backup downloaden
                    </Button>
                  </div>
                  <label className="field">
                    <span>Typ IMPORTEREN</span>
                    <input
                      value={typedConfirmation}
                      onChange={(event) =>
                        setTypedConfirmation(event.target.value)
                      }
                    />
                  </label>
                  <label className="switch-row import-confirmation">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={
                        blockers.total > 0 || !backupReady || !previewViewed
                      }
                      onChange={(e) => {
                        setConfirmed(e.target.checked);
                        if (e.target.checked) setStage(6);
                      }}
                    />
                    <span>
                      Ik heb alle definitieve wijzigingen gecontroleerd en
                      bevestig de import.
                    </span>
                  </label>
                  {checkpoint ? (
                    <div className="import-source-summary" aria-live="polite">
                      <span>Status: {checkpoint.status}</span>
                      <span>Batch: {checkpoint.batchIndex}</span>
                      <span>Geslaagd: {checkpoint.completed}</span>
                      <span>Skips: {checkpoint.skipped}</span>
                      <span>Mislukt: {checkpoint.failed}</span>
                      <span>
                        Laatste checkpoint: {checkpoint.lastSafeCheckpoint}
                      </span>
                      <Button variant="secondary" onClick={downloadFinalReport}>
                        Eindrapport downloaden
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : null}
              <div className="form-actions">
                <Button onClick={commit} disabled={!productionGate.allowed}>
                  <FileSpreadsheet />
                  Definitieve import uitvoeren
                </Button>
              </div>
              {!productionGate.allowed && blockers.total === 0 ? (
                <div className="migration-gate-status" role="status">
                  <strong>De Excelgegevens zijn gereed.</strong>
                  <span>
                    De importknop wacht nog op {productionGate.failed.length}{" "}
                    beveiligingscontrole(s):
                  </span>
                  <ul>
                    {productionGate.failed.map((reason) => (
                      <li key={reason}>{gateLabels[reason] || reason}</li>
                    ))}
                  </ul>
                  {tab !== "Definitieve wijzigingen" ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setTab("Definitieve wijzigingen");
                        setStage(6);
                      }}
                    >
                      Naar definitieve controles
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <MutationFeedback {...feedback} />
            </Card>
          </>
        ) : null}
      </div>
    </OfflineGate>
  );
}
function ReviewList({ children }: { children: React.ReactNode }) {
  return <div className="review-list">{children}</div>;
}
function ReviewItem({
  title,
  status,
  resolved,
  children,
}: {
  title: string;
  status: string;
  resolved: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="review-item">
      <header>
        <b>{title}</b>
        <span
          className={`badge ${resolved ? "badge-success" : "badge-danger"}`}
        >
          {status}
        </span>
      </header>
      {children}
    </section>
  );
}
