import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Play,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog, PageHeader } from "../components/WorkflowUi";
import { useApp } from "../context/AppContext";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { planQrBackfill } from "../domain/qrIdentity";

export default function QrBackfill() {
  const { language } = useApp(),
    nl = language === "nl",
    snapshot = useMockSnapshot(),
    repository = useRepository();
  const assessment = useMemo(
    () => planQrBackfill(snapshot.assets, snapshot.qrIdentities),
    [snapshot.assets, snapshot.qrIdentities],
  );
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<
    { ok: number; failed: { assetId: string; message: string }[] } | null
  >(null);

  const eligible = Math.max(assessment.totalAssets - assessment.blocked.length, 0);
  const identified = assessment.preserve.length + assessment.create.length;
  const coverage =
    eligible > 0 ? Math.round((identified / eligible) * 100) : 100;

  async function apply() {
    setBusy(true);
    setResult(null);
    const ok: string[] = [];
    const failed: { assetId: string; message: string }[] = [];
    for (let index = 0; index < assessment.create.length; index += 1) {
      const assetId = assessment.create[index];
      setProgress(
        nl
          ? `Verzoek ${index + 1}/${assessment.create.length}…`
          : `Provisioning ${index + 1}/${assessment.create.length}…`,
      );
      const response = await repository.execute({
        action: "qr.backfill",
        entityId: assetId,
        values: {},
      });
      if (response.ok) ok.push(assetId);
      else failed.push({ assetId, message: response.message });
    }
    setProgress("");
    setResult({ ok: ok.length, failed });
    setBusy(false);
    setConfirming(false);
  }

  return (
    <div className="page admin-overview">
      <PageHeader
        title={nl ? "QR-backfill" : "QR backfill"}
        description={
          nl
            ? "Voorzie bestaande middelen van een beveiligde opake QR-identiteit."
            : "Provision existing assets with a secure opaque QR identity."
        }
        actions={
          <button
            className="btn"
            type="button"
            onClick={() => {
              setResult(null);
              setProgress("");
            }}
            disabled={busy}
          >
            <RotateCcw />
            {nl ? "Opnieuw inschatten" : "Reassess"}
          </button>
        }
      />

      <section className="admin-metrics" aria-label="QR preflight">
        <article className="card">
          <ClipboardCheck />
          <span>{nl ? "Totaal middelen" : "Total assets"}</span>
          <strong>{assessment.totalAssets}</strong>
        </article>
        <article className="card">
          <CheckCircle2 />
          <span>{nl ? "Al voorzien" : "Already provisioned"}</span>
          <strong>{assessment.preserve.length}</strong>
        </article>
        <article className="card">
          <Play />
          <span>{nl ? "Nog te voorzien" : "To provision"}</span>
          <strong>{assessment.create.length}</strong>
        </article>
        <article className="card">
          <AlertTriangle />
          <span>{nl ? "Geblokkeerd" : "Blocked"}</span>
          <strong>{assessment.blocked.length}</strong>
        </article>
        <article className="card">
          <ShieldAlert />
          <span>{nl ? "Dekking" : "Coverage"}</span>
          <strong>{coverage}%</strong>
        </article>
      </section>

      {assessment.blocked.length > 0 && (
        <section className="card qr-backfill-blocked">
          <header className="section-heading">
            <div>
              <h2>{nl ? "Conflicten — alleen ter kennisname" : "Conflicts — report only"}</h2>
              <p>
                {nl
                  ? "Deze records worden niet gewijzigd. Los ze eerst op in de inventaris."
                  : "These records will not be changed. Resolve them in the inventory first."}
              </p>
            </div>
          </header>
          <ul>
            {assessment.blocked.map((conflict) => (
              <li key={conflict.assetId}>
                <strong>{conflict.code}</strong> · {conflict.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card qr-backfill-review">
        <header className="section-heading">
          <div>
            <h2>{nl ? "Uitvoering" : "Apply"}</h2>
            <p>
              {nl
                ? `Droge run: ${assessment.create.length} van ${eligible} middelen moeten een QR-identiteit krijgen. Uitvoeren is idempotent en per record te hervatten.`
                : `Dry run: ${assessment.create.length} of ${eligible} assets need a QR identity. Applying is idempotent and resumable per record.`}
            </p>
          </div>
        </header>
        <p className="qr-backfill-note">
          {nl
            ? "Er worden alleen nieuwe QR-identiteiten toegevoegd; bestaande codes, serienummers en locaties blijven ongewijzigd. Geen enkele record wordt verwijderd of hernoemd."
            : "Only new QR identities are added; existing codes, serial numbers and locations are unchanged. No record is deleted or renamed."}
        </p>
        {result ? (
          <p className="qr-backfill-result">
            {result.ok} {nl ? "voorzien" : "provisioned"} —{" "}
            {result.failed.length} {nl ? "mislukt" : "failed"}.
            {result.failed.length > 0 && (
              <span>
                {" "}
                {result.failed
                  .map((failure) => `${failure.assetId}: ${failure.message}`)
                  .join("; ")}
              </span>
            )}
          </p>
        ) : progress ? (
          <p className="qr-backfill-result">{progress}</p>
        ) : null}
        {assessment.invalidQrRecords > 0 && (
          <p className="qr-backfill-note">
            <AlertTriangle aria-hidden />{" "}
            {nl
              ? `${assessment.invalidQrRecords} ongeldige QR-records worden hersteld.`
              : `${assessment.invalidQrRecords} malformed QR records will be re-provisioned.`}
          </p>
        )}
        <div className="actions">
          <button
            className="btn btn-primary"
            type="button"
            disabled={
              busy || assessment.create.length === 0
            }
            onClick={() => setConfirming(true)}
          >
            <Play />
            {nl
              ? `Nu uitvoeren (${assessment.create.length})`
              : `Apply now (${assessment.create.length})`}
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirming}
        title={nl ? "QR-backfill uitvoeren?" : "Apply QR backfill?"}
        description={
          nl
            ? "Hiermee worden nieuwe QR-identiteiten aangemaakt voor de records die nog niet voorzien zijn. Deze actie is niet-destructief en per record te hervatten."
            : "This mints new QR identities for the records that still need one. The action is non-destructive and resumable per record."
        }
        confirmLabel={nl ? "Nu uitvoeren" : "Apply now"}
        onConfirm={apply}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}