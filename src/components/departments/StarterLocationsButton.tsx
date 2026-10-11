import { MapPinPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui";
import { ConfirmDialog, MutationFeedback } from "../WorkflowUi";
import { useApp } from "../../context/AppContext";
import { applyStarterLocations } from "../../data/starterLocations";
import { useMockSnapshot, useRepository } from "../../data/repositoryContext";
import {
  STARTER_DEPARTMENTS,
  planStarterLocations,
  starterPlanIsEmpty,
} from "../../domain/starterLocations";

/**
 * Adds the Hoofdlocatie "Kangoeroe High" (when missing, so it shows up in the
 * Hoofdlocatie dropdown of the department form) and the classrooms
 * "Lokaal 3" - "Lokaal 16" under it. Only gaps are filled; running it again
 * changes nothing.
 */
export function StarterLocationsButton() {
  const { language } = useApp();
  const nl = language === "nl";
  const snapshot = useMockSnapshot();
  const repository = useRepository();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ status: "idle" | "loading" | "success" | "error"; message: string }>({ status: "idle", message: "" });
  const plan = planStarterLocations(snapshot.references);
  const first = STARTER_DEPARTMENTS[0];
  const last = STARTER_DEPARTMENTS[STARTER_DEPARTMENTS.length - 1];
  const nothingToDo = starterPlanIsEmpty(plan) && !plan.mainInactive && !plan.noFreeCode;

  const description = nl
    ? [
        plan.createMain ? `Hoofdlocatie "${plan.createMain.name}" (code ${plan.createMain.code}) wordt aangemaakt. ` : "Hoofdlocatie Kangoeroe High bestaat al. ",
        `${plan.create.length} afdeling(en) worden toegevoegd (${first} t/m ${last})`,
        plan.existing.length ? `; ${plan.existing.length} bestaan al en blijven ongewijzigd.` : ".",
      ].join("")
    : [
        plan.createMain ? `Main location "${plan.createMain.name}" (code ${plan.createMain.code}) will be created. ` : "Main location Kangoeroe High already exists. ",
        `${plan.create.length} department(s) will be added (${first} to ${last})`,
        plan.existing.length ? `; ${plan.existing.length} already exist and stay unchanged.` : ".",
      ].join("");

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={nothingToDo}
        title={nothingToDo ? (nl ? "Alles is al aanwezig." : "Everything is already present.") : undefined}
        onClick={() => {
          setFeedback({ status: "idle", message: "" });
          setOpen(true);
        }}
      >
        <MapPinPlus />
        {nl ? `Kangoeroe High en ${first} - ${last}` : `Kangoeroe High and ${first} - ${last}`}
      </Button>
      <ConfirmDialog
        open={open}
        title={nl ? "Lokalen toevoegen" : "Add classrooms"}
        description={description}
        confirmLabel={nl ? "Toevoegen" : "Add"}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          setFeedback({ status: "loading", message: nl ? "Toevoegen…" : "Adding…" });
          const result = await applyStarterLocations(repository, nl ? "nl" : "en");
          setFeedback({ status: result.ok ? "success" : "error", message: result.message });
        }}
      />
      <MutationFeedback {...feedback} />
    </>
  );
}
