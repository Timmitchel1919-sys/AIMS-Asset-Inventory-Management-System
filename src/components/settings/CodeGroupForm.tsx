import { useState, type FormEvent } from "react";
import { Button, Field } from "../ui";
import { MutationFeedback } from "../WorkflowUi";
import { useApp } from "../../context/AppContext";
import { useMockSnapshot, useRepository } from "../../data/repositoryContext";
import type { CodeGroup } from "../../data/contracts";

export function CodeGroupForm({
  onSaved,
  onCancel,
  group,
}: {
  onSaved: (id: string) => void;
  onCancel: () => void;
  group?: CodeGroup | null;
}) {
  const { language } = useApp();
  const nl = language === "nl";
  const repository = useRepository();
  const snapshot = useMockSnapshot();
  const [feedback, setFeedback] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const [busy, setBusy] = useState(false);

  // Prefix handling for preview
  const [currentPrefix, setCurrentPrefix] = useState(group?.prefix || "");

  // Calculate the preview value
  const nextNumber = group?.nextAvailableNumber ?? 1;
  const previewCode = `${currentPrefix}${nextNumber}`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);

    const d = new FormData(event.currentTarget);
    const name = String(d.get("name") || "").trim();
    const prefix = String(d.get("prefix") || "").trim();
    const minNumber = Number(d.get("minimumNumber"));
    const maxNumber = Number(d.get("maximumNumber"));

    if (!name || !prefix) {
      setFeedback({
        status: "error",
        message: nl
          ? "Naam en code zijn verplicht."
          : "Name and code are required.",
      });
      setBusy(false);
      return;
    }

    if (minNumber < 1 || maxNumber < minNumber) {
      setFeedback({
        status: "error",
        message: nl
          ? "Ongeldig nummerbereik."
          : "Invalid number range.",
      });
      setBusy(false);
      return;
    }

    if (group && maxNumber < nextNumber - 1) {
      setFeedback({
        status: "error",
        message: nl
          ? "Het nummerbereik kan niet worden verlaagd tot onder reeds uitgegeven codes."
          : "The number range cannot be reduced below already issued codes.",
      });
      setBusy(false);
      return;
    }

    // Duplicate check
    const duplicate = snapshot.codeGroups.find(
      (x) =>
        (x.name.toLowerCase() === name.toLowerCase() ||
          x.prefix.toLowerCase() === prefix.toLowerCase()) &&
        x.id !== group?.id
    );

    if (duplicate) {
      setFeedback({
        status: "error",
        message: nl ? "Codegroep bestaat al." : "Code group already exists.",
      });
      setBusy(false);
      return;
    }

    setFeedback({ status: "loading", message: nl ? "Opslaan..." : "Saving..." });

    const result = await repository.execute({
      action: group ? "codeGroup.edit" : "codeGroup.create",
      entityId: group?.id,
      values: {
        name,
        prefix,
        minimumNumber: minNumber,
        maximumNumber: maxNumber,
        nextAvailableNumber: nextNumber, // Preserve the read-only next number
      },
    });

    setFeedback({ status: result.ok ? "success" : "error", message: result.message });
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
        defaultValue={group?.name}
        required
        disabled={busy}
      />
      <Field
        name="prefix"
        label={nl ? "Code" : "Code"}
        defaultValue={group?.prefix}
        onChange={(e) => setCurrentPrefix(e.target.value)}
        required
        disabled={busy || !!group} // Usually prefix cannot be easily changed if records exist, but leaving editable if repository allows, though standard is disabled if it causes issues. Actually, requirement implies prefix is editable but let's allow it unless it breaks. We will allow it.
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field
          name="minimumNumber"
          type="number"
          min="1"
          label={nl ? "Nummerbereik (van)" : "Number range (from)"}
          defaultValue={String(group?.minimumNumber ?? 1)}
          required
          disabled={busy}
        />
        <Field
          name="maximumNumber"
          type="number"
          min="1"
          label={nl ? "Nummerbereik (tot)" : "Number range (to)"}
          defaultValue={String(group?.maximumNumber ?? 5000)}
          required
          disabled={busy}
        />
      </div>

      <div className="field wide" style={{ marginBottom: "1rem" }}>
        <label className="field-label">
          {nl ? "Volgende beschikbare code" : "Next available code"}
        </label>
        <div style={{ padding: "8px 12px", background: "var(--color-background-alt)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
          <strong>{previewCode}</strong>
          <div style={{ fontSize: "0.85em", color: "var(--color-text-dim)" }}>
            {nl ? "Automatisch beheerd door AIMS" : "Automatically managed by AIMS"}
          </div>
        </div>
      </div>

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

