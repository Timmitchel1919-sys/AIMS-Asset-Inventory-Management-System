import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Loader } from "../components/ui";
import { PageHeader } from "../components/WorkflowUi";
import { useApp } from "../context/AppContext";
import { useAssetTypes } from "../data/assetTypesStore";
import { useMockSnapshot } from "../data/repositoryContext";
import {
  applyReferenceMigration,
  type ApplyResult,
} from "../data/referenceMigrationApply";
import {
  REFERENCE_FIELDS,
  changesOf,
  planReferenceMigration,
  reportToCsv,
  type FieldOutcome,
  type MigrationReport,
} from "../domain/referenceMigration";

const COPY = {
  nl: {
    title: "Referentiemigratie assets",
    description:
      "Vul de canonieke ID-verwijzingen op bestaande assets aan op basis van hun huidige tekstvelden. Eerst een rapport, daarna pas toepassen.",
    safety: [
      "Alleen lege ID-velden worden gevuld; een bestaand ID wordt nooit overschreven.",
      "Alleen eenduidige, exacte koppelingen worden voorgesteld. Dubbelzinnig of geen match blijft leeg en staat in het rapport.",
      "De bestaande tekstvelden (categorie, afdeling, toegewezen aan, …) en Inv.codes blijven ongewijzigd.",
    ],
    generate: "Rapport maken (schrijft niets)",
    regenerate: "Rapport vernieuwen",
    needTypes: "Er is nog geen actief beheertype \"Serialized\". Maak eerst de standaardtypen aan op de pagina Categorieën; zonder dat wordt het beheertype niet gevuld.",
    assets: "Assets in rapport",
    withChanges: "Assets met wijzigingen",
    noLocation: "Assets zonder locatieverwijzing (alleen informatie)",
    field: "Veld",
    unmatched: "Waarden zonder (eenduidige) koppeling",
    value: "Waarde",
    count: "Aantal",
    download: "Rapport downloaden (CSV)",
    confirm: "Ik heb het rapport gecontroleerd en wil de voorgestelde koppelingen toepassen.",
    apply: "Toepassen",
    applying: "Bezig…",
    result: "Resultaat",
    updated: "Assets bijgewerkt",
    fields: "Velden gevuld",
    skippedChanged: "Overgeslagen (intussen gewijzigd)",
    skippedMissing: "Overgeslagen (bestaat niet meer)",
    failed: "Mislukt",
    nothing: "Er zijn geen wijzigingen om toe te passen.",
    outcomes: { "will-fill": "Wordt gevuld", "already-set": "Al ingevuld", conflict: "Conflict", ambiguous: "Dubbelzinnig", "no-match": "Geen match", "not-applicable": "n.v.t.", blocked: "Geblokkeerd" } as Record<FieldOutcome, string>,
    back: "Terug naar Categorieën",
    offline: "Toepassen vereist een Firebase-verbinding.",
  },
  en: {
    title: "Asset reference migration",
    description:
      "Fill the canonical id references on existing assets from their current text fields. Report first, apply afterwards.",
    safety: [
      "Only empty id fields are filled; an existing id is never overwritten.",
      "Only exact, unambiguous matches are proposed. Ambiguous or unmatched values stay empty and appear in the report.",
      "Existing text fields (category, department, assigned to, …) and Inv.codes are left unchanged.",
    ],
    generate: "Create report (writes nothing)",
    regenerate: "Refresh report",
    needTypes: "There is no active \"Serialized\" tracking type yet. Create the default types on the Categories page first; otherwise the tracking type is not filled.",
    assets: "Assets in report",
    withChanges: "Assets with changes",
    noLocation: "Assets without a location reference (information only)",
    field: "Field",
    unmatched: "Values without an unambiguous match",
    value: "Value",
    count: "Count",
    download: "Download report (CSV)",
    confirm: "I have reviewed the report and want to apply the proposed references.",
    apply: "Apply",
    applying: "Working…",
    result: "Result",
    updated: "Assets updated",
    fields: "Fields filled",
    skippedChanged: "Skipped (changed meanwhile)",
    skippedMissing: "Skipped (no longer exists)",
    failed: "Failed",
    nothing: "There are no changes to apply.",
    outcomes: { "will-fill": "Will fill", "already-set": "Already set", conflict: "Conflict", ambiguous: "Ambiguous", "no-match": "No match", "not-applicable": "n/a", blocked: "Blocked" } as Record<FieldOutcome, string>,
    back: "Back to Categories",
    offline: "Applying requires a Firebase connection.",
  },
} as const;

const OUTCOME_ORDER: FieldOutcome[] = ["will-fill", "already-set", "conflict", "ambiguous", "no-match", "not-applicable", "blocked"];
const tone = (o: FieldOutcome) =>
  o === "will-fill" ? "success" : o === "conflict" || o === "blocked" ? "danger" : o === "ambiguous" || o === "no-match" ? "warning" : "neutral";

export default function ReferenceMigration() {
  const { user, language } = useApp();
  const c = language === "nl" ? COPY.nl : COPY.en;
  const snapshot = useMockSnapshot();
  const types = useAssetTypes();
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState("");

  const generate = () => {
    setResult(null);
    setError("");
    setReviewed(false);
    setReport(
      planReferenceMigration({
        assets: snapshot.assets,
        references: snapshot.references,
        codeGroups: snapshot.codeGroups,
        users: snapshot.users,
        assetTypes: types.items,
      }),
    );
  };

  const download = () => {
    if (!report) return;
    const blob = new Blob(["﻿", reportToCsv(report)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aims-reference-migration-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const apply = async () => {
    if (!report) return;
    setBusy(true);
    setError("");
    try {
      setResult(
        await applyReferenceMigration(report.plans, { uid: user?.id, name: user?.name }, (done, total) =>
          setProgress(`${done} / ${total}`),
        ),
      );
      setReport(null);
      setReviewed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const totalChanges = report ? report.plans.reduce((sum, plan) => sum + changesOf(plan).length, 0) : 0;
  const needTypes = !types.loading && !types.items.some((t) => t.id === "serialized" && t.status !== "Archived");

  return (
    <div className="page reference-migration-page">
      <PageHeader title={c.title} description={c.description} actions={<Link className="btn btn-ghost" to="/categories">{c.back}</Link>} />
      <section className="card dm-panel">
        <ul>{c.safety.map((line) => <li key={line}>{line}</li>)}</ul>
        {needTypes && <p className="dm-message dm-message--error" role="alert">{c.needTypes}</p>}
        <div className="dm-toolbar">
          <Button type="button" onClick={generate} disabled={busy || types.loading}>
            {report ? c.regenerate : c.generate}
          </Button>
        </div>
        {types.loading && <Loader />}
      </section>

      {result && (
        <section className="card dm-panel" role="status">
          <h2>{c.result}</h2>
          <dl className="dm-kpis">
            <div className="dm-kpi"><span>{c.updated}</span><strong>{result.updated}</strong></div>
            <div className="dm-kpi"><span>{c.fields}</span><strong>{result.fieldsWritten}</strong></div>
            <div className="dm-kpi"><span>{c.skippedChanged}</span><strong>{result.skippedChanged}</strong></div>
            <div className="dm-kpi"><span>{c.skippedMissing}</span><strong>{result.skippedMissing}</strong></div>
            <div className="dm-kpi"><span>{c.failed}</span><strong>{result.failedAssets.length}</strong></div>
          </dl>
          {result.failedAssets.length > 0 && <p className="dm-message dm-message--error" role="alert">{result.failedAssets.slice(0, 30).join(", ")}</p>}
        </section>
      )}
      {error && <p className="dm-message dm-message--error" role="alert">{error}</p>}

      {report && (
        <section className="card dm-panel">
          <div className="dm-kpis">
            <div className="dm-kpi"><span>{c.assets}</span><strong>{report.summary.totalAssets}</strong></div>
            <div className="dm-kpi"><span>{c.withChanges}</span><strong>{report.summary.assetsWithChanges}</strong></div>
            <div className="dm-kpi"><span>{c.noLocation}</span><strong>{report.summary.missingLocation}</strong></div>
          </div>
          <div className="dm-table-wrap">
            <table>
              <thead>
                <tr><th>{c.field}</th>{OUTCOME_ORDER.map((o) => <th key={o}>{c.outcomes[o]}</th>)}</tr>
              </thead>
              <tbody>
                {REFERENCE_FIELDS.map((field) => (
                  <tr key={field}>
                    <td><code>{field}</code></td>
                    {OUTCOME_ORDER.map((o) => (
                      <td key={o}>{report.summary.perField[field][o] ? <Badge tone={tone(o)}>{report.summary.perField[field][o]}</Badge> : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {REFERENCE_FIELDS.filter((f) => report.unmatched[f].length).map((field) => (
            <details key={field}>
              <summary>{c.unmatched}: <code>{field}</code> ({report.unmatched[field].length})</summary>
              <div className="dm-table-wrap">
                <table>
                  <thead><tr><th>{c.value}</th><th>{c.count}</th></tr></thead>
                  <tbody>
                    {report.unmatched[field].slice(0, 50).map((row) => (
                      <tr key={row.value}><td>{row.value || "—"}</td><td>{row.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
          <div className="dm-toolbar">
            <Button type="button" variant="secondary" onClick={download}>{c.download}</Button>
          </div>
          {totalChanges === 0 ? (
            <p>{c.nothing}</p>
          ) : (
            <>
              <label className="dm-check">
                <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /> {c.confirm}
              </label>
              <div className="dm-toolbar">
                <Button type="button" disabled={!reviewed || busy || !types.connected} onClick={apply}>
                  {busy ? `${c.applying} ${progress}` : `${c.apply} (${report.summary.assetsWithChanges} assets, ${totalChanges} ${language === "nl" ? "velden" : "fields"})`}
                </Button>
                {!types.connected && <small>{c.offline}</small>}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
