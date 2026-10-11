import { useState, type FormEvent } from "react";
import { Button, Field } from "../ui";
import { MutationFeedback } from "../WorkflowUi";
import { useApp } from "../../context/AppContext";
import { useMockSnapshot, useRepository } from "../../data/repositoryContext";
import type { Assignment } from "../../data/contracts";

/**
 * Hand an active assignment over to another person from Assignment Management.
 * It uses the same path as editing the assignee on the asset itself: the old
 * assignment is returned (and stays in the history) and one new assignment
 * starts, so the asset and the assignment list can never disagree.
 */
export function AssignmentHandover({ assignment, onDone }: { assignment: Assignment; onDone: () => void }) {
  const { language } = useApp();
  const nl = language === "nl";
  const snapshot = useMockSnapshot();
  const repository = useRepository();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ status: "idle" | "loading" | "success" | "error"; message: string }>({ status: "idle", message: "" });
  const listId = `handover-users-${assignment.id}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = String(new FormData(event.currentTarget).get("assignee") || "").trim();
    if (!next || next.toLowerCase() === assignment.assignee.trim().toLowerCase()) {
      setFeedback({
        status: "error",
        message: nl ? "Kies een andere persoon dan de huidige." : "Choose a person other than the current one.",
      });
      return;
    }
    setBusy(true);
    setFeedback({ status: "loading", message: nl ? "Overdragen…" : "Handing over…" });
    const result = await repository.execute({
      action: "asset.edit",
      entityId: assignment.assetId,
      values: { assignedTo: next },
    });
    setBusy(false);
    setFeedback({
      status: result.ok ? "success" : "error",
      message: result.ok ? (nl ? `Overgedragen aan ${next}.` : `Handed over to ${next}.`) : result.message,
    });
    if (result.ok) onDone();
  }

  return (
    <form className="workflow-form" onSubmit={submit} aria-label={nl ? "Overdragen aan een andere gebruiker" : "Hand over to another user"}>
      <Field name="assignee" label={nl ? "Overdragen aan" : "Hand over to"} list={listId} required />
      <datalist id={listId}>
        {snapshot.users.filter((user) => user.status === "Active").map((user) => <option key={user.id} value={user.name} />)}
      </datalist>
      <Button type="submit" variant="secondary" disabled={busy}>
        {nl ? "Overdragen" : "Hand over"}
      </Button>
      <MutationFeedback {...feedback} />
    </form>
  );
}
