import { useState, type FormEvent } from "react";
import { Badge, Button, Field, SelectField, TextAreaField } from "../ui";
import { MutationFeedback } from "../WorkflowUi";
import { useApp } from "../../context/AppContext";
import { useMockSnapshot, useRepository } from "../../data/repositoryContext";
import { ASSET_CONDITIONS } from "../../domain/assetCondition";
import { allowedStatusTargets } from "../../domain/assetStatusTransitions";
import {
  CORRECTION_FIELDS,
  type Audit,
  type CorrectiveAction,
  type CorrectiveProposedChange,
} from "../../domain/types";
import { useT } from "../../i18n";

const COPY = {
  nl: {
    title: "Afwijkingen en correcties",
    intro:
      "Een afwijking past de assetgegevens nooit automatisch aan. Een wijziging gebeurt pas na een voorstel, beoordeling en goedkeuring.",
    none: "Geen afwijkingen vastgelegd voor deze controle.",
    expected: "Systeem",
    observed: "Werkelijk",
    propose: "Correctie voorstellen",
    field: "Wat moet worden gecorrigeerd",
    value: "Nieuwe waarde",
    reason: "Onderbouwing (verplicht)",
    submit: "Voorstel indienen voor beoordeling",
    cancel: "Annuleren",
    pending: "Wacht op beoordeling",
    approve: "Goedkeuren",
    reject: "Afwijzen",
    apply: "Goedgekeurde correctie toepassen",
    confirmApply: (text: string) => `Deze correctie wijzigt de assetgegevens definitief:\n\n${text}\n\nToepassen?`,
    applied: "Toegepast",
    close: "Afwijking sluiten",
    proposedBy: "Voorgesteld door",
    fields: { location: "Locatie", assignedTo: "Toegewezen aan", condition: "Conditie", status: "Status" } as Record<CorrectiveProposedChange["field"], string>,
    states: { Open: "Open", Resolved: "Opgelost", Closed: "Gesloten" } as Record<string, string>,
    proposedNote: "Voorstel dient te worden goedgekeurd voordat er iets verandert.",
    selectValue: "Kies…",
  },
  en: {
    title: "Discrepancies and corrections",
    intro:
      "A discrepancy never changes the asset records automatically. A change happens only after a proposal, review and approval.",
    none: "No discrepancies recorded for this control.",
    expected: "System",
    observed: "Actual",
    propose: "Propose correction",
    field: "What should be corrected",
    value: "New value",
    reason: "Justification (required)",
    submit: "Submit proposal for review",
    cancel: "Cancel",
    pending: "Awaiting review",
    approve: "Approve",
    reject: "Reject",
    apply: "Apply approved correction",
    confirmApply: (text: string) => `This correction permanently changes the asset record:\n\n${text}\n\nApply it?`,
    applied: "Applied",
    close: "Close discrepancy",
    proposedBy: "Proposed by",
    fields: { location: "Location", assignedTo: "Assigned to", condition: "Condition", status: "Status" } as Record<CorrectiveProposedChange["field"], string>,
    states: { Open: "Open", Resolved: "Resolved", Closed: "Closed" } as Record<string, string>,
    proposedNote: "The proposal must be approved before anything changes.",
    selectValue: "Select…",
  },
} as const;

const tone = (status: string) =>
  status === "Resolved" || status === "Closed" ? "success" : status === "Open" ? "warning" : "info";

export function AuditDiscrepancyPanel({ audit }: { audit: Audit }) {
  const { language } = useApp();
  const t = useT();
  const c = language === "nl" ? COPY.nl : COPY.en;
  const snapshot = useMockSnapshot();
  const repository = useRepository();
  const [proposing, setProposing] = useState<string | null>(null);
  const [field, setField] = useState<CorrectiveProposedChange["field"]>("condition");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ status: "idle" | "loading" | "success" | "error"; message: string }>({ status: "idle", message: "" });

  const discrepancies = snapshot.auditDiscrepancies.filter((item) => item.auditId === audit.id);
  const actionsOf = (discrepancyId: string) =>
    snapshot.correctiveActions.filter((item) => item.discrepancyId === discrepancyId);
  const locations = snapshot.references.filter((item) => item.kind === "location" && item.status === "Active");

  async function run(steps: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true);
    setFeedback({ status: "loading", message: "…" });
    const result = await steps();
    setFeedback({ status: result.ok ? "success" : "error", message: result.message });
    setBusy(false);
    return result.ok;
  }

  async function submitProposal(event: FormEvent<HTMLFormElement>, discrepancyId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const proposedValue = String(data.get("value") || "").trim();
    const description = String(data.get("reason") || "").trim();
    const ok = await run(async () => {
      const created = await repository.execute({
        action: "corrective.create",
        entityId: discrepancyId,
        values: { proposedField: field, proposedValue, description, type: "Correct record" },
      });
      if (!created.ok) return created;
      // Hand it straight to review: start, then complete (-> Pending Approval).
      const started = await repository.execute({ action: "corrective.start", entityId: created.entityId });
      if (!started.ok) return started;
      return repository.execute({ action: "corrective.complete", entityId: created.entityId });
    });
    if (ok) setProposing(null);
  }

  const describeChange = (action: CorrectiveAction) => {
    const change = action.proposedChange;
    if (!change) return action.description;
    const value =
      change.field === "location"
        ? snapshot.references.find((item) => item.id === change.value)?.name ?? change.value
        : change.field === "status"
          ? t(`status.${change.value}`)
          : change.value;
    return `${c.fields[change.field]} → ${value}`;
  };

  return (
    <section className="audit-discrepancies" aria-labelledby="audit-discrepancies-title">
      <h3 id="audit-discrepancies-title">{c.title}</h3>
      <p className="field-hint">{c.intro}</p>
      {!discrepancies.length && <p>{c.none}</p>}
      {discrepancies.map((discrepancy) => {
        const asset = snapshot.assets.find((item) => item.id === discrepancy.recordId);
        const actions = actionsOf(discrepancy.id);
        const open = !["Resolved", "Closed"].includes(discrepancy.status);
        const active = actions.find((item) => !["Rejected", "Cancelled", "Closed"].includes(item.status));
        return (
          <article key={discrepancy.id} className="card audit-discrepancy">
            <header>
              <strong>{discrepancy.reference}</strong> · {asset?.code ?? discrepancy.recordName}{" "}
              <Badge tone={tone(discrepancy.status)}>{c.states[discrepancy.status] ?? discrepancy.status}</Badge>
            </header>
            <p>
              {discrepancy.type}: {c.expected}: <b>{discrepancy.expectedValue || "—"}</b> · {c.observed}: <b>{discrepancy.observedValue || "—"}</b>
            </p>
            {actions.map((action) => (
              <div key={action.id} className="audit-correction">
                <p>
                  <b>{action.reference}</b> — {describeChange(action)} <Badge tone={action.status === "Pending Approval" ? "warning" : "info"}>{action.status === "Pending Approval" ? c.pending : action.status === "Completed" ? c.applied : action.status}</Badge>
                </p>
                {action.proposedChange && <small>{action.description} · {c.proposedBy}: {action.proposedBy}</small>}
                {action.appliedChange && <small>{action.result}</small>}
                <div className="actions">
                  {action.status === "Pending Approval" && (
                    <>
                      <Button type="button" disabled={busy} onClick={() => run(() => repository.execute({ action: "corrective.approve", entityId: action.id }))}>{c.approve}</Button>
                      <Button type="button" variant="secondary" disabled={busy} onClick={() => run(() => repository.execute({ action: "corrective.reject", entityId: action.id }))}>{c.reject}</Button>
                    </>
                  )}
                  {action.status === "Approved" && action.proposedChange && (
                    <Button
                      type="button"
                      variant="danger"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(c.confirmApply(`${asset?.code ?? ""} — ${describeChange(action)}`)))
                          void run(() => repository.execute({ action: "corrective.apply", entityId: action.id }));
                      }}
                    >
                      {c.apply}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {open && !active && asset && proposing !== discrepancy.id && (
              <Button type="button" variant="secondary" onClick={() => { setProposing(discrepancy.id); setField("condition"); }}>{c.propose}</Button>
            )}
            {proposing === discrepancy.id && asset && (
              <form className="workflow-form" onSubmit={(event) => submitProposal(event, discrepancy.id)}>
                <SelectField label={c.field} value={field} onChange={(event) => setField(event.target.value as CorrectiveProposedChange["field"])}>
                  {CORRECTION_FIELDS.map((value) => <option key={value} value={value}>{c.fields[value]}</option>)}
                </SelectField>
                {field === "location" && (
                  <SelectField name="value" label={c.value} required defaultValue="">
                    <option value="">{c.selectValue}</option>
                    {locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </SelectField>
                )}
                {field === "condition" && (
                  <SelectField name="value" label={c.value} required defaultValue="">
                    <option value="">{c.selectValue}</option>
                    {ASSET_CONDITIONS.filter((value) => value !== asset.condition).map((value) => <option key={value} value={value}>{t(`condition.${value}`)}</option>)}
                  </SelectField>
                )}
                {field === "status" && (
                  <SelectField name="value" label={c.value} required defaultValue="">
                    <option value="">{c.selectValue}</option>
                    {allowedStatusTargets(asset.status).map((value) => <option key={value} value={value}>{t(`status.${value}`)}</option>)}
                  </SelectField>
                )}
                {field === "assignedTo" && (
                  <>
                    <Field name="value" label={c.value} required list={`users-${discrepancy.id}`} />
                    <datalist id={`users-${discrepancy.id}`}>{snapshot.users.map((user) => <option key={user.id} value={user.name} />)}</datalist>
                  </>
                )}
                <TextAreaField name="reason" className="wide" label={c.reason} required minLength={3} />
                <p className="field-hint wide">{c.proposedNote}</p>
                <div className="actions wide">
                  <Button type="submit" disabled={busy}>{c.submit}</Button>
                  <Button type="button" variant="ghost" onClick={() => setProposing(null)}>{c.cancel}</Button>
                </div>
              </form>
            )}
            {discrepancy.status === "Resolved" && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => run(() => repository.execute({ action: "discrepancy.close", entityId: discrepancy.id }))}>{c.close}</Button>
            )}
          </article>
        );
      })}
      <MutationFeedback {...feedback} />
    </section>
  );
}
