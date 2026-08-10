import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
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
import { useApp } from "../context/AppContext";
import type { Movement } from "../domain/types";
import { useMockSnapshot, useRepository } from "../data/mockRepository";

const movementTypes = [
  "Incoming",
  "Outgoing",
  "Transfer",
  "Assignment",
  "Borrow",
  "Return",
  "Repair transfer",
  "Maintenance transfer",
  "Stock correction",
  "Damage",
  "Loss",
  "Disposal",
  "Audit adjustment",
];
export default function MovementsPage() {
  const { language } = useApp(),
    nl = language === "nl",
    snapshot = useMockSnapshot(),
    repository = useRepository(),
    navigate = useNavigate();
  const [open, setOpen] = useState(location.pathname.endsWith("/new")),
    [confirm, setConfirm] = useState(false),
    [pending, setPending] = useState<Record<string, unknown>>({});
  const [feedback, setFeedback] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const columns: DataColumn<Movement>[] = [
    {
      id: "reference",
      label: nl ? "Referentie" : "Reference",
      render: (item) => <strong>{item.reference}</strong>,
      text: (item) => item.reference,
      sortable: true,
    },
    {
      id: "date",
      label: nl ? "Datum en tijd" : "Date and time",
      render: (item) => item.date,
      text: (item) => item.date,
      sortable: true,
    },
    {
      id: "type",
      label: "Type",
      render: (item) => (
        <Badge
          tone={item.type.toLowerCase().includes("loss") ? "danger" : "info"}
        >
          {item.type}
        </Badge>
      ),
      text: (item) => item.type,
    },
    {
      id: "item",
      label: nl ? "Middel / artikel" : "Asset / item",
      render: (item) => item.asset,
      text: (item) => item.asset,
    },
    {
      id: "code",
      label: nl ? "Code" : "Code",
      render: (item) => item.assetCode,
      text: (item) => item.assetCode,
    },
    {
      id: "quantity",
      label: nl ? "Aantal" : "Quantity",
      render: (item) => item.quantity,
      text: (item) => item.quantity,
    },
    {
      id: "route",
      label: nl ? "Bron → bestemming" : "Source → destination",
      render: (item) => `${item.from} → ${item.to}`,
      text: (item) => `${item.from} ${item.to}`,
    },
    {
      id: "by",
      label: nl ? "Uitgevoerd door" : "Performed by",
      render: (item) => item.by,
      text: (item) => item.by,
    },
  ];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    values.quantity = Number(values.quantity);
    const source=snapshot.references.find(item=>item.id===values.sourceLocationId),destination=snapshot.references.find(item=>item.id===values.destinationLocationId);
    values.from=source?.name||"";values.to=destination?.name||"";
    setPending(values);
    if (
      ["Stock correction", "Loss", "Disposal", "Audit adjustment"].includes(
        String(values.type),
      )
    )
      setConfirm(true);
    else void execute(values);
  }
  async function execute(values = pending) {
    const result = await repository.execute({
      action: "movement.create",
      values,
    });
    setFeedback({
      status: result.ok ? "success" : "error",
      message: result.message,
    });
    if (result.ok)
      setTimeout(() => {
        setOpen(false);
        navigate("/movements");
      }, 300);
  }
  return (
    <OfflineGate>
      <div className="page">
        <PageHeader
          title={nl ? "Voorraadmutaties" : "Inventory movements"}
          description={
            nl
              ? "Onveranderlijke historie van iedere middel- en voorraadbeweging."
              : "Immutable history of every asset and stock movement."
          }
          actions={
            <Button onClick={() => setOpen(true)}>
              <Plus />
              {nl ? "Mutatie registreren" : "Record movement"}
            </Button>
          }
        />
        <section className="card data-card">
          <DataTable
            id="movements"
            rows={snapshot.movements}
            columns={columns}
            rowKey={(item) => item.id}
            searchPlaceholder={nl ? "Zoek mutaties…" : "Search movements…"}
            emptyTitle={nl ? "Geen mutaties" : "No movements"}
            emptyDescription={
              nl
                ? "Nieuwe operationele acties maken automatisch mutatierecords."
                : "Operational actions automatically create movement records."
            }
          />
        </section>
        <Dialog
          open={open}
          title={nl ? "Mutatie registreren" : "Record movement"}
          description={
            nl
              ? "Correcties voegen compenserende records toe; historie wordt nooit overschreven."
              : "Corrections append compensating records; history is never overwritten."
          }
          onClose={() => {
            setOpen(false);
            navigate("/movements");
          }}
        >
          <form className="workflow-form" onSubmit={submit}>
            <SelectField
              name="type"
              label={nl ? "Mutatietype" : "Movement type"}
              required
            >
              {movementTypes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </SelectField>
            <SelectField
              name="assetCode"
              label={nl ? "Middel of artikel" : "Asset or item"}
              required
            >
              <optgroup label="Assets">
                {snapshot.assets.map((item) => (
                  <option key={item.id} value={item.code}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Inventory">
                {snapshot.inventory.map((item) => (
                  <option key={item.id} value={item.code}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </optgroup>
            </SelectField>
            <Field
              name="asset"
              label={nl ? "Omschrijving" : "Description"}
              required
            />
            <Field
              name="quantity"
              type="number"
              min="1"
              defaultValue="1"
              label={nl ? "Aantal" : "Quantity"}
              required
            />
            <SelectField name="sourceLocationId" label={nl ? "Bron" : "Source"} required><option value="">Select location</option>{snapshot.references.filter(item=>item.kind==="location"&&item.status==="Active").map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
            <SelectField name="destinationLocationId" label={nl ? "Bestemming" : "Destination"} required><option value="">Select location</option>{snapshot.references.filter(item=>item.kind==="location"&&item.status==="Active").map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
            <TextAreaField
              name="reason"
              className="wide"
              label={nl ? "Reden" : "Reason"}
              required
            />
            <Field
              name="approvedBy"
              label={nl ? "Goedgekeurd door" : "Approved by"}
            />
            <TextAreaField name="notes" label={nl ? "Notities" : "Notes"} />
            <label className="field">
              <span>{nl ? "Bijlagen" : "Attachments"}</span>
              <input type="file" multiple />
            </label>
            <div className="wide">
              <MutationFeedback {...feedback} />
              <Button type="submit">
                {nl ? "Mutatie opslaan" : "Save movement"}
              </Button>
            </div>
          </form>
        </Dialog>
        <ConfirmDialog
          open={confirm}
          title={
            nl ? "Risicovolle mutatie bevestigen" : "Confirm high-risk movement"
          }
          description={
            nl
              ? "Een compensatierecord en activiteitenlogboekregel worden aangemaakt."
              : "A compensating record and activity-log entry will be created."
          }
          confirmLabel={nl ? "Registreren" : "Record"}
          danger
          onClose={() => setConfirm(false)}
          onConfirm={() => execute()}
        />
      </div>
    </OfflineGate>
  );
}
