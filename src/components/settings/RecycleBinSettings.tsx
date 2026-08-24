import { History, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Button } from "../ui";
import { ConfirmDialog, MutationFeedback } from "../WorkflowUi";
import { useMockSnapshot, useRepository } from "../../data/repositoryContext";

type BinItem = {
  id: string;
  name: string;
  kind: "asset" | "inventory" | "reference" | "codeGroup";
  detail: string;
};
export function RecycleBinSettings() {
  const repository = useRepository(),
    snapshot = useMockSnapshot();
  const [purging, setPurging] = useState<BinItem | null>(null),
    [feedback, setFeedback] = useState({
      status: "idle" as "idle" | "success" | "error",
      message: "",
    });
  const items: BinItem[] = [
    ...snapshot.assets
      .filter((x) => x.status === "Archived")
      .map((x) => ({
        id: x.id,
        name: x.name,
        kind: "asset" as const,
        detail: x.code,
      })),
    ...snapshot.inventory
      .filter((x) => x.archived)
      .map((x) => ({
        id: x.id,
        name: x.name,
        kind: "inventory" as const,
        detail: x.code,
      })),
    ...snapshot.references
      .filter((x) => x.status === "Archived")
      .map((x) => ({
        id: x.id,
        name: x.name,
        kind: "reference" as const,
        detail: x.kind === "location" ? "Locatie" : x.kind,
      })),
    ...snapshot.codeGroups
      .filter((x) => x.archived)
      .map((x) => ({
        id: x.id,
        name: x.name,
        kind: "codeGroup" as const,
        detail: `Codegroep ${x.prefix}${x.deletionReason ? ` · ${x.deletionReason}` : ""}`,
      })),
  ];
  async function restore(item: BinItem) {
    const action =
      item.kind === "asset"
        ? "asset.restore"
        : item.kind === "inventory"
          ? "inventory.restore"
          : item.kind === "reference"
            ? "reference.restore"
            : "codeGroup.restore";
    const r = await repository.execute({ action, entityId: item.id });
    setFeedback({ status: r.ok ? "success" : "error", message: r.message });
  }
  async function purge(item: BinItem) {
    if (item.kind !== "reference")
      return setFeedback({
        status: "error",
        message:
          "ICT-middelen en voorraad blijven om auditredenen herstelbaar en kunnen niet definitief worden vernietigd.",
      });
    const r = await repository.execute({
      action: "reference.delete",
      entityId: item.id,
    });
    setFeedback({ status: r.ok ? "success" : "error", message: r.message });
    if (r.ok) setPurging(null);
  }
  return (
    <div className="recycle-bin-settings">
      <div className="section-toolbar">
        <div>
          <h3>Prullenbak</h3>
          <p>
            Geen automatische timer. Alleen een gebruiker beslist over herstel
            of definitieve verwijdering.
          </p>
        </div>
        <Badge tone="neutral">{items.length} items</Badge>
      </div>
      <MutationFeedback {...feedback} />
      <div className="state">
        <ShieldCheck />
        <strong>History en auditgegevens zijn beschermd</strong>
        <p>
          Apparaatgeschiedenis, importaudit en systeemlogs worden nooit
          automatisch of vanuit deze prullenbak verwijderd.
        </p>
      </div>
      <div className="location-type-list">
        {items.map((item) => (
          <article key={`${item.kind}:${item.id}`}>
            <span className="location-type-order">
              <History />
            </span>
            <div>
              <strong>{item.name}</strong>
              <small>{item.detail}</small>
            </div>
            <Badge tone="neutral">{item.kind}</Badge>
            <div className="location-type-actions">
              <Button
                variant="ghost"
                title="Herstellen"
                aria-label={`${item.name} herstellen`}
                onClick={() => restore(item)}
              >
                <RotateCcw />
              </Button>
              <Button
                variant="danger"
                title="Permanent verwijderen"
                aria-label={`${item.name} permanent verwijderen`}
                onClick={() => setPurging(item)}
              >
                <Trash2 />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!items.length ? (
        <div className="state">
          <Trash2 />
          <h3>Prullenbak is leeg</h3>
        </div>
      ) : null}
      <ConfirmDialog
        open={!!purging}
        title="Definitief vernietigen"
        description={
          purging?.kind === "reference"
            ? "Dit kan niet ongedaan worden gemaakt. Gekoppelde actieve gegevens blokkeren de actie."
            : "Dit type blijft vanwege audit- en herstelverplichtingen beschermd tegen definitieve vernietiging."
        }
        confirmLabel="Definitief verwijderen"
        danger
        onClose={() => setPurging(null)}
        onConfirm={async () => {
          if (purging) await purge(purging);
        }}
      />
    </div>
  );
}
