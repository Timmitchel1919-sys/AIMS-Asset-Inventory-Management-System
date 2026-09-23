import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button } from "../ui";
import { ConfirmDialog, Dialog, MutationFeedback } from "../WorkflowUi";
import { useApp } from "../../context/AppContext";
import type { CodeGroup, ReferenceRecord } from "../../data/contracts";
import { useMockSnapshot, useRepository } from "../../data/repositoryContext";
import { MainLocationForm } from "./MainLocationForm";
import { CodeGroupForm } from "./CodeGroupForm";

type Feedback = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

function MainLocationsSettings() {
  const { formatDateTime, language } = useApp(),
    nl = language === "nl",
    repository = useRepository(),
    snapshot = useMockSnapshot();
  const [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<ReferenceRecord | null>(null),
    [deleting, setDeleting] = useState<ReferenceRecord | null>(null),
    [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all"),
    [feedback, setFeedback] = useState<Feedback>({
      status: "idle",
      message: "",
    });

  const locations = useMemo(() => {
    return snapshot.references
      .filter((x) => x.kind === "location" && x.type === "Main location" && x.status !== "Archived")
      .filter((x) => {
        if (statusFilter === "active" && x.status !== "Active") return false;
        if (statusFilter === "inactive" && x.status === "Active") return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            x.name.toLowerCase().includes(q) ||
            String(x.details.prefix || "").toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [snapshot.references, search, statusFilter]);

  const directAssetsCount = (item: ReferenceRecord) =>
    snapshot.assets.filter(
      (asset) =>
        (asset.currentLocationId === item.id ||
          (!asset.currentLocationId && asset.location === item.name)) &&
        !["Disposed", "Archived"].includes(asset.status),
    ).length;

  const directChildrenCount = (item: ReferenceRecord) =>
    snapshot.references.filter(
      (child) =>
        child.kind === "location" &&
        child.status === "Active" &&
        child.mainLocationId === item.id &&
        child.id !== item.id
    ).length;

  async function change(
    location: ReferenceRecord,
    action: "reference.delete" | "reference.archive" | "reference.restore",
  ) {
    const r = await repository.execute({
      action,
      entityId: location.id,
      values: { kind: location.kind },
    });
    setFeedback({ status: r.ok ? "success" : "error", message: r.message });
    if (r.ok) setDeleting(null);
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

      <div className="code-group-controls" aria-label="Hoofdlocatiesweergave">
        <label>
          <span>Zoeken</span>
          <input
            type="search"
            placeholder="Zoeken op naam of code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">Alle</option>
            <option value="active">Actief</option>
            <option value="inactive">Inactief</option>
          </select>
        </label>
      </div>

      <MutationFeedback {...feedback} />
      <div className="location-type-list">
        {locations.map((location, index) => (
          <article key={location.id}>
            <span className="location-type-order">{index + 1}</span>
            <div>
              <strong>{location.name}</strong>
              <small>
                Locatiecode <code>{String(location.details.prefix || "—")}</code> · Locaties {directChildrenCount(location)} · Assets {directAssetsCount(location)}
              </small>
              <small className="record-audit">
                {nl ? "Toegevoegd" : "Added"}:{" "}
                {location.createdBy || "—"} ·{" "}
                {location.createdAt
                  ? formatDateTime(location.createdAt)
                  : "—"}
                {location.updatedBy
                  ? ` · ${nl ? "Gewijzigd" : "Updated"}: ${
                      location.updatedBy
                    } · ${formatDateTime(location.updatedAt || "")}`
                  : ""}
              </small>
            </div>
            <Badge tone={location.status === "Active" ? "success" : "neutral"}>
              {location.status === "Active" ? "Actief" : "Inactief"}
            </Badge>
            <div className="location-type-actions">
              <Button
                variant="ghost"
                title="Hoofdlocatie bijwerken"
                aria-label={`${location.name} bijwerken`}
                onClick={() => setEditing(location)}
              >
                <Pencil />
              </Button>
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
        open={adding || !!editing}
        title={editing ? "Hoofdlocatie bijwerken" : "Hoofdlocatie toevoegen"}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      >
        <MainLocationForm
          editing={editing}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
          }}
          onCancel={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
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
            values: { reason, kind: deleting.kind },
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

function CodeGroupsSettings() {
  const { formatDateTime, language } = useApp(),
    nl = language === "nl",
    repository = useRepository(),
    snapshot = useMockSnapshot();
  const [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<CodeGroup | null>(null),
    [deleting, setDeleting] = useState<CodeGroup | null>(null),
    [pageSize, setPageSize] = useState(15),
    [page, setPage] = useState(1),
    [sortBy, setSortBy] = useState<
      "alphabetical" | "created-new" | "created-old"
    >("alphabetical"),
    [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all"),
    [feedback, setFeedback] = useState<Feedback>({
      status: "idle",
      message: "",
    });

  const sortedGroups = useMemo(() => {
    let groups = snapshot.codeGroups.filter((group) => !group.archived);
    if (statusFilter === "active") groups = groups.filter((g) => g.isActive);
    if (statusFilter === "inactive") groups = groups.filter((g) => !g.isActive);
    if (search) {
      const q = search.toLowerCase();
      groups = groups.filter(
        (g) =>
          g.name.toLowerCase().includes(q) || g.prefix.toLowerCase().includes(q)
      );
    }
    if (sortBy === "alphabetical")
      return groups.sort((a, b) =>
        a.name.localeCompare(b.name, "nl", { sensitivity: "base" }),
      );
    return groups.sort((a, b) => {
      const difference =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortBy === "created-new" ? -difference : difference;
    });
  }, [snapshot.codeGroups, sortBy, search, statusFilter]);

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
          <span>Zoeken</span>
          <input
            type="search"
            placeholder="Zoeken op naam of code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="all">Alle</option>
            <option value="active">Actief</option>
            <option value="inactive">Inactief</option>
          </select>
        </label>
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
                Volgende {group.prefix}{group.nextAvailableNumber}
              </small>
              <small className="record-audit">
                {nl ? "Toegevoegd" : "Added"}: {group.createdBy || "—"} ·{" "}
                {group.createdAt ? formatDateTime(group.createdAt) : "—"}
                {group.updatedBy
                  ? ` · ${nl ? "Gewijzigd" : "Updated"}: ${
                      group.updatedBy
                    } · ${formatDateTime(group.updatedAt)}`
                  : ""}
              </small>
            </div>
            <Badge tone={group.isActive ? "success" : "neutral"}>
              {group.isActive ? "Actief" : "Inactief"}
            </Badge>
            <div className="location-type-actions">
              <Button
                variant="ghost"
                title="Codegroep bijwerken"
                aria-label={`${group.name} bijwerken`}
                onClick={() => setEditing(group)}
              >
                <Pencil />
              </Button>
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
        open={adding || !!editing}
        title={editing ? "Codegroep bijwerken" : "Codegroep toevoegen"}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      >
        <CodeGroupForm
          group={editing}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
          }}
          onCancel={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
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
      <div className="subnav" role="tablist">
        <button
          type="button"
          className={tab === "locations" ? "active" : ""}
          onClick={() => setTab("locations")}
        >
          Hoofdlocaties
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
        <MainLocationsSettings />
      ) : (
        <CodeGroupsSettings />
      )}
    </div>
  );
}
