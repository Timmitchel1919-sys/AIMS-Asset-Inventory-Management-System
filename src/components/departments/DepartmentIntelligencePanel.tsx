import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  Boxes,
  Check,
  Edit3,
  History as HistoryIcon,
  Laptop,
  ListChecks,
  Plus,
} from "lucide-react";
import { Badge, Button, Field, SelectField, TextAreaField } from "../ui";
import { Dialog, MutationFeedback } from "../WorkflowUi";
import { DataTable, type DataColumn } from "../DataTable";
import { StatusBadge } from "../AssetStatusBadge";
import { ConditionBadge } from "../ConditionBadge";
import { assetAssigneeName } from "../../domain/assetLookups";
import { can } from "../../auth/permissions";
import { useApp } from "../../context/AppContext";
import { useMockSnapshot, useRepository } from "../../data/repositoryContext";
import type { ReferenceRecord } from "../../data/contracts";
import {
  assetsForDepartment,
  departmentActivityFeed,
  departmentAssetSummary,
  departmentHistoryEvents,
  departmentLocationLabel,
  departmentMovements,
  isIctCategory,
  type DepartmentActivityItem,
} from "../../domain/departmentIntelligence";
import type { Asset, AssetStatus, Condition } from "../../domain/types";
import { ASSET_CONDITIONS } from "../../domain/assetCondition";
import "./DepartmentIntelligencePanel.css";

type Tab = "ict" | "all" | "activity" | "history";
type HistoryFilter =
  | "all"
  | "TRANSFER"
  | "RETURN"
  | "ASSIGN"
  | "MAINTENANCE"
  | "DISPOSE";

const HISTORY_FILTERS: { value: HistoryFilter; en: string; nl: string }[] = [
  { value: "all", en: "All", nl: "Alle" },
  { value: "TRANSFER", en: "Transfers", nl: "Overplaatsingen" },
  { value: "RETURN", en: "Returns", nl: "Retouren" },
  { value: "ASSIGN", en: "Assignments", nl: "Toewijzingen" },
  { value: "MAINTENANCE", en: "Maintenance", nl: "Onderhoud" },
  { value: "DISPOSE", en: "Disposals", nl: "Afvoer" },
];

const ALL_STATUSES: AssetStatus[] = [
  "Available",
  "Assigned",
  "Borrowed",
  "Under Repair",
  "Under Maintenance",
  "Reserved",
  "Lost",
  "Missing",
  "Damaged",
  "Disposed",
  "Archived",
];

/** The transaction/event "kind" an activity item represents, for the History filter. */
function activityKind(item: DepartmentActivityItem): HistoryFilter {
  const raw =
    item.kind === "movement"
      ? item.movement.transactionType || item.movement.type
      : item.event.eventType;
  const value = String(raw || "").toUpperCase();
  if (value.includes("RETURN")) return "RETURN";
  if (value.includes("TRANSFER") || value.includes("MOVE")) return "TRANSFER";
  if (value.includes("ASSIGN")) return "ASSIGN";
  if (value.includes("MAINTENANCE") || value.includes("REPAIR"))
    return "MAINTENANCE";
  if (value.includes("DISPOS")) return "DISPOSE";
  return "all";
}

function ActivityCard({
  item,
  nl,
}: {
  item: DepartmentActivityItem;
  nl: boolean;
}) {
  if (item.kind === "movement") {
    const m = item.movement;
    return (
      <li className="dept-activity-card">
        <Badge tone="info">{m.transactionType || m.type}</Badge>
        <p className="dept-activity-card__title">
          {m.asset} <code>{m.assetCode}</code>
        </p>
        <dl>
          <div>
            <dt>{nl ? "Van" : "From"}</dt>
            <dd>{m.from || "—"}</dd>
          </div>
          <div>
            <dt>{nl ? "Naar" : "To"}</dt>
            <dd>{m.to || "—"}</dd>
          </div>
          <div>
            <dt>{nl ? "Datum" : "Date"}</dt>
            <dd>{m.date || "—"}</dd>
          </div>
          <div>
            <dt>{nl ? "Uitgevoerd door" : "Performed by"}</dt>
            <dd>{m.by || "—"}</dd>
          </div>
        </dl>
      </li>
    );
  }
  const e = item.event;
  const prevStatus = e.previous?.status as string | undefined;
  const nextStatus = e.next?.status as string | undefined;
  return (
    <li className="dept-activity-card">
      <Badge tone="neutral">{e.category}</Badge>
      <p className="dept-activity-card__title">
        {e.title} <code>{e.assetCode}</code>
      </p>
      {prevStatus && nextStatus && prevStatus !== nextStatus ? (
        <p className="dept-activity-card__status-change">
          {nl ? "Status gewijzigd" : "Status changed"}: {prevStatus} →{" "}
          {nextStatus}
        </p>
      ) : (
        e.description && <p>{e.description}</p>
      )}
      <dl>
        <div>
          <dt>{nl ? "Datum" : "Date"}</dt>
          <dd>{(e.occurredAt || e.createdAt || "").slice(0, 10) || "—"}</dd>
        </div>
        <div>
          <dt>{nl ? "Uitgevoerd door" : "Performed by"}</dt>
          <dd>{e.performedBy || e.createdBy || "—"}</dd>
        </div>
      </dl>
    </li>
  );
}

/** Dialog to add / assign assets to the department, with location filter. */
function AddAssetToDeptDialog({
  department,
  onClose,
  nl,
}: {
  department: ReferenceRecord;
  onClose: () => void;
  nl: boolean;
}) {
  const repository = useRepository();
  const snapshot = useMockSnapshot();
  const [locFilter, setLocFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  const deptName = department.name;
  const currentDeptAssets = useMemo(
    () => assetsForDepartment(snapshot.assets, deptName, department.id),
    [snapshot.assets, deptName, department.id],
  );
  const deptAssetIdSet = useMemo(
    () => new Set(currentDeptAssets.map((a) => a.id)),
    [currentDeptAssets],
  );

  const candidateAssets = useMemo(() => {
    return snapshot.assets.filter((a) => !deptAssetIdSet.has(a.id));
  }, [snapshot.assets, deptAssetIdSet]);

  const activeLocations = useMemo(() => {
    return snapshot.references
      .filter((r) => r.kind === "location" && r.status === "Active")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [snapshot.references]);

  const filteredCandidates = useMemo(() => {
    return candidateAssets.filter((a) => {
      if (locFilter !== "all") {
        const matchesLoc =
          a.currentLocationId === locFilter ||
          a.mainLocationId === locFilter ||
          a.location === locFilter ||
          snapshot.references.find((r) => r.id === locFilter)?.name === a.location;
        if (!matchesLoc) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesSearch =
          a.name.toLowerCase().includes(q) ||
          a.code.toLowerCase().includes(q) ||
          (a.serialNumber && a.serialNumber.toLowerCase().includes(q)) ||
          (a.brand && a.brand.toLowerCase().includes(q)) ||
          (a.model && a.model.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [candidateAssets, locFilter, search, snapshot.references]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCandidates.map((a) => a.id));
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    setFeedback({
      status: "loading",
      message: nl ? "Middelen toewijzen aan afdeling…" : "Assigning assets to department…",
    });

    const { location: deptLoc } = departmentLocationLabel(snapshot.references, department);

    try {
      for (const assetId of selectedIds) {
        const asset = snapshot.assets.find((a) => a.id === assetId);
        if (!asset) continue;
        const res = await repository.execute({
          action: "asset.edit",
          entityId: asset.id,
          values: {
            ...asset,
            department: deptName,
            departmentId: department.id,
            location: deptLoc || asset.location,
            currentLocationId: department.containerLocationId || department.mainLocationId || asset.currentLocationId,
          },
        });
        if (!res.ok) {
          setFeedback({ status: "error", message: res.message });
          return;
        }
      }
      setFeedback({
        status: "success",
        message: nl
          ? `${selectedIds.length} middel(en) succesvol toegevoegd aan ${deptName}.`
          : `${selectedIds.length} asset(s) successfully assigned to ${deptName}.`,
      });
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: unknown) {
      setFeedback({
        status: "error",
        message: err instanceof Error ? err.message : "Er is een fout opgetreden.",
      });
    }
  };

  return (
    <Dialog
      open={true}
      title={nl ? `Middelen toevoegen aan ${deptName}` : `Add assets to ${deptName}`}
      description={
        nl
          ? "Selecteer middelen om toe te wijzen aan deze afdeling. Filter optioneel op locatie."
          : "Select assets to assign to this department. Optionally filter by location."
      }
      onClose={onClose}
    >
      <form onSubmit={handleAdd} className="workflow-form">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", width: "100%" }}>
          <SelectField
            name="locFilter"
            label={nl ? "Filter op locatie" : "Filter by location"}
            value={locFilter}
            onChange={(e) => setLocFilter(e.target.value)}
          >
            <option value="all">{nl ? "Alle locaties" : "All locations"}</option>
            {activeLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.type ? `(${loc.type})` : ""}
              </option>
            ))}
          </SelectField>
          <Field
            name="search"
            label={nl ? "Zoeken" : "Search"}
            placeholder={nl ? "Zoek op naam, code, merk…" : "Search by name, code, brand…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ marginTop: "12px", width: "100%" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0}
                onChange={toggleSelectAll}
                disabled={filteredCandidates.length === 0}
              />
              <span>
                {nl ? "Alles selecteren" : "Select all"} ({filteredCandidates.length}{" "}
                {nl ? "beschikbaar" : "available"})
              </span>
            </label>
            <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
              {selectedIds.length} {nl ? "geselecteerd" : "selected"}
            </span>
          </div>

          <div
            style={{
              maxHeight: "260px",
              overflowY: "auto",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "4px",
            }}
          >
            {filteredCandidates.length === 0 ? (
              <p style={{ padding: "16px", textAlign: "center", color: "var(--color-text-muted)" }}>
                {nl ? "Geen beschikbare middelen gevonden." : "No available assets found."}
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px", width: "30px" }}></th>
                    <th style={{ padding: "6px 8px" }}>Inv.code</th>
                    <th style={{ padding: "6px 8px" }}>{nl ? "Middel" : "Asset"}</th>
                    <th style={{ padding: "6px 8px" }}>{nl ? "Huidige afdeling" : "Current Dept"}</th>
                    <th style={{ padding: "6px 8px" }}>{nl ? "Locatie" : "Location"}</th>
                    <th style={{ padding: "6px 8px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((a) => {
                    const isSelected = selectedIds.includes(a.id);
                    return (
                      <tr
                        key={a.id}
                        onClick={() => toggleSelect(a.id)}
                        style={{
                          cursor: "pointer",
                          backgroundColor: isSelected ? "var(--color-primary-light, #e8f5e9)" : "transparent",
                          borderBottom: "1px solid var(--color-border)",
                        }}
                      >
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(a.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td style={{ padding: "6px 8px", fontWeight: "bold" }}>{a.code}</td>
                        <td style={{ padding: "6px 8px" }}>{a.name}</td>
                        <td style={{ padding: "6px 8px" }}>{a.department || "—"}</td>
                        <td style={{ padding: "6px 8px" }}>{a.location || "—"}</td>
                        <td style={{ padding: "6px 8px" }}>
                          <StatusBadge status={a.status} size="compact" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="wide" style={{ marginTop: "14px" }}>
          <MutationFeedback {...feedback} />
          <div className="actions" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={onClose}>
              {nl ? "Annuleren" : "Cancel"}
            </Button>
            <Button type="submit" variant="primary" disabled={selectedIds.length === 0}>
              <Check size={14} />
              {nl ? `Toevoegen (${selectedIds.length})` : `Add (${selectedIds.length})`}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

/** Dialog to edit an asset directly from the department view. */
function EditAssetInDeptDialog({
  asset,
  department,
  onClose,
  nl,
}: {
  asset: Asset;
  department: ReferenceRecord;
  onClose: () => void;
  nl: boolean;
}) {
  const repository = useRepository();
  const snapshot = useMockSnapshot();
  const [feedback, setFeedback] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  const [name, setName] = useState(asset.name || "");
  const [category, setCategory] = useState(asset.category || "");
  const [brand, setBrand] = useState(asset.brand || "");
  const [model, setModel] = useState(asset.model || "");
  const [serialNumber, setSerialNumber] = useState(asset.serialNumber || "");
  const [status, setStatus] = useState<AssetStatus>(asset.status);
  const [condition, setCondition] = useState<Condition>(asset.condition);
  const [currentLocationId, setCurrentLocationId] = useState(asset.currentLocationId || "");
  const [departmentName, setDepartmentName] = useState(asset.department || department.name);
  const [assignedTo, setAssignedTo] = useState(asset.assignedTo || "");
  const [notes, setNotes] = useState(asset.notes || "");

  const activeLocations = useMemo(
    () => snapshot.references.filter((r) => r.kind === "location" && r.status === "Active"),
    [snapshot.references],
  );
  const activeDepartments = useMemo(
    () => snapshot.references.filter((r) => r.kind === "department" && r.status === "Active"),
    [snapshot.references],
  );
  const activeCategories = useMemo(
    () => snapshot.references.filter((r) => r.kind === "category" && r.status === "Active"),
    [snapshot.references],
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback({ status: "loading", message: nl ? "Middel opslaan…" : "Saving asset…" });

    const selectedLoc = snapshot.references.find((r) => r.id === currentLocationId);
    const selectedDept = snapshot.references.find(
      (r) => r.kind === "department" && (r.name === departmentName || r.id === departmentName),
    );

    const res = await repository.execute({
      action: "asset.edit",
      entityId: asset.id,
      values: {
        ...asset,
        name,
        category,
        brand,
        model,
        serialNumber,
        status,
        condition,
        currentLocationId: selectedLoc?.id || null,
        location: selectedLoc?.name || asset.location,
        mainLocationId:
          selectedLoc?.type === "Main location"
            ? selectedLoc.id
            : selectedLoc?.mainLocationId || null,
        department: selectedDept?.name || departmentName,
        departmentId: selectedDept?.id || null,
        assignedTo,
        notes,
      },
    });

    if (res.ok) {
      setFeedback({
        status: "success",
        message: nl ? "Middel succesvol bijgewerkt." : "Asset successfully updated.",
      });
      setTimeout(() => {
        onClose();
      }, 600);
    } else {
      setFeedback({ status: "error", message: res.message });
    }
  };

  return (
    <Dialog
      open={true}
      title={nl ? `Middel bewerken: ${name}` : `Edit asset: ${name}`}
      description={`${asset.code} · ${serialNumber || "Geen serienummer"}`}
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="workflow-form">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", width: "100%" }}>
          <Field
            name="name"
            label={nl ? "Naam van middel *" : "Asset name *"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <SelectField
            name="category"
            label={nl ? "Categorie *" : "Category *"}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="">{nl ? "Selecteer categorie" : "Select category"}</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
            {category && !activeCategories.some((c) => c.name === category) && (
              <option value={category}>{category}</option>
            )}
          </SelectField>

          <Field
            name="brand"
            label={nl ? "Merk" : "Brand"}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
          <Field
            name="model"
            label="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />

          <Field
            name="serialNumber"
            label={nl ? "Serienummer" : "Serial number"}
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
          <SelectField
            name="status"
            label="Status *"
            value={status}
            onChange={(e) => setStatus(e.target.value as AssetStatus)}
            required
          >
            {ALL_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </SelectField>

          <SelectField
            name="condition"
            label={nl ? "Conditie *" : "Condition *"}
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
            required
          >
            {ASSET_CONDITIONS.map((cd) => (
              <option key={cd} value={cd}>
                {cd}
              </option>
            ))}
          </SelectField>
          <SelectField
            name="location"
            label={nl ? "Locatie" : "Location"}
            value={currentLocationId}
            onChange={(e) => setCurrentLocationId(e.target.value)}
          >
            <option value="">{nl ? "Selecteer locatie" : "Select location"}</option>
            {activeLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.type ? `(${loc.type})` : ""}
              </option>
            ))}
          </SelectField>

          <SelectField
            name="department"
            label={nl ? "Afdeling *" : "Department *"}
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            required
          >
            {activeDepartments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
            {departmentName && !activeDepartments.some((d) => d.name === departmentName) && (
              <option value={departmentName}>{departmentName}</option>
            )}
          </SelectField>
          <Field
            name="assignedTo"
            label={nl ? "Toegewezen aan" : "Assigned to"}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          />
        </div>

        <TextAreaField
          className="wide"
          name="notes"
          label={nl ? "Notities" : "Notes"}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="wide">
          <MutationFeedback {...feedback} />
          <div className="actions" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={onClose}>
              {nl ? "Annuleren" : "Cancel"}
            </Button>
            <Button type="submit" variant="primary">
              <Check size={14} />
              {nl ? "Opslaan" : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

export function DepartmentIntelligencePanel({
  department,
  onClose,
}: {
  department: ReferenceRecord | null;
  onClose: () => void;
}) {
  const app = useApp();
  const nl = app.language === "nl";
  const role = app.user?.role;
  const navigate = useNavigate();
  const snapshot = useMockSnapshot();
  const [tab, setTab] = useState<Tab>("ict");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const canViewAssets = can(role, "assets.view");
  const canViewHistory = can(role, "history.view");

  const deptName = department?.name || "";
  const deptAssets = useMemo(
    () => assetsForDepartment(snapshot.assets, deptName, department?.id),
    [snapshot.assets, deptName, department?.id],
  );
  const ictAssets = useMemo(
    () => deptAssets.filter((a) => isIctCategory(a.category, snapshot.references)),
    [deptAssets, snapshot.references],
  );
  const summary = useMemo(
    () => departmentAssetSummary(deptAssets, snapshot.references),
    [deptAssets, snapshot.references],
  );
  const { location, subLocation } = useMemo(
    () =>
      department
        ? departmentLocationLabel(snapshot.references, department)
        : { location: "", subLocation: "" },
    [snapshot.references, department],
  );
  const activity = useMemo(
    () =>
      departmentActivityFeed(
        snapshot.movements,
        snapshot.assetHistoryEvents,
        deptName,
        8,
        deptAssets,
      ),
    [snapshot.movements, snapshot.assetHistoryEvents, deptName, deptAssets],
  );
  const fullHistory = useMemo(() => {
    const merged: DepartmentActivityItem[] = [
      ...departmentMovements(snapshot.movements, deptName, deptAssets).map(
        (movement): DepartmentActivityItem => ({
          kind: "movement",
          at: movement.date || "",
          movement,
        }),
      ),
      ...departmentHistoryEvents(snapshot.assetHistoryEvents, deptName, deptAssets).map(
        (event): DepartmentActivityItem => ({
          kind: "history",
          at: event.occurredAt || event.createdAt || "",
          event,
        }),
      ),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return historyFilter === "all"
      ? merged
      : merged.filter((item) => activityKind(item) === historyFilter);
  }, [snapshot.movements, snapshot.assetHistoryEvents, deptName, deptAssets, historyFilter]);

  const openAsset = (asset: Asset) => {
    onClose();
    navigate(`/assets/${asset.id}`);
  };

  const assetColumns: DataColumn<Asset>[] = [
    {
      id: "code",
      label: "Inv.code",
      render: (a) => <strong>{a.code}</strong>,
      text: (a) => a.code,
      sortable: true,
    },
    {
      id: "name",
      label: nl ? "Middel" : "Asset",
      render: (a) => a.name,
      text: (a) => a.name,
      sortable: true,
    },
    {
      id: "category",
      label: nl ? "Categorie" : "Category",
      render: (a) => a.category,
      text: (a) => a.category,
      sortable: true,
    },
    {
      id: "brand",
      label: nl ? "Merk" : "Brand",
      render: (a) => a.brand || "—",
      text: (a) => a.brand || "",
      sortable: true,
    },
    {
      id: "condition",
      label: nl ? "Conditie" : "Condition",
      render: (a) => <ConditionBadge condition={a.condition} size="compact" />,
      text: (a) => a.condition,
      sortable: true,
    },
    {
      id: "status",
      label: "Status",
      render: (a) => <StatusBadge status={a.status} size="compact" />,
      text: (a) => a.status,
      sortable: true,
    },
    {
      id: "assignee",
      label: nl ? "Toegewezen aan" : "Assigned to",
      render: (a) => assetAssigneeName(a, snapshot.users) || "—",
      text: (a) => assetAssigneeName(a, snapshot.users),
      sortable: true,
    },
    {
      id: "actions",
      label: nl ? "Actie" : "Action",
      render: (a) => (
        <Button
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            setEditingAsset(a);
          }}
        >
          <Edit3 size={13} />
          {nl ? "Bewerken" : "Edit"}
        </Button>
      ),
      text: () => "",
    },
  ];

  const title = deptName;
  const description = nl
    ? "Live overzicht — komt rechtstreeks uit de actuele middelgegevens."
    : "Live overview — derived directly from the current asset records.";

  return (
    <>
      <Dialog
        open={!!department}
        title={title}
        description={description}
        onClose={onClose}
        className="department-panel"
      >
        {department && (
          <div className="dept-panel">
            <dl className="dept-panel__meta">
              <div>
                <dt>{nl ? "Beheerder" : "Manager"}</dt>
                <dd>
                  {String(department.details.manager || "").trim() ||
                    (nl ? "Geen beheerder toegewezen." : "Manager not assigned.")}
                </dd>
              </div>
              <div>
                <dt>{nl ? "Locatie" : "Location"}</dt>
                <dd>{location || "—"}</dd>
              </div>
              <div>
                <dt>{nl ? "Sublocatie" : "Sub-location"}</dt>
                <dd>{subLocation || "—"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <Badge tone={department.status === "Active" ? "success" : "neutral"}>
                    {department.status}
                  </Badge>
                </dd>
              </div>
            </dl>

            <div className="dept-panel__kpis">
              <article>
                <small>{nl ? "Totaal middelen" : "Total Assets"}</small>
                <strong>{summary.total}</strong>
              </article>
              <article>
                <small>{nl ? "ICT-middelen" : "ICT Assets"}</small>
                <strong>{summary.ict}</strong>
              </article>
              <article>
                <small>{nl ? "Actief" : "Active"}</small>
                <strong>{summary.active}</strong>
              </article>
              <article>
                <small>{nl ? "Toegewezen" : "Assigned"}</small>
                <strong>{summary.assigned}</strong>
              </article>
              <article>
                <small>{nl ? "Onderhoud" : "Maintenance"}</small>
                <strong>{summary.maintenance}</strong>
              </article>
            </div>

            <div className="subnav dept-panel__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "ict"}
                className={tab === "ict" ? "active" : ""}
                onClick={() => setTab("ict")}
              >
                <Laptop size={14} />
                {nl ? "ICT-middelen" : "ICT Assets"} ({ictAssets.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "all"}
                className={tab === "all" ? "active" : ""}
                onClick={() => setTab("all")}
              >
                <Boxes size={14} />
                {nl ? "Alle middelen" : "All Assets"} ({deptAssets.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "activity"}
                className={tab === "activity" ? "active" : ""}
                onClick={() => setTab("activity")}
              >
                <ArrowLeftRight size={14} />
                {nl ? "Recente activiteit" : "Recent Activity"} ({activity.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "history"}
                className={tab === "history" ? "active" : ""}
                onClick={() => setTab("history")}
              >
                <HistoryIcon size={14} />
                {nl ? "Geschiedenis" : "History"} ({fullHistory.length})
              </button>
            </div>

            {(tab === "ict" || tab === "all") &&
              (canViewAssets ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      marginBottom: "6px",
                    }}
                  >
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => setAddAssetOpen(true)}
                    >
                      <Plus size={14} />
                      {nl ? "Middelen toevoegen aan afdeling" : "Add assets to department"}
                    </Button>
                  </div>
                  <DataTable
                    id={`dept-${department.id}-${tab}-assets`}
                    rows={tab === "ict" ? ictAssets : deptAssets}
                    columns={assetColumns}
                    rowKey={(a) => a.id}
                    onRowClick={openAsset}
                    searchPlaceholder={nl ? "Zoeken…" : "Search…"}
                    emptyTitle={
                      nl
                        ? "Geen middelen toegewezen aan deze afdeling."
                        : "No assets currently assigned to this department."
                    }
                    emptyDescription={
                      nl
                        ? "Gebruik de knop 'Middelen toevoegen aan afdeling' om middelen te koppelen."
                        : "Use the 'Add assets to department' button to link assets."
                    }
                  />
                </>
              ) : (
                <MutationFeedback
                  status="error"
                  message={
                    nl
                      ? "U heeft geen toestemming om middelen te bekijken."
                      : "You don't have permission to view assets."
                  }
                />
              ))}

            {tab === "activity" &&
              (activity.length ? (
                <ul className="dept-activity-list">
                  {activity.map((item) => (
                    <ActivityCard
                      key={
                        item.kind === "movement"
                          ? `m-${item.movement.id}`
                          : `h-${item.event.id}`
                      }
                      item={item}
                      nl={nl}
                    />
                  ))}
                </ul>
              ) : (
                <p className="dept-panel__empty">
                  <ListChecks size={16} />
                  {nl
                    ? "Nog geen afdelingsactiviteit geregistreerd."
                    : "No department activity recorded yet."}
                </p>
              ))}

            {tab === "history" &&
              (canViewHistory ? (
                <>
                  <div className="dept-panel__history-filter">
                    <label>
                      <span>{nl ? "Filter" : "Filter"}</span>
                      <select
                        value={historyFilter}
                        onChange={(e) =>
                          setHistoryFilter(e.target.value as HistoryFilter)
                        }
                      >
                        {HISTORY_FILTERS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {nl ? f.nl : f.en}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {fullHistory.length ? (
                    <ul className="dept-activity-list">
                      {fullHistory.map((item) => (
                        <ActivityCard
                          key={
                            item.kind === "movement"
                              ? `m-${item.movement.id}`
                              : `h-${item.event.id}`
                          }
                          item={item}
                          nl={nl}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="dept-panel__empty">
                      <ListChecks size={16} />
                      {nl
                        ? "Nog geen afdelingsgeschiedenis geregistreerd."
                        : "No department history recorded yet."}
                    </p>
                  )}
                </>
              ) : (
                <MutationFeedback
                  status="error"
                  message={
                    nl
                      ? "U heeft geen toestemming om geschiedenis te bekijken."
                      : "You don't have permission to view history."
                  }
                />
              ))}
          </div>
        )}
      </Dialog>

      {addAssetOpen && department && (
        <AddAssetToDeptDialog
          department={department}
          onClose={() => setAddAssetOpen(false)}
          nl={nl}
        />
      )}

      {editingAsset && department && (
        <EditAssetInDeptDialog
          asset={editingAsset}
          department={department}
          onClose={() => setEditingAsset(null)}
          nl={nl}
        />
      )}
    </>
  );
}
