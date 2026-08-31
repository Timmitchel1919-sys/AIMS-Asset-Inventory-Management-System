import { useState } from "react";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { httpsCallable, type FunctionsError } from "firebase/functions";
import { Button } from "../ui";
import { MutationFeedback } from "../WorkflowUi";
import { useApp } from "../../context/AppContext";
import { can } from "../../auth/permissions";
import { firebaseFunctions } from "../../lib/firebase";

type ExportResult = {
  ok: boolean;
  syncedAt: string;
  rows: Record<string, number>;
};

type Feedback = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

const messageForError = (error: unknown, nl: boolean) => {
  const code = (error as FunctionsError)?.code ?? "";
  if (code === "functions/permission-denied")
    return nl
      ? "Alleen een AIMS-beheerder kan de export starten."
      : "Only an AIMS administrator can run the export.";
  if (code === "functions/failed-precondition")
    return nl
      ? "Er is nog geen doelspreadsheet ingesteld (AIMS_SYNC_SPREADSHEET_ID)."
      : "No target spreadsheet is configured yet (AIMS_SYNC_SPREADSHEET_ID).";
  if (code === "functions/unavailable")
    return nl
      ? "De export naar Google Sheets kon niet worden voltooid. Controleer of het werkblad met het service-account is gedeeld."
      : "The export to Google Sheets could not be completed. Check that the sheet is shared with the service account.";
  return nl
    ? "De export is mislukt. Probeer het later opnieuw."
    : "The export failed. Please try again later.";
};

export function GoogleSheetsExport() {
  const app = useApp();
  const nl = app.language === "nl";
  const [feedback, setFeedback] = useState<Feedback>({
    status: "idle",
    message: "",
  });
  const [result, setResult] = useState<ExportResult | null>(null);

  if (!firebaseFunctions) return null;
  if (!can(app.user?.role, "admin.system.configure")) return null;
  const functions = firebaseFunctions;

  const run = async () => {
    setFeedback({
      status: "loading",
      message: nl ? "Bezig met exporteren…" : "Exporting…",
    });
    setResult(null);
    try {
      const call = httpsCallable<{ spreadsheetId?: string }, ExportResult>(
        functions,
        "exportAimsToSheets",
      );
      const { data } = await call({});
      setResult(data);
      const total = Object.values(data.rows).reduce((sum, n) => sum + n, 0);
      setFeedback({
        status: "success",
        message: nl
          ? `Export voltooid — ${total} rijen geschreven.`
          : `Export complete — ${total} rows written.`,
      });
    } catch (error) {
      setFeedback({ status: "error", message: messageForError(error, nl) });
    }
  };

  return (
    <div className="switch-row wide integration-status-row">
      <span>
        <strong>
          <FileSpreadsheet
            size={16}
            style={{ verticalAlign: "-3px", marginRight: 6 }}
          />
          {nl ? "Export naar Google Sheets" : "Export to Google Sheets"}
        </strong>
        <small>
          {nl
            ? "Eenrichtingsexport van de live AIMS-gegevens naar het gekoppelde werkblad. Vervangt de inhoud van elk tabblad; schrijft niets terug naar AIMS."
            : "One-way export of the live AIMS data into the linked workbook. Replaces each tab's contents; nothing is written back to AIMS."}
        </small>
        {result && (
          <small className="sheets-export-summary">
            {nl ? "Laatste export: " : "Last export: "}
            {app.formatDateTime(result.syncedAt)}
            {" — "}
            {Object.entries(result.rows)
              .filter(([, count]) => count > 0)
              .map(([tab, count]) => `${tab}: ${count}`)
              .join(" · ") || (nl ? "geen rijen" : "no rows")}
          </small>
        )}
        <MutationFeedback {...feedback} />
      </span>
      <Button
        type="button"
        variant="secondary"
        onClick={run}
        disabled={feedback.status === "loading"}
      >
        <RefreshCw
          size={16}
          className={feedback.status === "loading" ? "spin" : undefined}
        />
        {nl ? "Nu exporteren" : "Export now"}
      </Button>
    </div>
  );
}
