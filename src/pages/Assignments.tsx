import { Plus, RotateCcw, Signature } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
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
import type { Assignment } from "../data/contracts";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { SignaturePad } from "../components/SignaturePad";
import { uploadAimsFiles } from "../services/firebaseStorageUploads";
import { StatusBadge } from "../components/AssetStatusBadge";

export default function AssignmentsPage() {
  const { language, formatAuto } = useApp(),
    nl = language === "nl",
    snapshot = useMockSnapshot(),
    repository = useRepository(),
    params = useParams();
  const routeAssignment =
    snapshot.assignments.find((item) => item.id === params.assignmentId) ||
    null;
  const [selected, setSelected] = useState<Assignment | null>(routeAssignment),
    [create, setCreate] = useState(location.pathname.endsWith("/new")),
    [returning, setReturning] = useState(location.pathname.endsWith("/return"));
  const [issueSignature, setIssueSignature] = useState<File | null>(null);
  const [returnSignature, setReturnSignature] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const columns: DataColumn<Assignment>[] = [
    {
      id: "reference",
      label: nl ? "Referentie" : "Reference",
      render: (item) => <strong>{item.id}</strong>,
      text: (item) => item.id,
      sortable: true,
    },
    {
      id: "asset",
      label: nl ? "Middel" : "Asset",
      render: (item) =>
        snapshot.assets.find((asset) => asset.id === item.assetId)?.code ||
        item.assetId,
      text: (item) =>
        snapshot.assets.find((asset) => asset.id === item.assetId)?.code ||
        item.assetId,
    },
    {
      id: "person",
      label: nl ? "Toegewezen aan" : "Assigned to",
      render: (item) => item.assignee,
      text: (item) => item.assignee,
      sortable: true,
    },
    {
      id: "department",
      label: nl ? "Afdeling" : "Department",
      render: (item) => item.department,
      text: (item) => item.department,
    },
    {
      id: "issued",
      label: nl ? "Uitgiftedatum" : "Issue date",
      render: (item) => item.assignedAt,
      text: (item) => item.assignedAt,
      sortable: true,
    },
    {
      id: "expected",
      label: nl ? "Verwachte retour" : "Expected return",
      render: (item) => item.expectedReturn || "—",
      text: (item) => item.expectedReturn || "",
    },
    {
      id: "status",
      label: "Status",
      render: (item) => (
        <StatusBadge status={item.active ? (nl ? "Actief" : "Active") : (nl ? "Geretourneerd" : "Returned")} size="compact" variant="table" />
      ),
      text: (item) => (item.active ? "Active" : "Returned"),
    },
  ];
  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    if (!issueSignature) {
      setFeedback({
        status: "error",
        message: nl ? "Handtekening is verplicht." : "Signature is required.",
      });
      return;
    }
    setFeedback({
      status: "loading",
      message: nl ? "Toewijzing opslaan…" : "Saving assignment…",
    });
    try {
      [values.signature] = await uploadAimsFiles(
        [issueSignature],
        "assignments",
        crypto.randomUUID(),
      );
      const result = await repository.execute({
        action: "assignment.create",
        entityId: String(values.assetId),
        values,
      });
      setFeedback({
        status: result.ok ? "success" : "error",
        message: result.message,
      });
      if (result.ok) setTimeout(() => setCreate(false), 300);
    } catch (error) {
      setFeedback({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  async function returnAsset(form: HTMLFormElement) {
    if (!selected) return;
    const values: Record<string, unknown> = Object.fromEntries(
      new FormData(form).entries(),
    );
    if (!returnSignature) {
      setFeedback({
        status: "error",
        message: nl
          ? "Ontvangsthandtekening is verplicht."
          : "Receipt signature is required.",
      });
      return;
    }
    setFeedback({
      status: "loading",
      message: nl ? "Retour registreren…" : "Registering return…",
    });
    try {
      [values.returnSignature] = await uploadAimsFiles(
        [returnSignature],
        "assignments",
        selected.id,
      );
      const result = await repository.execute({
        action: "assignment.return",
        entityId: selected.id,
        values,
      });
      setFeedback({
        status: result.ok ? "success" : "error",
        message: result.message,
      });
      if (result.ok) {
        setReturning(false);
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
          title={nl ? "Middeltoewijzingen" : "Asset assignments"}
          description={
            nl
              ? "Beheer huidige verantwoordelijkheid en een onveranderlijke toewijzingshistorie."
              : "Manage current responsibility and immutable assignment history."
          }
          actions={
            <Button onClick={() => setCreate(true)}>
              <Plus />
              {nl ? "Middel toewijzen" : "Assign asset"}
            </Button>
          }
        />
        <MutationFeedback {...feedback} />
        <section className="card data-card">
          <DataTable
            id="assignments"
            rows={snapshot.assignments}
            columns={columns}
            rowKey={(item) => item.id}
            searchPlaceholder={
              nl ? "Zoek toewijzingen…" : "Search assignments…"
            }
            emptyTitle={nl ? "Geen toewijzingen" : "No assignments"}
            emptyDescription={
              nl
                ? "Maak een toewijzing om verantwoordelijkheid vast te leggen."
                : "Create an assignment to record responsibility."
            }
            onRowClick={setSelected}
          />
        </section>
        <Dialog
          open={create}
          title={nl ? "Middel toewijzen" : "Assign asset"}
          description={
            nl
              ? "Leg conditie, persoon, locatie en handtekening vast."
              : "Record condition, person, location and signature."
          }
          onClose={() => setCreate(false)}
        >
          <form className="workflow-form" onSubmit={assign}>
            <SelectField
              name="assetId"
              label={nl ? "Beschikbaar middel" : "Available asset"}
              required
            >
              {snapshot.assets
                .filter((asset) => asset.status === "Available")
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.code} — {asset.name}
                  </option>
                ))}
            </SelectField>
            <Field
              name="assignee"
              label={nl ? "Persoon" : "Assigned person"}
              required
            />
            <Field
              name="department"
              label={nl ? "Afdeling" : "Department"}
              required
            />
            <Field
              name="location"
              label={nl ? "Locatie" : "Location"}
              required
            />
            <Field
              name="expectedReturn"
              type="date"
              label={nl ? "Verwachte retour" : "Expected return"}
            />
            <SelectField
              name="condition"
              label={nl ? "Conditie bij uitgifte" : "Condition at issue"}
            >
              {["New", "Excellent", "Good", "Fair", "Poor"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </SelectField>
            <SignaturePad
              label={nl ? "Handtekening" : "Signature"}
              clearLabel={nl ? "Wissen" : "Clear"}
              onChange={setIssueSignature}
            />
            <TextAreaField
              className="wide"
              name="notes"
              label={nl ? "Notities" : "Notes"}
            />
            <div className="wide">
              <MutationFeedback {...feedback} />
              <Button type="submit">
                <Signature />
                {nl ? "Toewijzing bevestigen" : "Confirm assignment"}
              </Button>
            </div>
          </form>
        </Dialog>
        <Dialog
          open={!!selected && !returning}
          title={nl ? "Toewijzingsdetails" : "Assignment details"}
          description={selected?.id}
          onClose={() => setSelected(null)}
        >
          {selected && (
            <>
              <div className="record-detail">
                {Object.entries({
                  [nl ? "Middel" : "Asset"]: snapshot.assets.find(
                    (asset) => asset.id === selected.assetId,
                  )?.code,
                  [nl ? "Persoon" : "Person"]: selected.assignee,
                  [nl ? "Afdeling" : "Department"]: selected.department,
                  [nl ? "Locatie" : "Location"]: selected.location,
                  [nl ? "Conditie bij uitgifte" : "Issue condition"]:
                    selected.conditionAtIssue,
                  [nl ? "Handtekening" : "Signature"]:
                    selected.signature || "—",
                  [nl ? "Uitgegeven" : "Issued"]: selected.assignedAt,
                  [nl ? "Geretourneerd" : "Returned"]:
                    selected.returnedAt || "—",
                }).map(([label, value]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <strong>{formatAuto(value)}</strong>
                  </div>
                ))}
              </div>
              {selected.active && (
                <Button onClick={() => setReturning(true)}>
                  <RotateCcw />
                  {nl ? "Retour registreren" : "Register return"}
                </Button>
              )}
            </>
          )}
        </Dialog>
        <Dialog
          open={returning}
          title={nl ? "Retour registreren" : "Register return"}
          description={
            nl
              ? "De oorspronkelijke toewijzing blijft in de historie bewaard."
              : "The original assignment remains in history."
          }
          onClose={() => setReturning(false)}
        >
          <form
            className="workflow-form"
            onSubmit={(event) => {
              event.preventDefault();
              void returnAsset(event.currentTarget);
            }}
            noValidate
          >
            <SelectField
              name="condition"
              label={nl ? "Conditie bij retour" : "Condition at return"}
              required
            >
              {["Excellent", "Good", "Fair", "Poor", "Defective"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </SelectField>
            <SignaturePad
              label={nl ? "Ontvangsthandtekening" : "Receipt signature"}
              clearLabel={nl ? "Wissen" : "Clear"}
              onChange={setReturnSignature}
            />
            <TextAreaField
              name="notes"
              className="wide"
              label={nl ? "Retournotities" : "Return notes"}
            />
            <MutationFeedback {...feedback} />
            <Button
              type="button"
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (form) void returnAsset(form);
              }}
            >
              {nl ? "Retour bevestigen" : "Confirm return"}
            </Button>
          </form>
        </Dialog>
      </div>
    </OfflineGate>
  );
}
