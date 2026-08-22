import { Camera, CheckCircle2, Plus, Wrench } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Field,
  SelectField,
  TextAreaField,
} from "../components/ui";
import { DataTable, type DataColumn } from "../components/DataTable";
import {
  Dialog,
  MutationFeedback,
  OfflineGate,
  PageHeader,
} from "../components/WorkflowUi";
import { useApp } from "../context/AppContext";
import type { Repair } from "../domain/types";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { uploadAimsFiles } from "../services/firebaseStorageUploads";

export default function RepairsPage() {
  const { language } = useApp(),
    nl = language === "nl",
    snapshot = useMockSnapshot(),
    repository = useRepository(),
    params = useParams(),
    navigate = useNavigate();
  const routeId = params.repairId || params.id;
  const [selected, setSelected] = useState<Repair | null>(
      () => snapshot.repairs.find((item) => item.id === routeId) || null,
    ),
    [create, setCreate] = useState(location.pathname.endsWith("/new")),
    [complete, setComplete] = useState(location.pathname.endsWith("/complete"));
  const [feedback, setFeedback] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const columns: DataColumn<Repair>[] = [
    {
      id: "reference",
      label: nl ? "Reparatie" : "Repair",
      render: (item) => <strong>{item.reference}</strong>,
      text: (item) => item.reference,
      sortable: true,
    },
    {
      id: "asset",
      label: nl ? "Middel" : "Asset",
      render: (item) => item.asset,
      text: (item) => item.asset,
    },
    {
      id: "code",
      label: "KCS code",
      render: (item) => item.assetCode,
      text: (item) => item.assetCode,
    },
    {
      id: "issue",
      label: nl ? "Probleem" : "Issue",
      render: (item) => item.issue,
      text: (item) => item.issue,
    },
    {
      id: "priority",
      label: nl ? "Prioriteit" : "Priority",
      render: (item) => (
        <Badge
          tone={
            item.priority === "Critical"
              ? "danger"
              : item.priority === "High"
                ? "warning"
                : "info"
          }
        >
          {item.priority}
        </Badge>
      ),
      text: (item) => item.priority,
    },
    {
      id: "technician",
      label: nl ? "Technicus" : "Technician",
      render: (item) => item.technician,
      text: (item) => item.technician,
    },
    {
      id: "due",
      label: nl ? "Streefdatum" : "Due",
      render: (item) => item.due,
      text: (item) => item.due,
      sortable: true,
    },
    {
      id: "status",
      label: "Status",
      render: (item) => (
        <Badge tone={item.status === "Completed" ? "success" : "warning"}>
          {item.status}
        </Badge>
      ),
      text: (item) => item.status,
    },
  ];
  async function createRepair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values: Record<string, unknown> = Object.fromEntries(formData.entries());
    try {
      setFeedback({
        status: "loading",
        message: nl ? "Foto uploaden…" : "Uploading photograph…",
      });
      values.beforePhotos = await uploadAimsFiles(
        formData
          .getAll("beforePhoto")
          .filter(
            (value): value is File => value instanceof File && value.size > 0,
          ),
        "repairs",
        crypto.randomUUID(),
      );
      delete values.beforePhoto;
      const result = await repository.execute({
        action: "repair.create",
        entityId: String(values.assetId),
        values,
      });
      setFeedback({
        status: result.ok ? "success" : "error",
        message: result.message,
      });
      if (result.ok) setCreate(false);
    } catch (error) {
      setFeedback({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  async function progress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const result = await repository.execute({
      action: "repair.progress",
      entityId: selected.id,
      values,
    });
    setFeedback({
      status: result.ok ? "success" : "error",
      message: result.message,
    });
  }
  async function finish(form: HTMLFormElement) {
    if (!selected) return;
    const formData = new FormData(form);
    const values: Record<string, unknown> = Object.fromEntries(formData.entries());
    if (!String(values.outcome || "").trim()) {
      setFeedback({
        status: "error",
        message: nl
          ? "Reparatieresultaat is verplicht."
          : "Repair outcome is required.",
      });
      return;
    }
    try {
      setFeedback({
        status: "loading",
        message: nl
          ? "Foto uploaden en reparatie voltooien…"
          : "Uploading photograph and completing repair…",
      });
      values.afterPhotos = await uploadAimsFiles(
        formData
          .getAll("afterPhoto")
          .filter(
            (value): value is File => value instanceof File && value.size > 0,
          ),
        "repairs",
        selected.id,
      );
      delete values.afterPhoto;
      const result = await repository.execute({
        action: "repair.complete",
        entityId: selected.id,
        values,
      });
      setFeedback({
        status: result.ok ? "success" : "error",
        message: result.message,
      });
      if (result.ok) {
        setComplete(false);
        setSelected(null);
      }
    } catch (error) {
      setFeedback({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return (
    <OfflineGate>
      <div className="page">
        <PageHeader
          title={nl ? "Reparatiebeheer" : "Repair management"}
          description={
            nl
              ? "Diagnose, onderdelen, technicustoewijzing en middeluitkomsten."
              : "Diagnosis, parts, technician assignment and asset outcomes."
          }
          actions={
            <Button onClick={() => setCreate(true)}>
              <Plus />
              {nl ? "Reparatie melden" : "Report repair"}
            </Button>
          }
        />
        <MutationFeedback {...feedback} />
        <section className="card data-card">
          <DataTable
            id="repairs"
            rows={snapshot.repairs}
            columns={columns}
            rowKey={(item) => item.id}
            searchPlaceholder={nl ? "Zoek reparaties…" : "Search repairs…"}
            emptyTitle={nl ? "Geen reparaties" : "No repairs"}
            emptyDescription={
              nl
                ? "Meld een reparatie wanneer een middel aandacht nodig heeft."
                : "Report a repair when an asset needs attention."
            }
            onRowClick={setSelected}
          />
        </section>
        <Dialog
          open={create}
          title={nl ? "Reparatie melden" : "Report repair"}
          onClose={() => setCreate(false)}
        >
          <form className="workflow-form" onSubmit={createRepair}>
            <SelectField
              name="assetId"
              label={nl ? "Middel" : "Asset"}
              required
            >
              {snapshot.assets
                .filter(
                  (asset) =>
                    !["Archived", "Disposed", "Under Repair"].includes(
                      asset.status,
                    ),
                )
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.code} — {asset.name}
                  </option>
                ))}
            </SelectField>
            <TextAreaField
              name="issue"
              label={nl ? "Probleembeschrijving" : "Issue description"}
              required
            />
            <SelectField name="priority" label={nl ? "Prioriteit" : "Priority"}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </SelectField>
            <Field
              name="technician"
              label={nl ? "Technicus" : "Technician"}
              required
            />
            <Field
              name="due"
              type="date"
              label={nl ? "Streefdatum" : "Due date"}
              required
            />
            <label className="field">
              <span>{nl ? "Foto vóór reparatie" : "Before photograph"}</span>
              <input name="beforePhoto" type="file" accept="image/*" />
            </label>
            <div className="wide">
              <MutationFeedback {...feedback} />
              <Button type="submit">
                <Wrench />
                {nl ? "Reparatie aanmaken" : "Create repair"}
              </Button>
            </div>
          </form>
        </Dialog>
        <Dialog
          open={!!selected && !complete}
          title={selected?.reference || ""}
          description={
            selected ? `${selected.assetCode} — ${selected.asset}` : ""
          }
          onClose={() => {
            setSelected(null);
            if (params.id) navigate("/repairs");
          }}
        >
          {selected && (
            <form className="workflow-form" onSubmit={progress}>
              <TextAreaField
                name="diagnosis"
                className="wide"
                label={nl ? "Diagnose" : "Diagnosis"}
                defaultValue={selected.diagnosis}
              />
              <SelectField
                name="status"
                label={nl ? "Voortgangsstatus" : "Progress status"}
                defaultValue={selected.status}
              >
                <option>Reported</option>
                <option>Diagnosing</option>
                <option>Waiting for Parts</option>
                <option>In Repair</option>
                <option>Testing</option>
              </SelectField>
              <Field
                name="technician"
                label={nl ? "Technicus" : "Technician"}
                defaultValue={selected.technician}
              />
              <Field
                name="externalCompany"
                label={
                  nl ? "Extern reparatiebedrijf" : "External repair company"
                }
                defaultValue={selected.externalCompany}
              />
              <TextAreaField
                name="parts"
                label={nl ? "Gebruikte onderdelen" : "Parts used"}
                defaultValue={selected.parts}
              />
              <div className="wide actions">
                <Button type="submit">
                  {nl ? "Voortgang opslaan" : "Save progress"}
                </Button>
                <Button type="button" onClick={() => setComplete(true)}>
                  <CheckCircle2 />
                  {nl ? "Reparatie voltooien" : "Complete repair"}
                </Button>
              </div>
              <MutationFeedback {...feedback} />
            </form>
          )}
        </Dialog>
        <Dialog
          open={complete}
          title={nl ? "Reparatie voltooien" : "Complete repair"}
          description={
            nl
              ? "Nieuwe middelstatus en conditie zijn verplicht."
              : "Resulting asset status and condition are required."
          }
          onClose={() => setComplete(false)}
        >
          <form
            className="workflow-form"
            onSubmit={(event) => {
              event.preventDefault();
              void finish(event.currentTarget);
            }}
            noValidate
          >
            <TextAreaField
              name="outcome"
              className="wide"
              label={nl ? "Reparatieresultaat" : "Repair outcome"}
              required
            />
            <SelectField
              name="assetStatus"
              label={nl ? "Nieuwe middelstatus" : "New asset status"}
              required
            >
              <option>Available</option>
              <option>Under Maintenance</option>
              <option>Damaged</option>
              <option>Disposed</option>
            </SelectField>
            <SelectField
              name="condition"
              label={nl ? "Nieuwe conditie" : "New condition"}
              required
            >
              <option>Excellent</option>
              <option>Good</option>
              <option>Fair</option>
              <option>Poor</option>
              <option>Defective</option>
              <option>Beyond Repair</option>
            </SelectField>
            <label className="field">
              <span>{nl ? "Foto na reparatie" : "After photograph"}</span>
              <input name="afterPhoto" type="file" accept="image/*" />
            </label>
            <MutationFeedback {...feedback} />
            <Button
              type="button"
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (form) void finish(form);
              }}
            >
              <Camera />
              {nl ? "Voltooi en werk middel bij" : "Complete and update asset"}
            </Button>
          </form>
        </Dialog>
      </div>
    </OfflineGate>
  );
}
