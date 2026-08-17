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
  const snapshot = useMockSnapshot(),
    repository = useRepository(),
    [feedback, setFeedback] = useState<Feedback>({
      status: "idle",
      message: "",
    });
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFeedback({ status: "loading", message: "Saving location type…" });
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
      <Field name="name" label="Name" defaultValue={value?.name} required />
      <Field name="code" label="Code" defaultValue={value?.code} required />
      <TextAreaField
        className="wide"
        name="description"
        label="Description"
        defaultValue={value?.description}
      />
      <fieldset className="wide location-parent-types">
        <legend>Choose allowed parent location types</legend>
        <p className="wide">
          Select the parent types yourself. Leave every option unchecked when
          this should be a top-level/root location.
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
          <Button type="submit">Save type</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

export function LocationTypesSettings() {
  const { user } = useApp(),
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
        <h3>IT member access required</h3>
        <p>Sign in with your KCS IT account to manage location types.</p>
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
          <h3>Location types</h3>
          <p>Control hierarchy levels and their permitted parents.</p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus />
          Add type
        </Button>
      </div>
      <label className="hierarchy-mode">
        <span><strong>Hierarchy validation</strong><small>Strict blocks configured type mismatches; warning allows them; disabled skips type checks.</small></span>
        <select value={snapshot.systemSettings.hierarchyValidationMode} onChange={async event=>{const result=await repository.execute({action:"settings.hierarchyValidation",values:{mode:event.target.value}});setFeedback({status:result.ok?"success":"error",message:result.message})}}>
          <option value="strict">Strict</option><option value="warning">Warning (default)</option><option value="disabled">Disabled</option>
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
                <small>{type.description || "No description"}</small>
                <small>
                  Parents:{" "}
                  {type.allowedParentTypeIds.length
                    ? type.allowedParentTypeIds
                        .map(
                          (id) =>
                            snapshot.locationTypes.find((x) => x.id === id)
                              ?.name || id,
                        )
                        .join(", ")
                    : "None (root type)"}
                </small>
              </div>
              <Badge tone={type.isActive ? "success" : "neutral"}>
                {type.isActive ? "Active" : "Inactive"}
              </Badge>
              <div className="location-type-actions">
                <Button
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() =>
                    run("locationType.reorder", type, { direction: -1 })
                  }
                  aria-label={`Move ${type.name} up`}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  disabled={index === types.length - 1}
                  onClick={() =>
                    run("locationType.reorder", type, { direction: 1 })
                  }
                  aria-label={`Move ${type.name} down`}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setEditing(type)}
                  aria-label={`Edit ${type.name}`}
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
                  aria-label={`${type.isActive ? "Deactivate" : "Activate"} ${type.name}`}
                >
                  <Power />
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setDeleting(type)}
                  aria-label={`Delete ${type.name}`}
                  title={
                    used
                      ? "Used types cannot be deleted; deactivate instead."
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
        title={editing ? "Edit location type" : "Add location type"}
        description="Define the type and which hierarchy levels may contain it."
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
        title="Delete location type"
        description={
          deleting &&
          snapshot.references.some(
            (x) =>
              x.kind === "location" &&
              (x.typeId === deleting.id ||
                (!x.typeId && x.type === deleting.name)),
          )
            ? "This type is in use and cannot be deleted. Deactivate it instead."
            : "This permanently removes the location type."
        }
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await run("locationType.delete", deleting);
        }}
      />
    </div>
  );
}
