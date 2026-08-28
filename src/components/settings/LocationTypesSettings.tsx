import { ArrowDown, ArrowUp, Edit3, Plus, Power, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge, Button, Field, TextAreaField } from "../ui";
import { ConfirmDialog, Dialog, MutationFeedback } from "../WorkflowUi";
import { useApp } from "../../context/AppContext";
import type { LocationType } from "../../data/contracts";
import { useMockSnapshot, useRepository } from "../../data/repositoryContext";

type Feedback = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};
export function LocationTypeForm({
  value,
  onSaved,
  onCancel,
}: {
  value?: LocationType;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const { language } = useApp(),
    nl = language === "nl",
    snapshot = useMockSnapshot(),
    repository = useRepository(),
    [feedback, setFeedback] = useState<Feedback>({
      status: "idle",
      message: "",
    });
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFeedback({
      status: "loading",
      message: nl ? "Locatietype opslaan…" : "Saving location type…",
    });
    const result = await repository.execute({
      action: value ? "locationType.edit" : "locationType.create",
      entityId: value?.id,
      values: {
        name: data.get("name"),
        code: data.get("code"),
        description: data.get("description"),
        allowedParentTypeIds: data.getAll("allowedParentTypeIds"),
      },
    });
    setFeedback({
      status: result.ok ? "success" : "error",
      message: result.message,
    });
    if (result.ok && result.entityId) onSaved(result.entityId);
  }
  return (
    <form className="workflow-form" onSubmit={save}>
      <Field
        name="name"
        label={nl ? "Naam" : "Name"}
        defaultValue={value?.name}
        required
      />
      <Field
        name="code"
        label={nl ? "Code" : "Code"}
        defaultValue={value?.code}
        required
      />
      <TextAreaField
        className="wide"
        name="description"
        label={nl ? "Omschrijving" : "Description"}
        defaultValue={value?.description}
      />
      <fieldset className="wide location-parent-types">
        <legend>
          {nl
            ? "Kies toegestane bovenliggende locatietypen"
            : "Choose allowed parent location types"}
        </legend>
        <p className="wide">
          {nl
            ? "Selecteer zelf de bovenliggende typen. Laat elke optie uitgevinkt wanneer dit een locatie op hoofdniveau/root moet zijn."
            : "Select the parent types yourself. Leave every option unchecked when this should be a top-level/root location."}
        </p>
        {snapshot.locationTypes
          .filter((x) => x.id !== value?.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((type) => (
            <label key={type.id}>
              <input
                type="checkbox"
                name="allowedParentTypeIds"
                value={type.id}
                defaultChecked={value?.allowedParentTypeIds.includes(type.id)}
              />
              {type.name} <small>({type.code})</small>
            </label>
          ))}
      </fieldset>
      <div className="wide">
        <MutationFeedback {...feedback} />
        <div className="actions">
          <Button type="submit">{nl ? "Type opslaan" : "Save type"}</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {nl ? "Annuleren" : "Cancel"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function LocationTypesSettings() {
  const { user, language } = useApp(),
    nl = language === "nl",
    repository = useRepository(),
    snapshot = useMockSnapshot(),
    [editing, setEditing] = useState<LocationType | null | undefined>(
      undefined,
    ),
    [deleting, setDeleting] = useState<LocationType | null>(null),
    [feedback, setFeedback] = useState<Feedback>({
      status: "idle",
      message: "",
    });
  if (!user)
    return (
      <div className="state">
        <h3>{nl ? "Toegang voor IT-medewerker vereist" : "IT member access required"}</h3>
        <p>
          {nl
            ? "Meld u aan met uw KCS IT-account om locatietypen te beheren."
            : "Sign in with your KCS IT account to manage location types."}
        </p>
      </div>
    );
  const types = [...snapshot.locationTypes].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  async function run(
    action:
      | "locationType.activate"
      | "locationType.deactivate"
      | "locationType.reorder"
      | "locationType.delete",
    type: LocationType,
    values?: Record<string, unknown>,
  ) {
    const result = await repository.execute({
      action,
      entityId: type.id,
      values,
    });
    setFeedback({
      status: result.ok ? "success" : "error",
      message: result.message,
    });
  }
  return (
    <div className="location-types-settings">
      <div className="section-toolbar">
        <div>
          <h3>{nl ? "Locatietypen" : "Location types"}</h3>
          <p>
            {nl
              ? "Beheer hiërarchieniveaus en hun toegestane bovenliggende typen."
              : "Control hierarchy levels and their permitted parents."}
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus />
          {nl ? "Type toevoegen" : "Add type"}
        </Button>
      </div>
      <label className="hierarchy-mode">
        <span>
          <strong>{nl ? "Hiërarchievalidatie" : "Hierarchy validation"}</strong>
          <small>
            {nl
              ? "Controleert of een sublocatie onder het juiste type hoofdlocatie wordt geplaatst. Strikt blokkeert fouten, Waarschuwing meldt ze zonder blokkering en Uitgeschakeld slaat de controle over."
              : "Checks whether a sub-location is placed under the correct main location type. Strict blocks errors, Warning reports them without blocking and Disabled skips the check."}
          </small>
        </span>
        <select
          value={snapshot.systemSettings.hierarchyValidationMode}
          onChange={async (event) => {
            const result = await repository.execute({
              action: "settings.hierarchyValidation",
              values: { mode: event.target.value },
            });
            setFeedback({
              status: result.ok ? "success" : "error",
              message: result.message,
            });
          }}
        >
          <option value="strict">{nl ? "Strikt" : "Strict"}</option>
          <option value="warning">
            {nl ? "Waarschuwing (standaard)" : "Warning (default)"}
          </option>
          <option value="disabled">
            {nl ? "Uitgeschakeld" : "Disabled"}
          </option>
        </select>
      </label>
      <MutationFeedback {...feedback} />
      <div className="location-type-list">
        {types.map((type, index) => {
          const used = snapshot.references.some(
            (x) =>
              x.kind === "location" &&
              (x.typeId === type.id || (!x.typeId && x.type === type.name)),
          );
          return (
            <article key={type.id}>
              <span className="location-type-order">{type.sortOrder}</span>
              <div>
                <strong>
                  {type.name} <code>{type.code}</code>
                </strong>
                <small>
                  {type.description || (nl ? "Geen omschrijving" : "No description")}
                </small>
                <small>
                  {nl ? "Bovenliggend:" : "Parents:"}{" "}
                  {type.allowedParentTypeIds.length
                    ? type.allowedParentTypeIds
                        .map(
                          (id) =>
                            snapshot.locationTypes.find((x) => x.id === id)
                              ?.name || id,
                        )
                        .join(", ")
                    : nl
                      ? "Geen (roottype)"
                      : "None (root type)"}
                </small>
              </div>
              <Badge tone={type.isActive ? "success" : "neutral"}>
                {type.isActive
                  ? nl
                    ? "Actief"
                    : "Active"
                  : nl
                    ? "Inactief"
                    : "Inactive"}
              </Badge>
              <div className="location-type-actions">
                <Button
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() =>
                    run("locationType.reorder", type, { direction: -1 })
                  }
                  aria-label={
                    nl ? `${type.name} omhoog verplaatsen` : `Move ${type.name} up`
                  }
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  disabled={index === types.length - 1}
                  onClick={() =>
                    run("locationType.reorder", type, { direction: 1 })
                  }
                  aria-label={
                    nl
                      ? `${type.name} omlaag verplaatsen`
                      : `Move ${type.name} down`
                  }
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setEditing(type)}
                  aria-label={
                    nl ? `${type.name} bewerken` : `Edit ${type.name}`
                  }
                >
                  <Edit3 />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    run(
                      type.isActive
                        ? "locationType.deactivate"
                        : "locationType.activate",
                      type,
                    )
                  }
                  aria-label={
                    nl
                      ? `${type.name} ${type.isActive ? "deactiveren" : "activeren"}`
                      : `${type.isActive ? "Deactivate" : "Activate"} ${type.name}`
                  }
                >
                  <Power />
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setDeleting(type)}
                  aria-label={
                    nl ? `${type.name} verwijderen` : `Delete ${type.name}`
                  }
                  title={
                    used
                      ? nl
                        ? "Gebruikte typen kunnen niet worden verwijderd; deactiveer ze in plaats daarvan."
                        : "Used types cannot be deleted; deactivate instead."
                      : nl
                        ? "Type verwijderen"
                        : "Delete type"
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <Dialog
        open={editing !== undefined}
        title={
          editing
            ? nl
              ? "Locatietype bewerken"
              : "Edit location type"
            : nl
              ? "Locatietype toevoegen"
              : "Add location type"
        }
        description={
          nl
            ? "Definieer het type en welke hiërarchieniveaus het mogen bevatten."
            : "Define the type and which hierarchy levels may contain it."
        }
        onClose={() => setEditing(undefined)}
      >
        {editing !== undefined && (
          <LocationTypeForm
            value={editing || undefined}
            onCancel={() => setEditing(undefined)}
            onSaved={() => setEditing(undefined)}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        title={nl ? "Locatietype verwijderen" : "Delete location type"}
        description={
          deleting &&
          snapshot.references.some(
            (x) =>
              x.kind === "location" &&
              (x.typeId === deleting.id ||
                (!x.typeId && x.type === deleting.name)),
          )
            ? nl
              ? "Dit type is in gebruik en kan niet worden verwijderd. Deactiveer het in plaats daarvan."
              : "This type is in use and cannot be deleted. Deactivate it instead."
            : nl
              ? "Hiermee wordt het locatietype definitief verwijderd."
              : "This permanently removes the location type."
        }
        confirmLabel={nl ? "Verwijderen" : "Delete"}
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await run("locationType.delete", deleting);
        }}
      />
    </div>
  );
}
