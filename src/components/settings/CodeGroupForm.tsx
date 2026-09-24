import { useState, type FormEvent } from "react";
import { Button, Field } from "../ui";
import { MutationFeedback } from "../WorkflowUi";
import { useApp } from "../../context/AppContext";
import { useMockSnapshot, useRepository } from "../../data/repositoryContext";
import type { CodeGroup } from "../../data/contracts";

// Code groups are unlimited: there is no minimum/maximum/range to configure
// here. "Volgende beschikbare code" is informational only, always derived
// from what has ever been issued for this prefix — never a manual input.
export function CodeGroupForm({
  onSaved,
  onCancel,
  group,
}: {
  onSaved: (id: string) => void;
  onCancel: () => void;
  group?: CodeGroup | null;
}) {
  const { language, formatDateTime } = useApp();
  const nl = language === "nl";
  const repository = useRepository();
  const snapshot = useMockSnapshot();
  const [feedback, setFeedback] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const [busy, setBusy] = useState(false);

  // Submit controlled state, not a stale dialog FormData snapshot.
  const [name, setName] = useState(group?.name || "");
  const [currentPrefix, setCurrentPrefix] = useState(group?.prefix || "");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);

    const trimmedName = name.trim();
    const prefix = currentPrefix.trim().toUpperCase();

    if (!trimmedName || !prefix) {
      setFeedback({
        status: "error",
        message: nl
          ? "Naam en code zijn verplicht."
          : "Name and code are required.",
      });
      setBusy(false);
      return;
    }

    const normalizedName = trimmedName.toLowerCase().replace(/\s+/g, " ");
    const normalizedPrefix = prefix.toLowerCase();
    const duplicateName = snapshot.codeGroups.find(
      (x) =>
        x.name.trim().toLowerCase().replace(/\s+/g, " ") === normalizedName &&
        x.id !== group?.id,
    );
    if (duplicateName) {
      setFeedback({
        status: "error",
        message: nl ? "Codegroep bestaat al." : "Code group already exists.",
      });
      setBusy(false);
      return;
    }
    const duplicatePrefix = snapshot.codeGroups.find(
      (x) =>
        x.prefix.trim().toLowerCase() === normalizedPrefix &&
        x.id !== group?.id,
    );
    if (duplicatePrefix) {
      setFeedback({
        status: "error",
        message: nl
          ? "Codeprefix bestaat al."
          : "Code prefix already exists.",
      });
      setBusy(false);
      return;
    }

    setFeedback({ status: "loading", message: nl ? "Opslaan..." : "Saving..." });

    const result = await repository.execute({
      action: group ? "codeGroup.edit" : "codeGroup.create",
      entityId: group?.id,
      values: { name: trimmedName, prefix },
    });

    setFeedback({
      status: result.ok ? "success" : "error",
      message: result.ok
        ? group
          ? nl
            ? "Codegroep succesvol bijgewerkt."
            : "Code group successfully updated."
          : nl
            ? "Codegroep succesvol toegevoegd."
            : "Code group successfully added."
        : nl && result.message === "Code group already exists."
          ? "Codegroep bestaat al."
          : nl && result.message === "Code prefix already exists."
            ? "Codeprefix bestaat al."
            : result.message,
    });
    setBusy(false);

    if (result.ok && result.entityId) {
      onSaved(result.entityId);
    } else if (result.ok && group?.id) {
      onSaved(group.id);
    }
  }

  return (
    <form className="workflow-form" onSubmit={save}>
      <Field
        name="name"
        label={nl ? "Naam codegroep" : "Code group name"}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        disabled={busy}
      />
      <Field
        name="prefix"
        label={nl ? "Codeprefix" : "Code prefix"}
        value={currentPrefix}
        onChange={(e) => setCurrentPrefix(e.target.value.toUpperCase())}
        pattern="[A-Za-z0-9]{1,16}"
        maxLength={16}
        required
        disabled={busy}
      />
      {group && currentPrefix.trim().toUpperCase() !== group.prefix && (
        <p className="field wide" style={{ marginTop: "0.5rem", marginBottom: "1rem", fontSize: "0.85em", color: "var(--color-text-dim)" }}>
          {nl
            ? "Let op: bij een gewijzigde prefix worden bestaande codes van middelen die aan deze codegroep gekoppeld zijn automatisch aangepast (oude code blijft bewaard als vorige code) en geüpdatet."
            : "Note: changing the prefix automatically rewrites the inventory codes of every asset linked to this code group (the old code is kept as a previous code) and updates linked categories."}
        </p>
      )}
\n\n      {group && (
        <p className="record-audit" style={{ marginTop: "1rem" }}>
          <small>
            {nl ? "Toegevoegd" : "Added"}: {group.createdBy || "—"} ·{" "}
            {group.createdAt ? formatDateTime(group.createdAt) : "—"}
            {group.archivedBy
              ? ` · ${nl ? "Verwijderd" : "Deleted"}: ${
                  group.archivedBy
                } · ${formatDateTime(group.archivedAt || group.updatedAt)}`
              : group.updatedBy
                ? ` · ${nl ? "Gewijzigd" : "Updated"}: ${
                    group.updatedBy
                  } · ${formatDateTime(group.updatedAt)}`
                : ""}
          </small>
        </p>
      )}

      <div className="wide">
        <MutationFeedback {...feedback} />
        <div className="actions">
          <Button type="submit" disabled={busy}>
            {nl ? "Opslaan" : "Save"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {nl ? "Annuleren" : "Cancel"}
          </Button>
        </div>
      </div>
    </form>
  );
}
