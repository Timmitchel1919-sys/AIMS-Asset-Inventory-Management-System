import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw } from "lucide-react";
import { httpsCallable, type FunctionsError } from "firebase/functions";
import { Button } from "../ui";
import { MutationFeedback } from "../WorkflowUi";
import { useApp } from "../../context/AppContext";
import { can } from "../../auth/permissions";
import { firebaseFunctions } from "../../lib/firebase";

type ExportResult = { ok: boolean; syncedAt: string; rows: Record<string, number> };

type ImportSummary = {
  updates?: number;
  updated?: number;
  creates?: number;
  created?: number;
  trashes?: number;
  trashed?: number;
  restores?: number;
  restored?: number;
  conflicts: number;
  corrections?: number;
  corrected?: number;
  needsAimsCreate: number;
  errors: number;
  skipped?: number;
  cellsWritten?: number;
};
type Conflict = { tab: string; row: number; reason: string; detail?: string };
type ImportResult = {
  ok: boolean;
  applied: boolean;
  syncedAt: string;
  summary: ImportSummary;
  conflicts?: Conflict[];
  errors?: { tab: string; row: number; message: string }[];
};

type Feedback = { status: "idle" | "loading" | "success" | "error"; message: string };

const errText = (error: unknown, nl: boolean) => {
  const code = (error as FunctionsError)?.code ?? "";
  if (code === "functions/permission-denied")
    return nl
      ? "Alleen een AIMS-beheerder kan dit uitvoeren."
      : "Only an AIMS administrator can run this.";
  if (code === "functions/failed-precondition")
    return nl
      ? "Er is geen doelspreadsheet ingesteld (AIMS_SYNC_SPREADSHEET_ID)."
      : "No target spreadsheet is configured (AIMS_SYNC_SPREADSHEET_ID).";
  if (code === "functions/unavailable")
    return nl
      ? "Google Sheets is niet bereikbaar. Controleer of het werkblad met het service-account is gedeeld."
      : "Google Sheets is unreachable. Check that the sheet is shared with the service account.";
  return nl
    ? "De bewerking is mislukt. Probeer het later opnieuw."
    : "The operation failed. Please try again later.";
};

export function GoogleSheetsExport() {
  const app = useApp();
  const nl = app.language === "nl";

  const [exportFb, setExportFb] = useState<Feedback>({ status: "idle", message: "" });
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  const [importFb, setImportFb] = useState<Feedback>({ status: "idle", message: "" });
  const [plan, setPlan] = useState<ImportResult | null>(null);
  const [armed, setArmed] = useState(false);

  if (!firebaseFunctions) return null;
  if (!can(app.user?.role, "admin.system.configure")) return null;
  const functions = firebaseFunctions;

  const runExport = async () => {
    setExportFb({ status: "loading", message: nl ? "Bezig met exporteren…" : "Exporting…" });
    setExportResult(null);
    try {
      const call = httpsCallable<{ spreadsheetId?: string }, ExportResult>(
        functions,
        "exportAimsToSheets",
      );
      const { data } = await call({});
      setExportResult(data);
      const total = Object.values(data.rows).reduce((s, n) => s + n, 0);
      setExportFb({
        status: "success",
        message: nl
          ? `Export voltooid — ${total} rijen geschreven.`
          : `Export complete — ${total} rows written.`,
      });
    } catch (error) {
      setExportFb({ status: "error", message: errText(error, nl) });
    }
  };

  const applicable = (s?: ImportSummary) =>
    !s
      ? 0
      : (s.updates ?? 0) +
        (s.creates ?? 0) +
        (s.trashes ?? 0) +
        (s.restores ?? 0) +
        (s.corrections ?? 0);

  const runImport = async (apply: boolean) => {
    setImportFb({
      status: "loading",
      message: apply
        ? nl
          ? "Bezig met toepassen…"
          : "Applying…"
        : nl
          ? "Wijzigingen ophalen…"
          : "Checking for changes…",
    });
    if (!apply) setPlan(null);
    setArmed(false);
    try {
      const call = httpsCallable<
        { spreadsheetId?: string; apply?: boolean },
        ImportResult
      >(functions, "importAimsFromSheets");
      const { data } = await call({ apply });
      setPlan(data);
      const s = data.summary;
      if (apply) {
        setImportFb({
          status: "success",
          message: nl
            ? `Toegepast — ${s.updated ?? 0} bijgewerkt, ${s.created ?? 0} aangemaakt, ${s.trashed ?? 0} verwijderd, ${s.restored ?? 0} hersteld, ${s.corrected ?? 0} correcties${s.skipped ? `, ${s.skipped} overgeslagen` : ""}.`
            : `Applied — ${s.updated ?? 0} updated, ${s.created ?? 0} created, ${s.trashed ?? 0} trashed, ${s.restored ?? 0} restored, ${s.corrected ?? 0} corrections${s.skipped ? `, ${s.skipped} skipped` : ""}.`,
        });
      } else {
        const n = applicable(s);
        setImportFb({
          status: "success",
          message: nl
            ? `${n} toepasbaar (waarvan ${s.trashes ?? 0} verwijderen / ${s.restores ?? 0} herstellen), ${s.conflicts} conflict(en), ${s.needsAimsCreate} nieuw in AIMS, ${s.errors} fout(en).`
            : `${n} applicable (${s.trashes ?? 0} trash / ${s.restores ?? 0} restore of them), ${s.conflicts} conflict(s), ${s.needsAimsCreate} new-in-AIMS, ${s.errors} error(s).`,
        });
      }
    } catch (error) {
      setImportFb({ status: "error", message: errText(error, nl) });
    }
  };

  const pendingApply = plan && !plan.applied && applicable(plan.summary) > 0;

  return (
    <>
      {/* -------- export -------- */}
      <div className="switch-row wide integration-status-row">
        <span>
          <strong>
            <ArrowUpFromLine size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
            {nl ? "Export naar Google Sheets" : "Export to Google Sheets"}
          </strong>
          <small>
            {nl
              ? "Eenrichtingsexport van de live AIMS-gegevens naar het gekoppelde werkblad. Vervangt de inhoud van elk tabblad."
              : "One-way export of the live AIMS data into the linked workbook. Replaces each tab's contents."}
          </small>
          {exportResult && (
            <small className="sheets-sync-summary">
              {nl ? "Laatste export: " : "Last export: "}
              {app.formatDateTime(exportResult.syncedAt)}
              {" — "}
              {Object.entries(exportResult.rows)
                .filter(([, c]) => c > 0)
                .map(([t, c]) => `${t}: ${c}`)
                .join(" · ") || (nl ? "geen rijen" : "no rows")}
            </small>
          )}
          <MutationFeedback {...exportFb} />
        </span>
        <Button
          type="button"
          variant="secondary"
          onClick={runExport}
          disabled={exportFb.status === "loading"}
        >
          <RefreshCw size={16} className={exportFb.status === "loading" ? "spin" : undefined} />
          {nl ? "Nu exporteren" : "Export now"}
        </Button>
      </div>

      {/* -------- import -------- */}
      <div className="switch-row wide integration-status-row">
        <span>
          <strong>
            <ArrowDownToLine size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
            {nl ? "Import vanuit Google Sheets" : "Import from Google Sheets"}
          </strong>
          <small>
            {nl
              ? "Leest bewerkingen in het werkblad terug. Identifier-, locatie- en toewijzingswijzigingen worden als conflict gemeld. Status = Archived verwijdert een record; Restore = RESTORE op het Prullenbak-tabblad herstelt het. Nieuwe middel-rijen worden gemeld, niet aangemaakt."
              : "Reads sheet edits back into AIMS. Identifier, location and assignment changes are reported as conflicts. Status = Archived trashes a record; Restore = RESTORE on the Trash tab brings it back. New asset rows are reported, not created."}
          </small>

          {plan && (
            <small className="sheets-sync-summary">
              {nl ? "Laatste controle: " : "Last check: "}
              {app.formatDateTime(plan.syncedAt)}
              {" — "}
              {nl ? "toepasbaar " : "applicable "}
              {applicable(plan.summary)} · {plan.summary.conflicts}{" "}
              {nl ? "conflicten" : "conflicts"} · {plan.summary.needsAimsCreate}{" "}
              {nl ? "nieuw-in-AIMS" : "new-in-AIMS"} · {plan.summary.errors}{" "}
              {nl ? "fouten" : "errors"}
            </small>
          )}

          {plan && (plan.summary.conflicts > 0 || plan.summary.errors > 0) ? (
            <small className="sheets-sync-list">
              <Link to="/admin/sync-conflicts">
                {nl
                  ? `${plan.summary.conflicts} conflict(en) beoordelen →`
                  : `Review ${plan.summary.conflicts} conflict(s) →`}
              </Link>
            </small>
          ) : null}
          {plan?.errors?.length ? (
            <ul className="sheets-sync-list sheets-sync-list--error">
              {plan.errors.slice(0, 6).map((e, i) => (
                <li key={i}>
                  <code>
                    {e.tab} r{e.row}
                  </code>{" "}
                  — {e.message}
                </li>
              ))}
            </ul>
          ) : null}

          <MutationFeedback {...importFb} />
        </span>
        <div className="sheets-sync-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => runImport(false)}
            disabled={importFb.status === "loading"}
          >
            <RefreshCw size={16} className={importFb.status === "loading" ? "spin" : undefined} />
            {nl ? "Wijzigingen bekijken" : "Preview changes"}
          </Button>
          {pendingApply && (
            <Button
              type="button"
              variant={armed ? "danger" : "primary"}
              onClick={() => (armed ? runImport(true) : setArmed(true))}
              disabled={importFb.status === "loading"}
            >
              {armed
                ? nl
                  ? `Bevestig — ${applicable(plan!.summary)} toepassen`
                  : `Confirm — apply ${applicable(plan!.summary)}`
                : nl
                  ? `${applicable(plan!.summary)} wijziging(en) toepassen`
                  : `Apply ${applicable(plan!.summary)} change(s)`}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
