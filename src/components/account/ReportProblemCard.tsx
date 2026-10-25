import { AlertCircle, Send } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Button, Card } from "../ui";
import { useApp } from "../../context/AppContext";
import {
  captureDiagnostics,
  submitProblemReport,
  type ProblemModule,
  type ProblemType,
} from "../../services/problemReports";
import { firebaseConfigured } from "../../lib/firebase";

const MODULES: { id: ProblemModule; en: string; nl: string }[] = [
  { id: "dashboard", en: "Dashboard", nl: "Dashboard" },
  { id: "assets", en: "ICT Assets", nl: "ICT-middelen" },
  { id: "inventory", en: "Inventory", nl: "Voorraad" },
  { id: "locations", en: "Locations", nl: "Locaties" },
  { id: "departments", en: "Departments", nl: "Afdelingen" },
  { id: "assignments", en: "Assignments", nl: "Toewijzingen" },
  { id: "borrow", en: "Borrow", nl: "Uitlenen" },
  { id: "repairs", en: "Repairs", nl: "Reparaties" },
  { id: "maintenance", en: "Maintenance", nl: "Onderhoud" },
  { id: "movements", en: "Movements", nl: "Mutaties" },
  { id: "audits", en: "Audits", nl: "Audits" },
  { id: "reports", en: "Reports", nl: "Rapporten" },
  { id: "notifications", en: "Notifications", nl: "Meldingen" },
  { id: "settings", en: "Settings", nl: "Instellingen" },
  { id: "account", en: "Account", nl: "Account" },
  { id: "security", en: "Security", nl: "Beveiliging" },
  { id: "other", en: "Other", nl: "Overig" },
];

const PROBLEM_TYPES: { id: ProblemType; en: string; nl: string }[] = [
  { id: "crash", en: "Crash", nl: "Crash" },
  { id: "unexpected-behavior", en: "Unexpected behavior", nl: "Onverwacht gedrag" },
  { id: "missing-data", en: "Missing data", nl: "Ontbrekende gegevens" },
  { id: "permission", en: "Permission denied", nl: "Toegang geweigerd" },
  { id: "performance", en: "Performance", nl: "Prestaties" },
  { id: "visual", en: "Visual glitch", nl: "Visueel probleem" },
  { id: "other", en: "Other", nl: "Overig" },
];

export function ReportProblemCard() {
  const app = useApp();
  const nl = app.language === "nl";
  const [module, setModule] = useState<ProblemModule>("other");
  const [problemType, setProblemType] = useState<ProblemType>("unexpected-behavior");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const diagnostics = useMemo(
    () => captureDiagnostics(app.theme ?? "unknown", app.language),
    [app.theme, app.language],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!description.trim()) {
      setError(
        nl
          ? "Beschrijf wat er mis is gegaan."
          : "Describe what went wrong.",
      );
      return;
    }
    if (!app.user?.id) {
      setError(nl ? "Meld u aan om te rapporteren." : "Sign in to report.");
      return;
    }
    if (!firebaseConfigured || app.user.isDemoUser) {
      setError(
        nl
          ? "Rapportage is uitgeschakeld in de demosessie."
          : "Reporting is disabled in the demo session.",
      );
      return;
    }
    setBusy(true);
    try {
      const id = await submitProblemReport({
        uid: app.user.id,
        email: app.user.email ?? null,
        name: app.user.name,
        module,
        problemType,
        description,
        stepsToReproduce: steps,
        diagnostics,
      });
      setNotice(
        nl
          ? `Rapport verzonden (#${id.slice(-6).toUpperCase()}). ICT ontvangt de diagnostische gegevens.`
          : `Report submitted (#${id.slice(-6).toUpperCase()}). ICT received the diagnostics.`,
      );
      setDescription("");
      setSteps("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : nl
            ? "Rapport kon niet worden verstuurd."
            : "Report could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <AlertCircle />
      <h2>{nl ? "Een probleem melden" : "Report a Problem"}</h2>
      <p>
        {nl
          ? "Een technisch probleem? Vul het formulier in — AIMS hecht automatisch versie, route, browser en thema toe."
          : "Hit a technical issue? Fill in the form — AIMS attaches version, route, browser and theme automatically."}
      </p>
      <form className="workflow-form" onSubmit={submit}>
        <label>
          {nl ? "Module" : "Module"}
          <select
            value={module}
            onChange={(event) => setModule(event.target.value as ProblemModule)}
          >
            {MODULES.map((item) => (
              <option key={item.id} value={item.id}>
                {nl ? item.nl : item.en}
              </option>
            ))}
          </select>
        </label>
        <label>
          {nl ? "Type probleem" : "Problem type"}
          <select
            value={problemType}
            onChange={(event) =>
              setProblemType(event.target.value as ProblemType)
            }
          >
            {PROBLEM_TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {nl ? item.nl : item.en}
              </option>
            ))}
          </select>
        </label>
        <label>
          {nl ? "Omschrijving" : "Description"}
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={4}
            maxLength={4000}
          />
        </label>
        <label>
          {nl ? "Stappen om het te reproduceren" : "Steps to reproduce"}
          <textarea
            value={steps}
            onChange={(event) => setSteps(event.target.value)}
            rows={3}
            placeholder={nl ? "1. … 2. … 3. …" : "1. … 2. … 3. …"}
            maxLength={2000}
          />
        </label>
        <details
          className="problem-diagnostics"
          onToggle={(event) =>
            setShowDiagnostics(
              (event.currentTarget as HTMLDetailsElement).open,
            )
          }
        >
          <summary>
            {nl
              ? "Diagnostische gegevens die worden meegestuurd"
              : "Diagnostics that will be included"}
          </summary>
          {showDiagnostics && (
            <dl className="problem-diagnostics__list">
              <div>
                <dt>{nl ? "Versie" : "Version"}</dt>
                <dd>{diagnostics.version}</dd>
              </div>
              <div>
                <dt>{nl ? "Route" : "Route"}</dt>
                <dd>{diagnostics.route}</dd>
              </div>
              <div>
                <dt>{nl ? "Besturingssysteem" : "Operating system"}</dt>
                <dd>{diagnostics.os}</dd>
              </div>
              <div>
                <dt>{nl ? "Apparaat" : "Device"}</dt>
                <dd>{diagnostics.deviceType}</dd>
              </div>
              <div>
                <dt>{nl ? "Thema" : "Theme"}</dt>
                <dd>{diagnostics.theme}</dd>
              </div>
              <div>
                <dt>{nl ? "Taal" : "Language"}</dt>
                <dd>{diagnostics.language}</dd>
              </div>
              <div>
                <dt>User-Agent</dt>
                <dd>
                  <code>{diagnostics.userAgent}</code>
                </dd>
              </div>
            </dl>
          )}
        </details>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice success" role="status">
            {notice}
          </p>
        )}
        <Button disabled={busy}>
          <Send />
          {busy
            ? nl
              ? "Versturen…"
              : "Submitting…"
            : nl
              ? "Rapport versturen"
              : "Submit report"}
        </Button>
      </form>
    </Card>
  );
}
