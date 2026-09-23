import { useState, type FormEvent } from "react";
import { Button, Field, SelectField } from "../ui";
import { MutationFeedback } from "../WorkflowUi";
import { useApp } from "../../context/AppContext";
import { useMockSnapshot, useRepository } from "../../data/repositoryContext";
import type { ReferenceRecord } from "../../data/contracts";

export function MainLocationForm({
  onSaved,
  onCancel,
  editing,
}: {
  onSaved: (id: string) => void;
  onCancel: () => void;
  editing?: ReferenceRecord | null;
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

  async function saveMainLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);

    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const prefix = String(data.get("prefix") || "")
      .trim()
      .toUpperCase();
    const status = String(data.get("status") || "Active");

    if (!name) {
      setFeedback({
        status: "error",
        message: nl ? "Naam is verplicht." : "Name is required.",
      });
      setBusy(false);
      return;
    }

    // Duplicate check — normalize whitespace so "KCS Onderbouw",
    // "kcs onderbouw" and "KCS  Onderbouw" are all treated as the same name.
    const existingMainLocations = snapshot.references.filter(
      (x) => x.kind === "location" && x.type === "Main location"
    );
    const normalize = (value: string) =>
      value.trim().toLowerCase().replace(/\s+/g, " ");
    const normalizedName = normalize(name);

    const duplicateName = existingMainLocations.find(
      (x) => normalize(x.name) === normalizedName && x.id !== editing?.id
    );
    if (duplicateName) {
      setFeedback({
        status: "error",
        message: nl
          ? "Hoofdlocatie bestaat al."
          : "Main location already exists.",
      });
      setBusy(false);
      return;
    }

    const duplicatePrefix =
      prefix &&
      existingMainLocations.find(
        (x) =>
          String(x.details.prefix || "").toLowerCase() ===
            prefix.toLowerCase() && x.id !== editing?.id
      );
    if (duplicatePrefix) {
      setFeedback({
        status: "error",
        message: nl
          ? "Deze locatiecode wordt al gebruikt."
          : "This location code is already in use.",
      });
      setBusy(false);
      return;
    }

    setFeedback({ status: "loading", message: nl ? "Opslaan..." : "Saving..." });

    const result = await repository.execute({
      action: editing ? "reference.edit" : "reference.create",
      entityId: editing?.id,
      values: {
        kind: "location",
        name,
        type: "Main location",
        typeId: editing?.typeId || "main-location",
        status: status,
        details: {
          ...(editing?.details || {}),
          manuallyCreated: true,
          prefix,
        },
      },
    });

    setFeedback({
      status: result.ok ? "success" : "error",
      message: result.ok
        ? editing
          ? nl
            ? "Hoofdlocatie succesvol bijgewerkt."
            : "Main location successfully updated."
          : nl
            ? "Hoofdlocatie succesvol toegevoegd."
            : "Main location successfully added."
        : nl && result.message === "Main location already exists."
          ? "Hoofdlocatie bestaat al."
          : result.message,
    });
    setBusy(false);

    if (result.ok && result.entityId) {
      onSaved(result.entityId);
    } else if (result.ok && editing?.id) {
      onSaved(editing.id);
    }
  }

  return (
    <form className="workflow-form" onSubmit={saveMainLocation}>
      <Field
        name="name"
        label={nl ? "Naam hoofdlocatie" : "Main location name"}
        defaultValue={editing?.name}
        required
        disabled={busy}
      />
      <Field
        name="prefix"
        label={nl ? "Locatiecode (optioneel)" : "Location code (optional)"}
        defaultValue={String(editing?.details.prefix || "")}
        maxLength={20}
        disabled={busy}
      />
      <SelectField
        name="status"
        label="Status"
        defaultValue={editing?.status || "Active"}
        disabled={busy}
      >
        <option value="Active">{nl ? "Actief" : "Active"}</option>
        <option value="Archived">{nl ? "Inactief" : "Inactive"}</option>
      </SelectField>

      <div className="wide">
        <MutationFeedback {...feedback} />
        <div className="actions">
          <Button type="submit" disabled={busy}>
            {editing
              ? nl
                ? "Wijzigingen opslaan"
                : "Save changes"
              : nl
              ? "Opslaan"
              : "Save"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {nl ? "Annuleren" : "Cancel"}
          </Button>
        </div>
      </div>
    </form>
  );
}

