import {
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Recycle,
  ShieldCheck,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Field,
  SelectField,
  TextAreaField,
} from "../components/ui";
import { DataTable, type DataColumn } from "../components/DataTable";
import {
  ConfirmDialog,
  Dialog,
  MutationFeedback,
  OfflineGate,
  PageHeader,
} from "../components/WorkflowUi";
import { can } from "../auth/permissions";
import { useApp } from "../context/AppContext";
import type { Disposal } from "../data/contracts";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { uploadAimsFiles } from "../services/firebaseStorageUploads";
import { StatusBadge } from "../components/AssetStatusBadge";

const methods = [
  "Sale",
  "Donation",
  "Trade-in",
  "Recycling",
  "Destruction",
  "Return to supplier",
  "Parts recovery",
  "Other authorized method",
];
export default function Disposals() {
  const app = useApp(),
    nl = app.language === "nl",
    snapshot = useMockSnapshot(),
    repository = useRepository(),
    navigate = useNavigate(),
    params = useParams();
  const [selected, setSelected] = useState<Disposal | null>(
      () => snapshot.disposals.find((item) => item.id === params.id) || null,
    ),
    [create, setCreate] = useState(location.pathname.endsWith("/new")),
    [action, setAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const columns: DataColumn<Disposal>[] = [
    {
      id: "request",
      label: nl ? "Aanvraag" : "Request",
      render: (item) => <strong>{item.id}</strong>,
      text: (item) => item.id,
    },
    {
      id: "code",
      label: "Inv.code",
      render: (item) => item.assetCode,
      text: (item) => item.assetCode,
      sortable: true,
    },
    {
      id: "asset",
      label: nl ? "Middel" : "Asset",
      render: (item) => item.assetName,
      text: (item) => item.assetName,
    },
    {
      id: "reason",
      label: nl ? "Reden" : "Reason",
      render: (item) => item.reason,
      text: (item) => item.reason,
    },
    {
      id: "requester",
      label: nl ? "Aangevraagd door" : "Requested by",
      render: (item) => item.requestedBy,
      text: (item) => item.requestedBy,
    },
    {
      id: "date",
      label: nl ? "Datum" : "Date",
      render: (item) => item.requestedAt,
      text: (item) => item.requestedAt,
      sortable: true,
    },
    {
      id: "status",
      label: "Status",
      render: (item) => <StatusBadge status={item.status} size="compact" variant="table" />,
      text: (item) => item.status,
    },
  ];
  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values: Record<string, unknown> = Object.fromEntries(formData.entries());
    try {
      setFeedback({
        status: "loading",
        message: nl ? "Bijlagen uploaden…" : "Uploading attachments…",
      });
      values.attachments = await uploadAimsFiles(
        formData
          .getAll("attachments")
          .filter(
            (value): value is File => value instanceof File && value.size > 0,
          ),
        "disposals",
        crypto.randomUUID(),
      );
      const result = await repository.execute({
        action: "disposal.create",
        entityId: String(values.assetId),
        values,
      });
      setFeedback({
        status: result.ok ? "success" : "error",
        message: result.message,
      });
      if (result.ok) {
        setCreate(false);
        setSelected(
          snapshot.disposals.find((item) => item.id === result.entityId) ||
            null,
        );
        navigate(`/disposals/${result.entityId}`);
      }
    } catch (error) {
      setFeedback({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  async function perform() {
    if (!selected || !action) return;
    const values: Record<string, unknown> = {
      notes: (
        document.querySelector(
          '[name="inspectionNotes"]',
        ) as HTMLTextAreaElement
      )?.value,
      reason: (
        document.querySelector('[name="decisionReason"]') as HTMLTextAreaElement
      )?.value,
      method: (document.querySelector('[name="method"]') as HTMLSelectElement)
        ?.value,
      technicalAssessment: (
        document.querySelector(
          '[name="technicalAssessment"]',
        ) as HTMLTextAreaElement
      )?.value,
      estimatedValue: (
        document.querySelector('[name="estimatedValue"]') as HTMLInputElement
      )?.value,
      finalHandler: app.user?.name,
    };
    const result = await repository.execute({
      action: `disposal.${action}` as Parameters<
        typeof repository.execute
      >[0]["action"],
      entityId: selected.id,
      values,
    });
    setFeedback({
      status: result.ok ? "success" : "error",
      message: result.message,
    });
    if (result.ok) {
      setAction(null);
      setSelected(
        snapshot.disposals.find((item) => item.id === selected.id) || selected,
      );
    }
  }
  const current = selected
    ? snapshot.disposals.find((item) => item.id === selected.id) || selected
    : null;
  const next =
    current?.status === "Requested"
      ? "inspect"
      : current?.status === "Inspected"
        ? "approve"
        : current?.status === "Approved"
          ? "method"
          : current?.status === "Method Selected"
            ? "complete"
            : current?.status === "Completed"
              ? "archive"
              : null;
  return (
    <OfflineGate>
      <div className="page">
        <PageHeader
          title={
            nl
              ? "Levenscyclusbeoordeling en afvoer"
              : "Lifecycle assessment and disposal"
          }
          description={
            nl
              ? "Gecontroleerde inspectie, goedkeuring, afvoermethode en permanente codebewaring."
              : "Controlled inspection, approval, disposal method and permanent code retention."
          }
          actions={
            <Button onClick={() => setCreate(true)}>
              <Plus />
              {nl ? "Afvoer aanvragen" : "Request disposal"}
            </Button>
          }
        />
        <div className="status-summary">
          <section className="card">
            <b>{snapshot.disposals.length}</b>
            <small>{nl ? "Aanvragen" : "Requests"}</small>
          </section>
          <section className="card">
            <b>
              {
                snapshot.disposals.filter(
                  (value) => value.status === "Inspected",
                ).length
              }
            </b>
            <small>{nl ? "Wachten op besluit" : "Awaiting decision"}</small>
          </section>
          <section className="card">
            <b>
              {
                snapshot.disposals.filter(
                  (value) => value.status === "Completed",
                ).length
              }
            </b>
            <small>{nl ? "Voltooid" : "Completed"}</small>
          </section>
        </div>
        <section className="card data-card">
          <DataTable
            id="disposals"
            rows={snapshot.disposals}
            columns={columns}
            rowKey={(item) => item.id}
            searchPlaceholder={
              nl ? "Zoek afvoerrecords…" : "Search disposal records…"
            }
            emptyTitle={nl ? "Geen afvoeraanvragen" : "No disposal requests"}
            emptyDescription={
              nl
                ? "Middelen voor levenscyclusbeoordeling verschijnen hier."
                : "Assets requiring lifecycle assessment appear here."
            }
            onRowClick={setSelected}
          />
        </section>
        <Dialog
          open={create}
          title={nl ? "Afvoer aanvragen" : "Request disposal"}
          description={
            nl
              ? "Actief uitgeleende middelen worden geblokkeerd."
              : "Assets with active loans are blocked."
          }
          onClose={() => {
            setCreate(false);
            if (location.pathname.endsWith("/new")) navigate("/disposals");
          }}
        >
          <form className="workflow-form" onSubmit={request}>
            <SelectField
              name="assetId"
              label={nl ? "Middel" : "Asset"}
              required
            >
              {snapshot.assets
                .filter(
                  (asset) => !["Archived", "Disposed"].includes(asset.status),
                )
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.code} — {asset.name}
                  </option>
                ))}
            </SelectField>
            <TextAreaField
              name="reason"
              className="wide"
              label={nl ? "Reden" : "Reason"}
              required
            />
            <TextAreaField
              name="technicalAssessment"
              className="wide"
              label={nl ? "Technische beoordeling" : "Technical assessment"}
              required
            />
            <Field
              name="estimatedValue"
              type="number"
              min="0"
              label={nl ? "Geschatte waarde" : "Estimated value"}
            />
            <label className="field">
              <span>
                {nl ? "Bewijs en bijlagen" : "Evidence and attachments"}
              </span>
              <input
                name="attachments"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,.doc,.docx,.xls,.xlsx"
                multiple
              />
            </label>
            <MutationFeedback {...feedback} />
            <Button type="submit">
              <Recycle />
              {nl ? "Aanvraag indienen" : "Submit request"}
            </Button>
          </form>
        </Dialog>
        <Dialog
          open={!!current}
          title={current?.id || ""}
          description={
            current ? `${current.assetCode} — ${current.assetName}` : ""
          }
          onClose={() => {
            setSelected(null);
            if (params.id) navigate("/disposals");
          }}
        >
          {current && (
            <>
              <div className="record-detail">
                {Object.entries({
                  Status: current.status,
                  [nl ? "Reden" : "Reason"]: current.reason,
                  [nl ? "Beoordeling" : "Assessment"]:
                    current.technicalAssessment ||
                    current.inspectionNotes ||
                    "—",
                  [nl ? "Besluit" : "Decision"]: current.decisionReason || "—",
                  [nl ? "Methode" : "Method"]: current.method || "—",
                  [nl ? "Voltooid" : "Completed"]:
                    current.completionDate || "—",
                  [nl ? "Behandelaar" : "Handler"]: current.finalHandler || "—",
                }).map(([label, value]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              {current.status === "Requested" && (
                <TextAreaField
                  name="inspectionNotes"
                  label={nl ? "Inspectienotities" : "Inspection notes"}
                  required
                />
              )}
              {current.status === "Inspected" && (
                <TextAreaField
                  name="decisionReason"
                  label={nl ? "Besluitreden" : "Decision reason"}
                  required
                />
              )}
              {current.status === "Approved" && (
                <SelectField
                  name="method"
                  label={nl ? "Afvoermethode" : "Disposal method"}
                >
                  {methods.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </SelectField>
              )}
              {next && (
                <div className="actions">
                  <Button
                    disabled={
                      (next === "approve" ||
                        next === "complete" ||
                        next === "archive") &&
                      !can(app.user?.role, "disposals.approve")
                    }
                    onClick={() => setAction(next)}
                  >
                    {next === "inspect" ? (
                      <ClipboardCheck />
                    ) : next === "approve" ? (
                      <ShieldCheck />
                    ) : (
                      <CheckCircle2 />
                    )}
                    {next}
                  </Button>
                  {current.status === "Inspected" && (
                    <Button
                      variant="danger"
                      onClick={() => setAction("reject")}
                    >
                      {nl ? "Afwijzen" : "Reject"}
                    </Button>
                  )}
                </div>
              )}
              <MutationFeedback {...feedback} />
            </>
          )}
        </Dialog>
        <ConfirmDialog
          open={!!action}
          title={`${nl ? "Bevestig" : "Confirm"} ${action || ""}`}
          description={
            nl
              ? "Deze levenscyclusbeslissing wordt permanent vastgelegd. De KCS-code wordt nooit opnieuw uitgegeven."
              : "This lifecycle decision is permanently logged. The KCS code is never reissued."
          }
          confirmLabel={nl ? "Bevestigen" : "Confirm"}
          danger={
            action === "reject" || action === "complete" || action === "archive"
          }
          onClose={() => setAction(null)}
          onConfirm={perform}
        />
      </div>
    </OfflineGate>
  );
}
