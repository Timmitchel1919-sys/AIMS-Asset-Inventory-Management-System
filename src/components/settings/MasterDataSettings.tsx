import { Plus, Power, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Badge, Button, Field } from "../ui";
import { ConfirmDialog, Dialog, MutationFeedback } from "../WorkflowUi";
import { useApp } from "../../context/AppContext";
import type { CodeGroup, ReferenceRecord } from "../../data/contracts";
import { useMockSnapshot, useRepository } from "../../data/repositoryContext";

type Feedback = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};
export const approvedMainLocations = [
  "Kangoeroe High",
  "KCS Onderbouw",
  "KCS Bovenbouw",
] as const;
export const approvedCodeGroups = [
  ["KCSL", "KCSL"],
  ["KCSMD", "KCSMD"],
  ["KCSDESK", "KCSDESK"],
  ["KCSPW", "KCSPW"],
  ["KCSRT", "KCSRT"],
  ["KCSMOB", "KCSMOB"],
  ["TAB", "TAB"],
  ["KCSMON", "KCSMON"],
  ["KCSLT", "KCSLT"],
  ["KCSAP", "KCSAP"],
  ["KCSPR", "KCSPR"],
  ["KCSSW", "KCSSW"],
  ["KCSUPS", "KCSUPS"],
  ["KBW", "KBW"],
  ["KBWS", "KBWS"],
  ["KBWC", "KBWC"],
  ["UPS", "UPS"],
  ["PR", "PR"],
  ["MON", "MON"],
  ["KB", "KB"],
  ["Mouse wired", "MW"],
  ["Mouse wireless", "MWS"],
  ["KHL", "KHL"],
  ["KCSDB", "KCSDB"],
  ["TL", "TL"],
  ["PRO", "PRO"],
  ["FINAD", "FINAD"],
] as const;
export const approvedDepartments = [
  ...[
    "ICT",
    "Storage",
    "KO/NSO",
    "Finance",
    "HRM",
    "ADMIN/SECR",
    "FACILITAIR",
    "Finance Administratie",
    "Dependance Administratie",
    "Secretariaat",
    "ICT kantoor",
    "Conference Room",
    "KO-Kantoor",
    "FIN-Manager",
    "BB-Admin",
    "ICT STORAGE",
  ].map((name) => [name, "KCS Onderbouw"] as const),
  ...[
    "KH Administratie",
    "KO ADMINISTRATIE",
    "C1",
    "ICT Camera",
    "OD-KH",
    "KH-Admin",
    "KH DIRECTEUR OFFICE",
  ].map((name) => [name, "Kangoeroe High"] as const),
] as const;

function ApprovedStructureInstaller() {
  const repository = useRepository(),
    snapshot = useMockSnapshot();
  const [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState<Feedback>({
      status: "idle",
      message: "",
    });
  async function install() {
    setBusy(true);
    setFeedback({
      status: "loading",
      message: "Goedgekeurde structuur toevoegen…",
    });
    let created = 0;
    const names = new Set(
      snapshot.references
        .filter((x) => x.kind === "location" && x.status === "Active")
        .map((x) => x.name.trim().toUpperCase()),
    );
    for (const name of approvedMainLocations)
      if (!names.has(name.toUpperCase())) {
        const r = await repository.execute({
          action: "reference.create",
          values: {
            kind: "location",
            name,
            type: "Main location",
            status: "Active",
            details: { approvedStructure: true },
          },
        });
        if (!r.ok) {
          setBusy(false);
          return setFeedback({ status: "error", message: r.message });
        }
        names.add(name.toUpperCase());
        created++;
      }
    const current = repository.snapshot();
    const departments = new Set(
      current.references
        .filter((x) => x.kind === "department" && x.status === "Active")
        .map((x) => x.name.trim().toUpperCase()),
    );
    for (const [name, mainName] of approvedDepartments)
      if (!departments.has(name.toUpperCase())) {
        const main = current.references.find(
          (x) =>
            x.kind === "location" &&
            x.name === mainName &&
            x.status === "Active",
        );
        const r = await repository.execute({
          action: "reference.create",
          values: {
            kind: "department",
            name,
            type: "Department",
            status: "Active",
            mainLocationId: main?.id || null,
            details: { mainLocation: mainName },
          },
        });
        if (!r.ok) {
          setBusy(false);
          return setFeedback({ status: "error", message: r.message });
        }
        departments.add(name.toUpperCase());
        created++;
      }
    const prefixes = new Set(
      snapshot.codeGroups.map((x) => x.prefix.trim().toUpperCase()),
    );
    for (const [name, prefix] of approvedCodeGroups)
      if (!prefixes.has(prefix)) {
        const r = await repository.execute({
          action: "codeGroup.create",
          values: {
            name,
            prefix,
            minimumNumber: 1,
            maximumNumber: 5000,
            nextAvailableNumber: 1,
          },
        });
        if (!r.ok) {
          setBusy(false);
          return setFeedback({ status: "error", message: r.message });
        }
        prefixes.add(prefix);
        created++;
      }
    setBusy(false);
    setFeedback({
      status: "success",
      message: `Structuur gereed: ${created} nieuwe records toegevoegd; bestaande records behouden.`,
    });
  }
  return (
    <div className="approved-structure-installer">
      <div>
        <strong>Goedgekeurde AIMS-structuur</strong>
        <p>
          Voegt alleen ontbrekende, vooraf goedgekeurde hoofdlocaties,
          afdelingen en codegroepen toe. Bestaande gegevens worden niet
          overschreven en de actie kan veilig opnieuw worden uitgevoerd.
        </p>
      </div>
      <Button onClick={install} disabled={busy}>
        Goedgekeurde structuur toevoegen
      </Button>
      <MutationFeedback {...feedback} />
    </div>
  );
}

function ParentLocationsSettings() {
  const repository = useRepository(),
    snapshot = useMockSnapshot();
  const [adding, setAdding] = useState(false),
    [deleting, setDeleting] = useState<ReferenceRecord | null>(null),
    [feedback, setFeedback] = useState<Feedback>({
      status: "idle",
      message: "",
    });
  const locations = snapshot.references
    .filter(
      (x) =>
        x.kind === "location" &&
        x.type === "Main location" &&
        x.status !== "Archived",
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  async function change(
    location: ReferenceRecord,
    action: "reference.delete" | "reference.archive" | "reference.restore",
  ) {
    const r = await repository.execute({ action, entityId: location.id });
    setFeedback({ status: r.ok ? "success" : "error", message: r.message });
    if (r.ok) setDeleting(null);
  }
  async function addMainLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await repository.execute({
      action: "reference.create",
      values: {
        kind: "location",
        name: data.get("name"),
        type: "Main location",
        status: "Active",
        details: { manuallyCreated: true },
      },
    });
    setFeedback({
      status: result.ok ? "success" : "error",
      message: result.message,
    });
    if (result.ok) setAdding(false);
  }
  return (
    <div>
      <div className="section-toolbar">
        <div>
          <h3>Hoofdlocaties</h3>
          <p className="main-location-safety-copy">
            <span>
              Verwijderen verplaatst een hoofdlocatie direct naar de prullenbak.
            </span>
            <span>
              Gekoppelde gegevens blijven veilig bewaard en de locatie kan daar
              worden hersteld.
            </span>
          </p>
        </div>
        <Button
          onClick={() => setAdding(true)}
          aria-label="Hoofdlocatie toevoegen"
        >
          <Plus />
          Toevoegen
        </Button>
      </div>
      <MutationFeedback {...feedback} />
      <div className="location-type-list">
        {locations.map((location, index) => (
          <article key={location.id}>
            <span className="location-type-order">{index + 1}</span>
            <div>
              <strong>{location.name}</strong>
              <small>Hoofdlocatie</small>
            </div>
            <Badge tone={location.status === "Active" ? "success" : "neutral"}>
              {location.status === "Active" ? "Actief" : "Inactief"}
            </Badge>
            <div className="location-type-actions">
              <Button
                variant="ghost"
                title={
                  location.status === "Active"
                    ? "Hoofdlocatie deactiveren"
                    : "Hoofdlocatie activeren"
                }
                aria-label={
                  location.status === "Active"
                    ? `${location.name} deactiveren`
                    : `${location.name} activeren`
                }
                onClick={() =>
                  change(
                    location,
                    location.status === "Active"
                      ? "reference.archive"
                      : "reference.restore",
                  )
                }
              >
                <Power />
              </Button>
              <Button
                variant="danger"
                title="Hoofdlocatie naar prullenbak verplaatsen"
                aria-label={`${location.name} naar prullenbak verplaatsen`}
                onClick={() => setDeleting(location)}
              >
                <Trash2 />
              </Button>
            </div>
          </article>
        ))}
      </div>
      <Dialog
        open={adding}
        title="Hoofdlocatie toevoegen"
        onClose={() => setAdding(false)}
      >
        <form className="workflow-form" onSubmit={addMainLocation}>
          <Field name="name" label="Naam hoofdlocatie" required />
          <div className="wide actions">
            <Button type="submit">Hoofdlocatie opslaan</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAdding(false)}
            >
              Annuleren
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        title="Hoofdlocatie naar prullenbak"
        description="De hoofdlocatie verdwijnt uit deze lijst en blijft met alle koppelingen herstelbaar in de prullenbak."
        confirmLabel="Naar prullenbak"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const reason = window
            .prompt("Geef de verplichte reden voor verwijderen:")
            ?.trim();
          if (!reason) return;
          const r = await repository.execute({
            action: "reference.archive",
            entityId: deleting.id,
            values: { reason },
          });
          setFeedback({
            status: r.ok ? "success" : "error",
            message: r.message,
          });
          if (r.ok) setDeleting(null);
        }}
      />
    </div>
  );
}

function CodeGroupForm({ onClose }: { onClose: () => void }) {
  const repository = useRepository();
  const [feedback, setFeedback] = useState<Feedback>({
    status: "idle",
    message: "",
  });
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const d = new FormData(event.currentTarget),
      r = await repository.execute({
        action: "codeGroup.create",
        values: {
          name: d.get("name"),
          prefix: d.get("prefix"),
          minimumNumber: Number(d.get("minimumNumber")),
          maximumNumber: Number(d.get("maximumNumber")),
          nextAvailableNumber: Number(d.get("nextAvailableNumber")),
        },
      });
    setFeedback({ status: r.ok ? "success" : "error", message: r.message });
    if (r.ok) onClose();
  }
  return (
    <form className="workflow-form" onSubmit={save}>
      <Field name="name" label="Naam" required />
      <Field name="prefix" label="Prefix" required />
      <Field
        name="minimumNumber"
        type="number"
        min="1"
        label="Minimum"
        defaultValue="1"
        required
      />
      <Field
        name="maximumNumber"
        type="number"
        min="1"
        label="Maximum"
        defaultValue="5000"
        required
      />
      <Field
        name="nextAvailableNumber"
        type="number"
        min="1"
        label="Volgend nummer"
        defaultValue="1"
        required
      />
      <div className="wide">
        <MutationFeedback {...feedback} />
        <Button type="submit">Opslaan</Button>
      </div>
    </form>
  );
}

function CodeGroupsSettings() {
  const repository = useRepository(),
    snapshot = useMockSnapshot();
  const [adding, setAdding] = useState(false),
    [deleting, setDeleting] = useState<CodeGroup | null>(null),
    [pageSize, setPageSize] = useState(15),
    [page, setPage] = useState(1),
    [sortBy, setSortBy] = useState<
      "alphabetical" | "created-new" | "created-old"
    >("alphabetical"),
    [feedback, setFeedback] = useState<Feedback>({
      status: "idle",
      message: "",
    });
  const sortedGroups = useMemo(() => {
    const groups = snapshot.codeGroups.filter((group) => !group.archived);
    if (sortBy === "alphabetical")
      return groups.sort((a, b) =>
        a.name.localeCompare(b.name, "nl", { sensitivity: "base" }),
      );
    return groups.sort((a, b) => {
      const difference =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortBy === "created-new" ? -difference : difference;
    });
  }, [snapshot.codeGroups, sortBy]);
  const pageCount = Math.max(1, Math.ceil(sortedGroups.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleGroups = sortedGroups.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  async function run(
    group: CodeGroup,
    action: "codeGroup.activate" | "codeGroup.deactivate" | "codeGroup.delete",
  ) {
    const r = await repository.execute({ action, entityId: group.id });
    setFeedback({ status: r.ok ? "success" : "error", message: r.message });
    if (r.ok) setDeleting(null);
  }
  return (
    <div>
      <div className="section-toolbar">
        <div>
          <h3>Codegroepen</h3>
          <p>Beheer officiële middelcode-reeksen.</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus />
          Toevoegen
        </Button>
      </div>
      <MutationFeedback {...feedback} />
      <div className="code-group-controls" aria-label="Codegroepenweergave">
        <label>
          <span>Sorteren op</span>
          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as typeof sortBy);
              setPage(1);
            }}
          >
            <option value="alphabetical">Alfabetische volgorde</option>
            <option value="created-new">Aanmaakdatum: nieuwste eerst</option>
            <option value="created-old">Aanmaakdatum: oudste eerst</option>
          </select>
        </label>
        <label>
          <span>Codegroepen per pagina</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {[5, 10, 15, 25].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="location-type-list">
        {visibleGroups.map((group, index) => (
          <article key={group.id}>
            <span className="location-type-order">
              {(currentPage - 1) * pageSize + index + 1}
            </span>
            <div>
              <strong>
                {group.name} <code>{group.prefix}</code>
              </strong>
              <small>
                Reeks {group.minimumNumber}–{group.maximumNumber} · Volgend{" "}
                {group.nextAvailableNumber}
              </small>
            </div>
            <Badge tone={group.isActive ? "success" : "neutral"}>
              {group.isActive ? "Actief" : "Inactief"}
            </Badge>
            <div className="location-type-actions">
              <Button
                variant="ghost"
                onClick={() =>
                  run(
                    group,
                    group.isActive
                      ? "codeGroup.deactivate"
                      : "codeGroup.activate",
                  )
                }
              >
                <Power />
              </Button>
              <Button variant="danger" onClick={() => setDeleting(group)}>
                <Trash2 />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {pageCount > 1 ? (
        <nav className="code-group-pagination" aria-label="Codegroepenpagina's">
          <Button
            variant="secondary"
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Vorige
          </Button>
          <span>
            Pagina {currentPage} van {pageCount} · {sortedGroups.length}{" "}
            codegroepen
          </span>
          <Button
            variant="secondary"
            disabled={currentPage === pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            Volgende
          </Button>
        </nav>
      ) : null}
      <Dialog
        open={adding}
        title="Codegroep toevoegen"
        onClose={() => setAdding(false)}
      >
        <CodeGroupForm onClose={() => setAdding(false)} />
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        title="Codegroep verwijderen"
        description="Codegroepen die door middelen worden gebruikt kunnen niet worden verwijderd."
        confirmLabel="Verwijderen"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const reason = window
            .prompt("Geef de verplichte reden voor verwijderen:")
            ?.trim();
          if (!reason) return;
          const r = await repository.execute({
            action: "codeGroup.delete",
            entityId: deleting.id,
            values: { reason },
          });
          setFeedback({
            status: r.ok ? "success" : "error",
            message: r.message,
          });
          if (r.ok) setDeleting(null);
        }}
      />
    </div>
  );
}

export function MasterDataSettings() {
  const { user } = useApp();
  const [tab, setTab] = useState<"locations" | "codes">("locations");
  if (!user) return null;
  return (
    <div className="master-data-settings">
      <ApprovedStructureInstaller />
      <div className="subnav" role="tablist">
        <button
          type="button"
          className={tab === "locations" ? "active" : ""}
          onClick={() => setTab("locations")}
        >
          Locaties
        </button>
        <button
          type="button"
          className={tab === "codes" ? "active" : ""}
          onClick={() => setTab("codes")}
        >
          Codegroepen
        </button>
      </div>
      {tab === "locations" ? (
        <ParentLocationsSettings />
      ) : (
        <CodeGroupsSettings />
      )}
    </div>
  );
}
