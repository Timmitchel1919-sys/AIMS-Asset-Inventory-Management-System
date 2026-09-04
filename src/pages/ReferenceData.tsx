import { ArchiveRestore, Edit3, Plus, Trash2, Sparkles } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
import type { ReferenceKind, ReferenceRecord } from "../data/contracts";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { LocationTypeForm } from "../components/settings/LocationTypesSettings";
import { DepartmentIntelligencePanel } from "../components/departments/DepartmentIntelligencePanel";

function ParentLocationForm({
  onSaved,
  onCancel,
}: {
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const { language } = useApp(),
    nl = language === "nl",
    repository = useRepository(),
    snapshot = useMockSnapshot(),
    [typeId, setTypeId] = useState(""),
    [mainLocationId, setMainLocationId] = useState(""),
    [feedback, setFeedback] = useState<{
      status: "idle" | "loading" | "success" | "error";
      message: string;
    }>({ status: "idle", message: "" });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      type = snapshot.locationTypes.find((x) => x.id === typeId),
      container = snapshot.references.find(
        (x) => x.id === data.get("containerLocationId"),
      );
    setFeedback({
      status: "loading",
      message: nl ? "Bovenliggende locatie aanmaken…" : "Creating parent location…",
    });
    const result = await repository.execute({
      action: "reference.create",
      values: {
        kind: "location",
        name: data.get("name"),
        type: type?.name,
        typeId,
        mainLocationId,
        containerLocationId: container?.id || null,
        managerId: data.get("manager") || null,
        status: data.get("status"),
        details: { manager: String(data.get("manager") || "") },
      },
    });
    setFeedback({
      status: result.ok ? "success" : "error",
      message: result.message,
    });
    if (result.ok && result.entityId) onSaved(result.entityId);
  }
  return (
    <form className="workflow-form" onSubmit={submit}>
      <Field name="name" label={nl ? "Naam" : "Name"} required />
      <SelectField
        name="typeId"
        label="Type"
        value={typeId}
        onChange={(event) => setTypeId(event.target.value)}
        required
      >
        <option value="">{nl ? "Selecteer een type" : "Select a type"}</option>
        {snapshot.locationTypes
          .filter((x) => x.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
      </SelectField>
      <SelectField
        name="mainLocationId"
        label={nl ? "Hoofdlocatie" : "Main location"}
        value={mainLocationId}
        onChange={(event) => setMainLocationId(event.target.value)}
        required
      >
        <option value="">
          {nl ? "Selecteer een hoofdlocatie" : "Select a Main location"}
        </option>
        {snapshot.references
          .filter(
            (x) =>
              x.kind === "location" &&
              x.type === "Main location" &&
              x.status === "Active",
          )
          .map((main) => (
            <option key={main.id} value={main.id}>
              {main.name}
            </option>
          ))}
      </SelectField>
      <SelectField
        name="containerLocationId"
        label={nl ? "Bevindt zich in" : "Located inside"}
      >
        <option value="">
          {nl ? "Niet binnen een andere locatie" : "Not inside another location"}
        </option>
        {snapshot.references
          .filter(
            (x) =>
              x.kind === "location" &&
              x.status === "Active" &&
              x.type !== "Main location" &&
              x.mainLocationId === mainLocationId,
          )
          .map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} ({location.type})
            </option>
          ))}
      </SelectField>
      <Field
        name="manager"
        label={nl ? "Verantwoordelijke" : "Manager"}
      />
      <SelectField name="status" label="Status" defaultValue="Active">
        <option value="Active">{nl ? "Actief" : "Active"}</option>
        <option value="Archived">{nl ? "Inactief" : "Inactive"}</option>
      </SelectField>
      <div className="wide">
        <MutationFeedback {...feedback} />
        <div className="actions">
          <Button type="submit">
            {nl ? "Omvattende locatie aanmaken" : "Create containing location"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {nl ? "Annuleren" : "Cancel"}
          </Button>
        </div>
      </div>
    </form>
  );
}

const copy = {
  category: {
    en: [
      "Categories & asset types",
      "Manage classification, custom fields, maintenance defaults and code groups.",
      "Add category",
    ],
    nl: [
      "Categorieën en middeltypen",
      "Beheer classificatie, aangepaste velden, onderhoudsstandaarden en KCS-codegroepen.",
      "Categorie toevoegen",
    ],
  },
  location: {
    en: [
      "Location hierarchy",
      "Manage campuses, buildings, rooms and precise storage positions.",
      "Add location",
    ],
    nl: [
      "Locatiehiërarchie",
      "Beheer campussen, gebouwen, ruimten en nauwkeurige opslagposities.",
      "Locatie toevoegen",
    ],
  },
  department: {
    en: [
      "Departments",
      "Manage organizational ownership, responsible managers and linked locations.",
      "Add department",
    ],
    nl: [
      "Afdelingen",
      "Beheer organisatorisch eigenaarschap, verantwoordelijke managers en gekoppelde locaties.",
      "Afdeling toevoegen",
    ],
  },
} as const;
export default function ReferenceDataPage({ kind }: { kind: ReferenceKind }) {
  const { language, user } = useApp(),
    nl = language === "nl",
    repository = useRepository(),
    snapshot = useMockSnapshot(),
    labels = copy[kind][language];
  const location = useLocation(),
    navigate = useNavigate(),
    params = useParams();
  const routeId = params.categoryId || params.locationId || params.departmentId;
  const initialRecord =
    snapshot.references.find(
      (item) => item.kind === kind && item.id === routeId,
    ) || null;
  const [record, setRecord] = useState<ReferenceRecord | null>(initialRecord),
    [dialog, setDialog] = useState(
      location.pathname.endsWith("/new") || !!initialRecord,
    ),
    [confirm, setConfirm] = useState(false),
    [deleteConfirm, setDeleteConfirm] = useState(false),
    [typeDialog, setTypeDialog] = useState(false),
    [parentDialog, setParentDialog] = useState(false),
    [mainLocationDialog, setMainLocationDialog] = useState(false),
    [deptPanel, setDeptPanel] = useState<ReferenceRecord | null>(null),
    [insight, setInsight] = useState<{
      title: string;
      kind: "assets" | "children" | "tasks";
      location: ReferenceRecord;
    } | null>(null),
    [mainFilter, setMainFilter] = useState("all"),
    [typeFilter, setTypeFilter] = useState("all"),
    [statusFilter, setStatusFilter] = useState("all"),
    [selectedParentId, setSelectedParentId] = useState(
      initialRecord?.parentLocationId || initialRecord?.parentId || "",
    ),
    [selectedMainLocationId, setSelectedMainLocationId] = useState(
      initialRecord?.mainLocationId || "",
    ),
    [selectedTypeId, setSelectedTypeId] = useState(
      initialRecord?.typeId ||
        snapshot.locationTypes.find((x) => x.name === initialRecord?.type)
          ?.id ||
        "",
    );
  const [feedback, setFeedback] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const rows = useMemo(
    () => snapshot.references.filter((item) => item.kind === kind),
    [kind, snapshot.references],
  );
  const locations = snapshot.references.filter(
      (item) => item.kind === "location",
    ),
    mainLocations = locations.filter((item) => item.type === "Main location");
  const resolveMain = (item: ReferenceRecord) =>
    mainLocations.find(
      (main) =>
        main.id ===
        (item.type === "Main location" ? item.id : item.mainLocationId),
    );
  const locationHierarchyLabel = (item: ReferenceRecord) =>
    item.type === "Main location" && String(item.details.prefix || "").trim()
      ? String(item.details.prefix).trim().toUpperCase()
      : item.name;
  const directAssets = (item: ReferenceRecord) =>
    snapshot.assets.filter(
      (asset) =>
        (asset.currentLocationId === item.id ||
          (!asset.currentLocationId && asset.location === item.name)) &&
        !["Disposed", "Archived"].includes(asset.status),
    );
  const directChildren = (item: ReferenceRecord) =>
    locations.filter(
      (child) =>
        child.status === "Active" && child.containerLocationId === item.id,
    );
  const descendantIds = (item: ReferenceRecord) => {
    const ids: string[] = [];
    const visit = (id: string) =>
      locations
        .filter(
          (child) =>
            child.status === "Active" && child.containerLocationId === id,
        )
        .forEach((child) => {
          ids.push(child.id);
          visit(child.id);
        });
    visit(item.id);
    return ids;
  };
  const openTasks = (item: ReferenceRecord) => {
    const codes = new Set(directAssets(item).map((asset) => asset.code));
    return [
      ...snapshot.maintenance.filter(
        (task) =>
          task.status !== "Completed" &&
          (task.locationId === item.id || codes.has(task.assetCode)),
      ),
      ...snapshot.repairs.filter(
        (task) => task.status !== "Completed" && codes.has(task.assetCode),
      ),
    ];
  };
  const manager = (item: ReferenceRecord) =>
    String(
      item.details.manager ||
        snapshot.users.find(
          (user) => user.id === (item.managerUserId || item.managerId),
        )?.name ||
        (nl ? "Niet toegewezen" : "Not assigned"),
    );
  const statusLabel = (status: string) => {
    if (!nl) return status;
    const map: Record<string, string> = {
      Active: "Actief",
      Inactive: "Inactief",
      "Temporarily closed": "Tijdelijk gesloten",
      Archived: "Gearchiveerd",
    };
    return map[status] || status;
  };
  const typeOptionLabel = (value: string) => {
    if (!nl) return value;
    const map: Record<string, string> = {
      Serialized: "Geserialiseerd",
      "Quantity-based": "Hoeveelheidsgebaseerd",
      Mixed: "Gemengd",
      Department: "Afdeling",
    };
    return map[value] || value;
  };
  const locationColumns: DataColumn<ReferenceRecord>[] = [
    {
      id: "name",
      label: nl ? "Locatie" : "Location",
      render: (item) => (
        <button
          className="table-link"
          onClick={(event) => {
            event.stopPropagation();
            edit(item);
          }}
        >
          {locationHierarchyLabel(item)}
        </button>
      ),
      text: (item) =>
        `${locationHierarchyLabel(item)} ${item.name} ${resolveMain(item)?.name || ""} ${manager(item)}`,
      sortable: true,
    },
    {
      id: "type",
      label: "Type",
      render: (item) => item.type,
      text: (item) => item.type,
      sortable: true,
    },
    {
      id: "mainLocation",
      label: nl ? "Hoofdlocatie" : "Main location",
      render: (item) =>
        item.type === "Main location" ? (
          <span>{nl ? "Locatie op hoofdniveau" : "Top-level location"}</span>
        ) : resolveMain(item) ? (
          <button
            className="table-link"
            onClick={(event) => {
              event.stopPropagation();
              edit(resolveMain(item)!);
            }}
          >
            {locationHierarchyLabel(resolveMain(item)!)}
          </button>
        ) : (
          "—"
        ),
      text: (item) =>
        resolveMain(item) ? locationHierarchyLabel(resolveMain(item)!) : "",
      sortable: true,
    },
    {
      id: "assets",
      label: nl ? "Middelen op locatie" : "Assets at location",
      render: (item) => {
        const count = directAssets(item).length;
        return count ? (
          <button
            className="count-link location-column-value"
            title={
              nl
                ? "Actieve middelen die momenteel op deze fysieke locatie zijn geregistreerd."
                : "Active assets currently registered at this physical location."
            }
            onClick={(event) => {
              event.stopPropagation();
              setInsight({
                title: nl ? `Middelen op ${item.name}` : `Assets at ${item.name}`,
                kind: "assets",
                location: item,
              });
            }}
          >
            {count}
          </button>
        ) : (
          <span className="location-column-value">0</span>
        );
      },
      text: (item) => directAssets(item).length,
      sortable: true,
    },
    {
      id: "subLocations",
      label: nl ? "Sublocaties" : "Sub-locations",
      render: (item) => {
        const count = directChildren(item).length;
        return count ? (
          <button
            className="count-link location-column-value"
            title={
              nl
                ? "Actieve onderliggende locaties direct onder deze locatie."
                : "Active child locations directly below this location."
            }
            onClick={(event) => {
              event.stopPropagation();
              setInsight({
                title: nl
                  ? `Sublocaties in ${item.name}`
                  : `Sub-locations in ${item.name}`,
                kind: "children",
                location: item,
              });
            }}
          >
            {count}
          </button>
        ) : (
          <span className="location-column-value">0</span>
        );
      },
      text: (item) => directChildren(item).length,
      sortable: true,
    },
    {
      id: "openTasks",
      label: nl ? "Openstaande taken" : "Open tasks",
      render: (item) => {
        const count = openTasks(item).length;
        return count ? (
          <button
            className="count-link location-column-value"
            title={
              nl
                ? "Onafgeronde operationele taken die aan deze locatie zijn gekoppeld."
                : "Unfinished operational tasks associated with this location."
            }
            onClick={(event) => {
              event.stopPropagation();
              setInsight({
                title: nl
                  ? `Openstaande taken op ${item.name}`
                  : `Open tasks at ${item.name}`,
                kind: "tasks",
                location: item,
              });
            }}
          >
            {count}
          </button>
        ) : (
          <span className="location-column-value">0</span>
        );
      },
      text: (item) => openTasks(item).length,
      sortable: true,
    },
    {
      id: "manager",
      label: nl ? "Verantwoordelijke" : "Manager",
      render: (item) => <span className="location-column-value location-manager-value">{manager(item)}</span>,
      text: manager,
      sortable: true,
    },
    {
      id: "status",
      label: "Status",
      render: (item) => (
        <Badge
          tone={
            item.status === "Active"
              ? "success"
              : item.status === "Temporarily closed"
                ? "warning"
                : "neutral"
          }
        >
          {statusLabel(item.status)}
        </Badge>
      ),
      text: (item) => statusLabel(item.status),
      sortable: true,
    },
    {
      id: "actions",
      label: nl ? "Acties" : "Actions",
      render: (item) => (
        <details
          className="row-menu"
          onClick={(event) => event.stopPropagation()}
        >
          <summary>{nl ? "Acties" : "Actions"}</summary>
          <div>
            <button onClick={() => edit(item)}>
              {nl ? "Locatie bekijken" : "View location"}
            </button>
            <button onClick={() => edit(item)}>
              {nl ? "Locatie bewerken" : "Edit location"}
            </button>
            <button
              onClick={() => {
                edit(null);
                setSelectedMainLocationId(
                  item.type === "Main location"
                    ? item.id
                    : item.mainLocationId || "",
                );
                setSelectedParentId(item.id);
              }}
            >
              {nl ? "Sublocatie toevoegen" : "Add sub-location"}
            </button>
            <button
              onClick={() =>
                setInsight({
                  title: nl ? `Middelen op ${item.name}` : `Assets at ${item.name}`,
                  kind: "assets",
                  location: item,
                })
              }
            >
              {nl ? "Middelen bekijken" : "View assets"}
            </button>
            <button
              onClick={() =>
                setInsight({
                  title: nl
                    ? `Openstaande taken op ${item.name}`
                    : `Open tasks at ${item.name}`,
                  kind: "tasks",
                  location: item,
                })
              }
            >
              {nl ? "Taken bekijken" : "View tasks"}
            </button>
            <button onClick={() => edit(item)}>
              {nl
                ? "Verantwoordelijke toewijzen of wijzigen"
                : "Assign or change manager"}
            </button>
            <button
              onClick={() => {
                setRecord(item);
                setConfirm(true);
              }}
            >
              {item.status === "Active"
                ? nl
                  ? "Deactiveren"
                  : "Deactivate"
                : nl
                  ? "Archiveren"
                  : "Archive"}
            </button>
          </div>
        </details>
      ),
      text: () => "",
    },
  ];
  const legacyColumns: DataColumn<ReferenceRecord>[] = [
    {
      id: "name",
      label: nl ? "Naam" : "Name",
      render: (item) => <strong>{item.name}</strong>,
      text: (item) => item.name,
      sortable: true,
    },
    {
      id: "type",
      label: "Type",
      render: (item) => item.type,
      text: (item) => item.type,
      sortable: true,
    },
    {
      id: "parent",
      label: nl ? "Bovenliggende locatie" : "Parent",
      render: (item) => item.parent || "—",
      text: (item) => item.parent || "",
    },
    {
      id: "related",
      label: kind === "category" || kind === "department" ? (nl ? "Actieve middelen" : "Active assets") : (nl ? "Actieve koppelingen" : "Active links"),
      render: (item) => item.relatedCount,
      text: (item) => item.relatedCount,
      sortable: true,
    },
    {
      id: "details",
      label: kind === "category" || kind === "department" ? (nl ? "Beheerder" : "Manager") : (nl ? "Configuratie" : "Configuration"),
      render: (item) =>
        kind === "category" || kind === "department" ? String(item.details.manager || "—") : Object.entries(item.details)
          .slice(0, 2)
          .map(
            ([key, value]) =>
              `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`,
          )
          .join(" · "),
      text: (item) => kind === "category" || kind === "department" ? String(item.details.manager || "") : JSON.stringify(item.details),
    },
    {
      id: "status",
      label: "Status",
      render: (item) => (
        <Badge tone={item.status === "Active" ? "success" : "neutral"}>
          {statusLabel(item.status)}
        </Badge>
      ),
      text: (item) => statusLabel(item.status),
    },
  ];
  const departmentOverviewColumn: DataColumn<ReferenceRecord> = {
    id: "overview",
    label: "",
    render: (item) => (
      <button
        type="button"
        className="linklike department-overview-trigger"
        onClick={(event) => {
          event.stopPropagation();
          setDeptPanel(item);
        }}
      >
        <Sparkles size={14} />
        {nl ? "Overzicht" : "Overview"}
      </button>
    ),
    text: () => "",
  };
  const columns =
    kind === "location"
      ? locationColumns
      : kind === "department"
        ? [...legacyColumns, departmentOverviewColumn]
        : legacyColumns;
  const displayRows = rows
    .filter(
      (item) =>
        kind !== "location" ||
        mainFilter === "all" ||
        (item.type === "Main location" ? item.id : item.mainLocationId) ===
          mainFilter,
    )
    .filter(
      (item) =>
        kind !== "location" ||
        typeFilter === "all" ||
        item.typeId === typeFilter,
    )
    .filter(
      (item) =>
        kind !== "location" ||
        statusFilter === "all" ||
        item.status === statusFilter,
    );
  function edit(value: ReferenceRecord | null) {
    setRecord(value);
    setSelectedTypeId(
      value?.typeId ||
        snapshot.locationTypes.find((x) => x.name === value?.type)?.id ||
        "",
    );
    setFeedback({ status: "idle", message: "" });
    setSelectedParentId(value?.parentLocationId || value?.parentId || "");
    setSelectedMainLocationId(value?.mainLocationId || "");
    setDialog(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      selectedType = snapshot.locationTypes.find(
        (x) => x.id === selectedTypeId,
      ),
      parent = snapshot.references.find((x) => x.id === selectedParentId);
    const details: ReferenceRecord["details"] = {
      manager: String(data.get("manager") || ""),
      codeGroup: String(data.get("codeGroup") || ""),
      minimumStock: Number(data.get("minimumStock") || 0),
      maintenance: data.get("maintenance") === "on",
      storagePosition: String(data.get("storagePosition") || ""),
      capacity: Number(data.get("capacity") || 0),
      notes: String(data.get("notes") || ""),
      subcategories: String(data.get("subcategories") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    };
    if (kind === "department" && !selectedMainLocationId) {
      setFeedback({status:"error",message:nl?"Selecteer een hoofdlocatie.":"Please select a Main location."});
      return;
    }
    if (kind === "location" && (!selectedType || !selectedType.isActive)) {
      setFeedback({
        status: "error",
        message: nl
          ? "Selecteer een actief locatietype."
          : "Select an active location type.",
      });
      return;
    }
    const isTopLevel = selectedType?.id === "main-location";
    if (kind === "location" && !isTopLevel && !selectedMainLocationId) {
      setFeedback({
        status: "error",
        message: nl
          ? "Een hoofdlocatie is verplicht voor alle locaties die niet op hoofdniveau staan."
          : "Main location is required for all non-top-level locations.",
      });
      return;
    }
    if (kind === "location" && isTopLevel && !["administrator", "ict-staff"].includes(user?.role || "")) {
      setFeedback({
        status: "error",
        message: nl
          ? "Alleen geverifieerde IT-medewerkers mogen een hoofdlocatie aanmaken."
          : "Only authenticated IT members may create a Main location.",
      });
      return;
    }
    if (
      parent &&
      parent.mainLocationId !== selectedMainLocationId &&
      parent.id !== selectedMainLocationId
    ) {
      setFeedback({
        status: "error",
        message: nl
          ? "De omvattende locatie moet bij de geselecteerde hoofdlocatie horen."
          : "The containing location must belong to the selected Main location.",
      });
      return;
    }
    const invalidConfiguredParent =
      kind === "location" &&
      parent &&
      selectedType &&
      !selectedType.allowedParentTypeIds.includes(
        parent.typeId ||
          snapshot.locationTypes.find((x) => x.name === parent.type)?.id ||
          "",
      );
    const hierarchyMode = snapshot.systemSettings.hierarchyValidationMode;
    if (invalidConfiguredParent && hierarchyMode === "strict") {
      setFeedback({
        status: "error",
        message: nl
          ? `${parent.type} is geen toegestane bovenliggende locatie voor ${selectedType.name}.`
          : `${parent.type} is not an allowed parent for ${selectedType.name}.`,
      });
      return;
    }
    setFeedback({ status: "loading", message: nl ? "Opslaan…" : "Saving…" });
    const result = await repository.execute({
      action: record ? "reference.edit" : "reference.create",
      entityId: record?.id,
      values: {
        kind,
        name: data.get("name"),
        type: kind === "location" ? selectedType?.name : data.get("type"),
        typeId: kind === "location" ? selectedTypeId : undefined,
        parent: parent?.name || String(data.get("parent") || ""),
        parentId: parent?.id,
        parentLocationId: parent?.id || null,
        mainLocationId: isTopLevel ? null : selectedMainLocationId,
        containerLocationId: parent?.id || null,
        managerId: data.get("manager") || null,
        details,
        status: data.get("status"),
      },
    });
    setFeedback({
      status: result.ok ? "success" : "error",
      message:
        result.ok && invalidConfiguredParent && hierarchyMode === "warning"
          ? nl
            ? `Waarschuwing: ${parent?.type} is geen geconfigureerde bovenliggende locatie voor ${selectedType?.name}. Opgeslagen omdat de validatiemodus op waarschuwing staat.`
            : `Warning: ${parent?.type} is not a configured parent for ${selectedType?.name}. Saved because validation mode is warning.`
          : result.message,
    });
    if (result.ok) setTimeout(() => setDialog(false), 300);
  }
  async function changeArchive() {
    if (!record) return;
    const result = await repository.execute({
      action:
        record.status === "Active" ? "reference.archive" : "reference.restore",
      entityId: record.id,
    });
    setFeedback({
      status: result.ok ? "success" : "error",
      message: result.message,
    });
    if (result.ok) setDialog(false);
  }
  async function moveToRecycleBin() {
    if (!record) return;
    const result = await repository.execute({
      action: "reference.archive",
      entityId: record.id,
      values: { reason: nl ? "Verwijderd vanuit de module" : "Deleted from module" },
    });
    setFeedback({ status: result.ok ? "success" : "error", message: result.message });
    if (result.ok) {
      setDeleteConfirm(false);
      setDialog(false);
    }
  }
  return (
    <OfflineGate>
      <div className={`page reference-data-page reference-data-${kind}`}>
        <PageHeader
          title={labels[0]}
          description={labels[1]}
          actions={
            <Button onClick={() => edit(null)}>
              <Plus />
              {labels[2]}
            </Button>
          }
        />
        <section className="card data-card">
          <DataTable
            id={`${kind}s`}
            rows={displayRows}
            columns={columns}
            rowKey={(item) => item.id}
            searchPlaceholder={nl ? "Zoeken…" : "Search…"}
            emptyTitle={nl ? "Geen records" : "No records"}
            emptyDescription={
              nl ? "Voeg het eerste record toe." : "Add the first record."
            }
            onRowClick={edit}
            filters={
              kind === "location" ? (
                <div className="location-filters">
                  <select
                    aria-label={nl ? "Hoofdlocatie" : "Main location"}
                    value={mainFilter}
                    onChange={(event) => setMainFilter(event.target.value)}
                  >
                    <option value="all">
                      {nl ? "Alle hoofdlocaties" : "All main locations"}
                    </option>
                    {mainLocations.map((main) => (
                      <option key={main.id} value={main.id}>
                        {main.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="location-type-filter"
                    aria-label={nl ? "Locatietype" : "Location type"}
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                  >
                    <option value="all">
                      {nl ? "Alle typen" : "All types"}
                    </option>
                    {snapshot.locationTypes
                      .filter((type) => type.isActive)
                      .map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                  </select>
                  <select
                    aria-label="Status"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">
                      {nl ? "Alle statussen" : "All statuses"}
                    </option>
                    <option value="Active">{nl ? "Actief" : "Active"}</option>
                    <option value="Inactive">
                      {nl ? "Inactief" : "Inactive"}
                    </option>
                    <option value="Temporarily closed">
                      {nl ? "Tijdelijk gesloten" : "Temporarily closed"}
                    </option>
                    <option value="Archived">
                      {nl ? "Gearchiveerd" : "Archived"}
                    </option>
                  </select>
                </div>
              ) : undefined
            }
          />
        </section>
        <Dialog
          open={dialog}
          title={record ? (nl ? "Record bewerken" : "Edit record") : labels[2]}
          description={record ? record.name : labels[1]}
          onClose={() => setDialog(false)}
        >
          {kind === "location" && record && (
            <div className="location-detail-summary">
              <div>
                <small>{nl ? "Hoofdlocatie" : "Main location"}</small>
                <strong>
                  {resolveMain(record)?.name ||
                    (nl ? "Locatie op hoofdniveau" : "Top-level location")}
                </strong>
              </div>
              <div>
                <small>{nl ? "Bevindt zich in" : "Located inside"}</small>
                <strong>
                  {locations.find(
                    (item) => item.id === record.containerLocationId,
                  )?.name || "—"}
                </strong>
              </div>
              <div>
                <small>{nl ? "Verantwoordelijke" : "Manager"}</small>
                <strong>{manager(record)}</strong>
              </div>
              <div>
                <small>{nl ? "Directe middelen" : "Direct assets"}</small>
                <strong>{directAssets(record).length}</strong>
              </div>
              <div>
                <small>
                  {nl ? "Middelen in sublocaties" : "Assets in sub-locations"}
                </small>
                <strong>
                  {
                    snapshot.assets.filter(
                      (asset) =>
                        asset.currentLocationId &&
                        descendantIds(record).includes(
                          asset.currentLocationId,
                        ) &&
                        !["Disposed", "Archived"].includes(asset.status),
                    ).length
                  }
                </strong>
              </div>
              <div>
                <small>
                  {nl ? "Totaal binnen hiërarchie" : "Total within hierarchy"}
                </small>
                <strong>
                  {directAssets(record).length +
                    snapshot.assets.filter(
                      (asset) =>
                        asset.currentLocationId &&
                        descendantIds(record).includes(
                          asset.currentLocationId,
                        ) &&
                        !["Disposed", "Archived"].includes(asset.status),
                    ).length}
                </strong>
              </div>
              <div>
                <small>{nl ? "Sublocaties" : "Sub-locations"}</small>
                <strong>{directChildren(record).length}</strong>
              </div>
              <div>
                <small>{nl ? "Openstaande taken" : "Open tasks"}</small>
                <strong>{openTasks(record).length}</strong>
              </div>
            </div>
          )}
          <form className="workflow-form" onSubmit={save}>
            <Field
              name="name"
              label={nl ? "Naam" : "Name"}
              defaultValue={record?.name}
              required
            />
            {kind === "location" ? (
              <SelectField
                name="typeId"
                label="Type"
                value={selectedTypeId}
                onChange={(event) => {
                  if (event.target.value === "__add__") {
                    setTypeDialog(true);
                    return;
                  }
                  setSelectedTypeId(event.target.value);
                }}
                required
              >
                <option value="">
                  {nl ? "Selecteer een type" : "Select a type"}
                </option>
                {[...snapshot.locationTypes]
                  .filter((type) => type.isActive || type.id === selectedTypeId)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                {user && (
                  <option value="__add__">
                    {nl
                      ? "+ Nieuw locatietype toevoegen"
                      : "+ Add new location type"}
                  </option>
                )}
              </SelectField>
            ) : (
              <SelectField
                name="type"
                label="Type"
                defaultValue={record?.type}
                required
              >
                {(kind === "category"
                  ? ["Serialized", "Quantity-based", "Mixed"]
                  : ["Department"]
                ).map((value) => (
                  <option key={value} value={value}>
                    {typeOptionLabel(value)}
                  </option>
                ))}
              </SelectField>
            )}
            {kind === "location" ? (
              <>
                <SelectField
                  name="mainLocationId"
                  label={nl ? "Hoofdlocatie" : "Main location"}
                  value={selectedMainLocationId}
                  onChange={(event) => {
                    setSelectedMainLocationId(event.target.value);
                    setSelectedParentId("");
                  }}
                  required={selectedTypeId !== "main-location"}
                  disabled={selectedTypeId === "main-location"}
                >
                  <option value="">
                    {nl ? "Selecteer een hoofdlocatie" : "Select a Main location"}
                  </option>
                  {mainLocations.map((main) => (
                    <option key={main.id} value={main.id}>
                      {main.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  name="parentId"
                  label={nl ? "Bevindt zich in" : "Located inside"}
                  value={selectedParentId}
                  onChange={(event) => {
                    if (event.target.value === "__add_parent__") {
                      setParentDialog(true);
                      return;
                    }
                    setSelectedParentId(event.target.value);
                  }}
                >
                  <option value="">
                    {nl
                      ? "Niet binnen een andere locatie"
                      : "Not inside another location"}
                  </option>
                  {snapshot.references
                    .filter(
                      (x) =>
                        x.kind === "location" &&
                        x.id !== record?.id &&
                        x.status === "Active" &&
                        x.type !== "Main location" &&
                        (x.mainLocationId === selectedMainLocationId ||
                          x.id === selectedMainLocationId),
                    )
                    .map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name} ({parent.type})
                      </option>
                    ))}
                  {user && (
                    <option value="__add_parent__">
                      {nl
                        ? "+ Omvattende locatie toevoegen"
                        : "+ Add containing location"}
                    </option>
                  )}
                </SelectField>
              </>
            ) : kind === "department" ? (
              <SelectField
                name="mainLocationId"
                label={nl ? "Hoofdlocatie" : "Main location"}
                value={selectedMainLocationId}
                onChange={(event) => {
                  if(event.target.value==="__add_main__"){
                    setMainLocationDialog(true);
                    return;
                  }
                  setSelectedMainLocationId(event.target.value);
                }}
                required
              >
                <option value="">{nl ? "Selecteer een hoofdlocatie" : "Select Main location"}</option>
                {mainLocations.filter(main=>main.status==="Active"||main.id===selectedMainLocationId).map(main=><option key={main.id} value={main.id}>{main.name}</option>)}
                <option value="__add_main__">{nl ? "+ Hoofdlocatie toevoegen" : "+ Add Main location"}</option>
              </SelectField>
            ) : (
              <Field
                name="parent"
                label={nl ? "Bovenliggend record" : "Parent"}
                defaultValue={record?.parent}
              />
            )}
            <Field
              name="manager"
              label={nl ? "Verantwoordelijke" : "Manager"}
              defaultValue={String(record?.details.manager || "")}
            />
            {kind === "location" && (
              <>
                <SelectField
                  name="status"
                  label="Status"
                  defaultValue={record?.status || "Active"}
                >
                  <option value="Active">{nl ? "Actief" : "Active"}</option>
                  <option value="Inactive">
                    {nl ? "Inactief" : "Inactive"}
                  </option>
                  <option value="Temporarily closed">
                    {nl ? "Tijdelijk gesloten" : "Temporarily closed"}
                  </option>
                  <option value="Archived">
                    {nl ? "Gearchiveerd" : "Archived"}
                  </option>
                </SelectField>
                <Field
                  name="codeGroup"
                  label={nl ? "Codegroep" : "Code group"}
                  defaultValue={String(record?.details.codeGroup || "")}
                />
                <Field
                  name="storagePosition"
                  label={nl ? "Opslagpositie" : "Storage position"}
                  defaultValue={String(record?.details.storagePosition || "")}
                />
                <Field
                  name="capacity"
                  type="number"
                  min="0"
                  label={nl ? "Capaciteit" : "Capacity"}
                  defaultValue={Number(record?.details.capacity || 0)}
                />
                <TextAreaField
                  className="wide"
                  name="notes"
                  label={nl ? "Notities" : "Notes"}
                  defaultValue={String(record?.details.notes || "")}
                />
              </>
            )}
            {kind === "category" && (
              <>
                <SelectField
                  name="codeGroup"
                  label={nl ? "Codegroep" : "Code group"}
                  defaultValue={String(record?.details.codeGroup || "")}
                >
                  <option value="">{nl ? "Selecteer een codegroep" : "Select a code group"}</option>
                  {snapshot.codeGroups.filter(group=>group.isActive||group.prefix===record?.details.codeGroup).sort((a,b)=>a.sortOrder-b.sortOrder).map(group=><option key={group.id} value={group.prefix}>{group.prefix} — {group.name}</option>)}
                </SelectField>
                <Field
                  name="minimumStock"
                  type="number"
                  min="0"
                  label={
                    nl ? "Standaard minimumvoorraad" : "Default minimum stock"
                  }
                  defaultValue={Number(record?.details.minimumStock || 0)}
                />
                <TextAreaField
                  name="subcategories"
                  className="wide"
                  label={
                    nl
                      ? "Subcategorieën (komma-gescheiden)"
                      : "Subcategories (comma-separated)"
                  }
                  defaultValue={
                    Array.isArray(record?.details.subcategories)
                      ? record.details.subcategories.join(", ")
                      : ""
                  }
                />
                <label className="switch-row wide">
                  <span>
                    {nl ? "Onderhoud vereist" : "Maintenance required"}
                  </span>
                  <input
                    name="maintenance"
                    type="checkbox"
                    defaultChecked={Boolean(record?.details.maintenance)}
                  />
                </label>
              </>
            )}
            <div className="wide">
              <MutationFeedback {...feedback} />
              <div className="actions location-record-actions">
                <Button type="submit">
                  <Edit3 />
                  {nl ? "Opslaan" : "Save"}
                </Button>
                {record && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setConfirm(true)}
                    >
                      <ArchiveRestore />
                      {record.status === "Active"
                        ? nl ? "Deactiveren" : "Deactivate"
                        : nl ? "Herstellen" : "Restore"}
                    </Button>
                    {record.status === "Active" && (
                      <Button type="button" variant="danger" onClick={() => setDeleteConfirm(true)}>
                        <Trash2 />
                        {nl ? "Verwijderen" : "Delete"}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </form>
        </Dialog>
        <Dialog
          open={!!insight}
          title={insight?.title || (nl ? "Locatiedetails" : "Location details")}
          onClose={() => setInsight(null)}
        >
          {insight?.kind === "assets" ? (
            <div className="insight-list">
              {directAssets(insight.location).map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => navigate(`/assets/${asset.id}`)}
                >
                  <strong>{asset.name}</strong>
                  <span>
                    {asset.code} · {asset.category} · {asset.status}
                  </span>
                  <small>
                    {asset.assignedTo || (nl ? "Niet toegewezen" : "Not assigned")} ·{" "}
                    {asset.location}
                  </small>
                </button>
              ))}
            </div>
          ) : insight?.kind === "children" ? (
            <div className="insight-list">
              {directChildren(insight.location).map((child) => (
                <button
                  key={child.id}
                  onClick={() => {
                    setInsight(null);
                    edit(child);
                  }}
                >
                  <strong>{child.name}</strong>
                  <span>
                    {child.type} · {directAssets(child).length}{" "}
                    {nl ? "middelen" : "assets"}
                  </span>
                  <small>
                    {manager(child)} · {statusLabel(child.status)}
                  </small>
                </button>
              ))}
            </div>
          ) : insight?.kind === "tasks" ? (
            <div className="insight-list">
              {openTasks(insight.location).map((task) => (
                <div key={task.id}>
                  <strong>{task.asset}</strong>
                  <span>
                    {"type" in task
                      ? task.type
                      : nl
                        ? "Reparatie"
                        : "Repair"}{" "}
                    · {task.status}
                  </span>
                  <small>
                    {"assignee" in task
                      ? task.assignee
                      : nl
                        ? "Niet toegewezen"
                        : "Unassigned"}
                  </small>
                </div>
              ))}
            </div>
          ) : null}
        </Dialog>
        <Dialog
          open={mainLocationDialog}
          title={nl ? "Hoofdlocatie toevoegen" : "Add Main location"}
          description={nl ? "Maak een hoofdlocatie zonder het afdelingsformulier te verlaten." : "Create a Main location without leaving the Department form."}
          onClose={() => setMainLocationDialog(false)}
        >
          <form className="workflow-form" onSubmit={async event=>{
            event.preventDefault();
            const data=new FormData(event.currentTarget),name=String(data.get("name")||"").trim();
            if(!name)return;
            const result=await repository.execute({action:"reference.create",values:{kind:"location",name,type:"Main location",typeId:"main-location",status:"Active",mainLocationId:null,containerLocationId:null,details:{}}});
            if(result.ok&&result.entityId){setSelectedMainLocationId(result.entityId);setMainLocationDialog(false);setFeedback({status:"success",message:nl?"Hoofdlocatie aangemaakt en geselecteerd.":"Main location created and selected."})}
          }}>
            <Field name="name" label={nl ? "Naam hoofdlocatie" : "Main location name"} required autoFocus/>
            <div className="wide actions"><Button type="submit"><Plus/>{nl ? "Toevoegen" : "Add Main location"}</Button><Button type="button" variant="ghost" onClick={()=>setMainLocationDialog(false)}>{nl ? "Annuleren" : "Cancel"}</Button></div>
          </form>
        </Dialog>
        <Dialog
          open={typeDialog}
          title={nl ? "Locatietype toevoegen" : "Add location type"}
          description={
            nl
              ? "Maak een type aan zonder deze locatie te verlaten."
              : "Create a type without leaving this location."
          }
          onClose={() => setTypeDialog(false)}
        >
          <LocationTypeForm
            onCancel={() => setTypeDialog(false)}
            onSaved={(id) => {
              setSelectedTypeId(id);
              setTypeDialog(false);
            }}
          />
        </Dialog>
        <Dialog
          open={parentDialog}
          title={nl ? "Omvattende locatie toevoegen" : "Add containing location"}
          description={
            nl
              ? "Maak een omvattende ruimte of opslaglocatie aan zonder dit formulier te verliezen."
              : "Create a containing room or storage location without losing this form."
          }
          onClose={() => setParentDialog(false)}
        >
          <ParentLocationForm
            onCancel={() => setParentDialog(false)}
            onSaved={(id) => {
              setSelectedParentId(id);
              setParentDialog(false);
              setFeedback({
                status: "success",
                message: nl
                  ? "Omvattende locatie aangemaakt en geselecteerd."
                  : "Containing location created and selected.",
              });
            }}
          />
        </Dialog>
        <ConfirmDialog
          open={confirm}
          title={nl ? "Status wijzigen" : "Change status"}
          description={
            record?.relatedCount
              ? nl
                ? "Actieve koppelingen moeten eerst worden opgelost."
                : "Active links must be resolved first."
              : nl
                ? "Bevestig deze wijziging."
                : "Confirm this change."
          }
          confirmLabel={
            record?.status === "Active"
              ? nl
                ? "Archiveren"
                : "Archive"
              : nl
                ? "Herstellen"
                : "Restore"
          }
          danger={record?.status === "Active"}
          onClose={() => setConfirm(false)}
          onConfirm={changeArchive}
        />
        <ConfirmDialog
          open={deleteConfirm}
          title={nl ? "Naar prullenbak verplaatsen" : "Move to recycle bin"}
          description={nl
            ? `${record?.name || "Dit record"} verdwijnt uit deze module en kan vanuit de prullenbak worden hersteld. Actieve koppelingen blijven beschermd.`
            : `${record?.name || "This record"} will disappear from this module and can be restored from the recycle bin. Active links remain protected.`}
          confirmLabel={nl ? "Verplaatsen naar prullenbak" : "Move to recycle bin"}
          danger
          onClose={() => setDeleteConfirm(false)}
          onConfirm={moveToRecycleBin}
        />
        {kind === "department" && (
          <DepartmentIntelligencePanel
            department={deptPanel}
            onClose={() => setDeptPanel(null)}
          />
        )}
      </div>
    </OfflineGate>
  );
}

export const CategoriesPage = () => <ReferenceDataPage kind="category" />;
export const LocationsPage = () => <ReferenceDataPage kind="location" />;
export const DepartmentsPage = () => <ReferenceDataPage kind="department" />;
