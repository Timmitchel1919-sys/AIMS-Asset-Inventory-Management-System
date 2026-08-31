import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { httpsCallable, type FunctionsError } from "firebase/functions";
import { Button, Card } from "../components/ui";
import { MutationFeedback, PageHeader } from "../components/WorkflowUi";
import { useApp } from "../context/AppContext";
import { can } from "../auth/permissions";
import { firebaseFunctions } from "../lib/firebase";

type Conflict = {
  tab: string;
  row: number;
  recordId?: string;
  reason: string;
  detail?: string;
  fields?: string[];
  changes?: Record<string, { from: string; to: string }>;
};
type RowError = { tab: string; row: number; message: string };
type Preview = {
  syncedAt: string;
  summary: Record<string, number>;
  conflicts: Conflict[];
  errors: RowError[];
  needsAimsCreate: { tab: string; row: number; preview?: { name?: string } }[];
};

const DISMISS_KEY = "aims-sync-conflict-dismissed:v1";
const fp = (c: Conflict) => `${c.tab}|${c.row}|${c.recordId ?? ""}|${c.reason}`;

const loadDismissed = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]"));
  } catch {
    return new Set();
  }
};
const saveDismissed = (s: Set<string>) => {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
};

const errText = (error: unknown, nl: boolean) => {
  const code = (error as FunctionsError)?.code ?? "";
  const message = (error as FunctionsError)?.message ?? "";
  if (code === "functions/failed-precondition")
    return message || (nl ? "Kan niet worden toegepast." : "Cannot be applied.");
  if (code === "functions/permission-denied")
    return nl ? "Alleen een beheerder kan dit." : "Administrators only.";
  if (code === "functions/unavailable")
    return nl ? "Google Sheets is niet bereikbaar." : "Google Sheets is unreachable.";
  return nl ? "De bewerking is mislukt." : "The operation failed.";
};

const REASON_LABEL: Record<string, [string, string]> = {
  "protected-field": ["Held field", "Beschermd veld"],
  "stale-version": ["Out of date", "Verouderd"],
  "unknown-record": ["Unknown record", "Onbekend record"],
  "record-archived": ["Archived in AIMS", "Gearchiveerd in AIMS"],
  contradictory: ["Contradictory", "Tegenstrijdig"],
};

export default function SyncConflicts() {
  const app = useApp();
  const nl = app.language === "nl";
  const navigate = useNavigate();

  const [data, setData] = useState<Preview | null>(null);
  const [fb, setFb] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [showDismissed, setShowDismissed] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const gate = can(app.user?.role, "admin.system.configure");

  const recheck = useCallback(async () => {
    if (!firebaseFunctions) return;
    setFb({ status: "loading", message: nl ? "Conflicten ophalen…" : "Loading conflicts…" });
    try {
      const call = httpsCallable<{ apply?: boolean }, Preview>(
        firebaseFunctions,
        "importAimsFromSheets",
      );
      const { data: res } = await call({ apply: false });
      setData(res);
      setFb({ status: "idle", message: "" });
    } catch (error) {
      setFb({ status: "error", message: errText(error, nl) });
    }
  }, [nl]);

  useEffect(() => {
    if (!gate) return;
    // Kick the initial load off the effect tick so the loading setState is not
    // synchronous within the effect body.
    const t = setTimeout(() => {
      void recheck();
    }, 0);
    return () => clearTimeout(t);
  }, [gate, recheck]);

  const resolve = async (c: Conflict) => {
    if (!firebaseFunctions || !c.recordId || !c.fields?.length) return;
    setRowBusy(fp(c));
    setFb({ status: "loading", message: nl ? "Toepassen…" : "Applying…" });
    try {
      const call = httpsCallable<
        { tab: string; row: number; recordId: string; fields: string[] },
        { ok: boolean; applied: boolean; syncVersion?: number }
      >(firebaseFunctions, "resolveSyncConflict");
      await call({ tab: c.tab, row: c.row, recordId: c.recordId, fields: c.fields });
      setFb({
        status: "success",
        message: nl ? "Toegepast. Opnieuw controleren…" : "Applied. Re-checking…",
      });
      setArmed(null);
      await recheck();
    } catch (error) {
      setFb({ status: "error", message: errText(error, nl) });
    } finally {
      setRowBusy(null);
    }
  };

  const runExportThenRecheck = async () => {
    if (!firebaseFunctions) return;
    setFb({ status: "loading", message: nl ? "Exporteren…" : "Exporting…" });
    try {
      await httpsCallable(firebaseFunctions, "exportAimsToSheets")({});
      await recheck();
    } catch (error) {
      setFb({ status: "error", message: errText(error, nl) });
    }
  };

  const toggleDismiss = (c: Conflict) => {
    const key = fp(c);
    const next = new Set(dismissed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDismissed(next);
    saveDismissed(next);
  };

  const { active, hidden } = useMemo(() => {
    const list = data?.conflicts ?? [];
    return {
      active: list.filter((c) => !dismissed.has(fp(c))),
      hidden: list.filter((c) => dismissed.has(fp(c))),
    };
  }, [data, dismissed]);

  const grouped = useMemo(() => {
    const map = new Map<string, Conflict[]>();
    for (const c of showDismissed ? [...active, ...hidden] : active) {
      const g = map.get(c.tab) ?? [];
      g.push(c);
      map.set(c.tab, g);
    }
    return [...map.entries()];
  }, [active, hidden, showDismissed]);

  if (!gate) return <Navigate to="/dashboard" replace />;
  if (!firebaseFunctions)
    return (
      <div className="system-page">
        <Card>
          {nl
            ? "Synchronisatie is niet beschikbaar in deze omgeving."
            : "Sync is not available in this environment."}
        </Card>
      </div>
    );

  const renderCard = (c: Conflict) => {
    const key = fp(c);
    const isHidden = dismissed.has(key);
    const [en, du] = REASON_LABEL[c.reason] ?? [c.reason, c.reason];
    return (
      <Card key={key} className={`sync-conflict-card${isHidden ? " is-dismissed" : ""}`}>
        <div className="sync-conflict-head">
          <span className={`sync-conflict-reason reason-${c.reason}`}>{nl ? du : en}</span>
          <code>
            {c.tab} · {nl ? "rij" : "row"} {c.row}
          </code>
          {c.recordId && <code className="muted">{c.recordId}</code>}
        </div>
        {c.detail && <p className="sync-conflict-detail">{c.detail}</p>}
        {c.changes && Object.keys(c.changes).length > 0 && (
          <table className="sync-conflict-changes">
            <tbody>
              {Object.entries(c.changes).map(([field, { from, to }]) => (
                <tr key={field}>
                  <th>{field}</th>
                  <td className="from">{from || <em>—</em>}</td>
                  <td className="arrow">→</td>
                  <td className="to">{to || <em>—</em>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="sync-conflict-actions">
          {c.reason === "protected-field" && c.recordId && c.fields?.length ? (
            <Button
              type="button"
              variant={armed === key ? "danger" : "primary"}
              disabled={rowBusy === key}
              onClick={() => (armed === key ? resolve(c) : setArmed(key))}
            >
              {armed === key
                ? nl
                  ? "Bevestig — sheet-waarde toepassen"
                  : "Confirm — apply sheet value"
                : nl
                  ? `Sheet-waarde toepassen (${c.fields.join(", ")})`
                  : `Apply sheet value (${c.fields.join(", ")})`}
            </Button>
          ) : null}
          {c.reason === "stale-version" && (
            <Button type="button" variant="secondary" onClick={runExportThenRecheck}>
              <RefreshCw size={15} />
              {nl ? "Exporteren en opnieuw controleren" : "Export & re-check"}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => toggleDismiss(c)}>
            {isHidden ? (nl ? "Weer tonen" : "Un-dismiss") : nl ? "Negeren" : "Dismiss"}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="sync-conflicts-page">
      <button type="button" className="back" onClick={() => navigate("/settings/integrations")}>
        <ArrowLeft size={16} />
        {nl ? "Terug naar Integraties" : "Back to Integrations"}
      </button>
      <PageHeader
        title={nl ? "Synchronisatieconflicten" : "Sync conflicts"}
        description={
          nl
            ? "Wijzigingen in het werkblad die niet automatisch zijn toegepast. Beoordeel elk item."
            : "Sheet changes that were not applied automatically. Review each item."
        }
        actions={
          <Button type="button" variant="secondary" onClick={recheck} disabled={fb.status === "loading"}>
            <RefreshCw size={16} className={fb.status === "loading" ? "spin" : undefined} />
            {nl ? "Opnieuw controleren" : "Re-check"}
          </Button>
        }
      />

      <MutationFeedback {...fb} />

      {data && (
        <p className="sync-conflicts-summary">
          {nl ? "Laatste controle " : "Last checked "}
          {app.formatDateTime(data.syncedAt)} — {active.length}{" "}
          {nl ? "open" : "open"}
          {hidden.length ? `, ${hidden.length} ${nl ? "genegeerd" : "dismissed"}` : ""} ·{" "}
          {data.errors.length} {nl ? "fouten" : "errors"} · {data.needsAimsCreate.length}{" "}
          {nl ? "nieuw-in-AIMS" : "new-in-AIMS"}
          {hidden.length > 0 && (
            <button
              type="button"
              className="linklike"
              onClick={() => setShowDismissed((v) => !v)}
            >
              {showDismissed
                ? nl
                  ? "genegeerde verbergen"
                  : "hide dismissed"
                : nl
                  ? "genegeerde tonen"
                  : "show dismissed"}
            </button>
          )}
        </p>
      )}

      {data && active.length === 0 && hidden.length === 0 && fb.status !== "loading" && (
        <Card className="sync-conflicts-empty">
          <AlertTriangle size={18} />
          {nl ? "Geen conflicten. Alles is toepasbaar of al gesynchroniseerd." : "No conflicts — everything is applicable or already in sync."}
        </Card>
      )}

      {grouped.map(([tab, items]) => (
        <section key={tab} className="sync-conflict-group">
          <h2>{tab}</h2>
          {items.map(renderCard)}
        </section>
      ))}

      {data && data.errors.length > 0 && (
        <section className="sync-conflict-group">
          <h2>{nl ? "Fouten in rijen" : "Row errors"}</h2>
          <Card>
            <ul className="sync-conflict-errorlist">
              {data.errors.map((e, i) => (
                <li key={i}>
                  <code>
                    {e.tab} · {nl ? "rij" : "row"} {e.row}
                  </code>{" "}
                  — {e.message}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {data && data.needsAimsCreate.length > 0 && (
        <section className="sync-conflict-group">
          <h2>{nl ? "Nieuw in het werkblad — maak aan in AIMS" : "New in the sheet — create in AIMS"}</h2>
          <Card>
            <ul className="sync-conflict-errorlist">
              {data.needsAimsCreate.map((n, i) => (
                <li key={i}>
                  <code>
                    {n.tab} · {nl ? "rij" : "row"} {n.row}
                  </code>{" "}
                  — {n.preview?.name || <em>{nl ? "(naamloos)" : "(unnamed)"}</em>}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
