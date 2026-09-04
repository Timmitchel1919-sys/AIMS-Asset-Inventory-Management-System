import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  Boxes,
  History as HistoryIcon,
  Laptop,
  ListChecks,
} from "lucide-react";
import { Badge } from "../ui";
import { Dialog, MutationFeedback } from "../WorkflowUi";
import { DataTable, type DataColumn } from "../DataTable";
import { StatusBadge } from "../AssetStatusBadge";
import { can } from "../../auth/permissions";
import { useApp } from "../../context/AppContext";
import { useMockSnapshot } from "../../data/repositoryContext";
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
import type { Asset } from "../../domain/types";
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

  const canViewAssets = can(role, "assets.view");
  const canViewHistory = can(role, "history.view");

  const deptName = department?.name || "";
  const deptAssets = useMemo(
    () => assetsForDepartment(snapshot.assets, deptName),
    [snapshot.assets, deptName],
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
      ),
    [snapshot.movements, snapshot.assetHistoryEvents, deptName],
  );
  const fullHistory = useMemo(() => {
    const merged: DepartmentActivityItem[] = [
      ...departmentMovements(snapshot.movements, deptName).map(
        (movement): DepartmentActivityItem => ({
          kind: "movement",
          at: movement.date || "",
          movement,
        }),
      ),
      ...departmentHistoryEvents(snapshot.assetHistoryEvents, deptName).map(
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
  }, [snapshot.movements, snapshot.assetHistoryEvents, deptName, historyFilter]);

  const openAsset = (asset: Asset) => {
    onClose();
    navigate(`/assets/${asset.id}`);
  };

  const assetColumns: DataColumn<Asset>[] = [
    {
      id: "code",
      label: nl ? "Middelcode" : "Asset ID",
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
      id: "status",
      label: "Status",
      render: (a) => <StatusBadge status={a.status} size="compact" />,
      text: (a) => a.status,
      sortable: true,
    },
  ];

  const title = deptName;
  const description = nl
    ? "Live overzicht — komt rechtstreeks uit de actuele middelgegevens."
    : "Live overview — derived directly from the current asset records.";

  return (
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
              {nl ? "ICT-middelen" : "ICT Assets"}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "all"}
              className={tab === "all" ? "active" : ""}
              onClick={() => setTab("all")}
            >
              <Boxes size={14} />
              {nl ? "Alle middelen" : "All Assets"}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "activity"}
              className={tab === "activity" ? "active" : ""}
              onClick={() => setTab("activity")}
            >
              <ArrowLeftRight size={14} />
              {nl ? "Recente activiteit" : "Recent Activity"}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "history"}
              className={tab === "history" ? "active" : ""}
              onClick={() => setTab("history")}
            >
              <HistoryIcon size={14} />
              {nl ? "Geschiedenis" : "History"}
            </button>
          </div>

          {(tab === "ict" || tab === "all") &&
            (canViewAssets ? (
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
                    ? "Zodra een middel wordt toegewezen of overgeplaatst, verschijnt het hier automatisch."
                    : "As soon as an asset is assigned or transferred here, it will appear automatically."
                }
              />
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
  );
}
