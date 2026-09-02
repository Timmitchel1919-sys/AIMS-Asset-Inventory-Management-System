import { FileUp, Plus, ScanLine } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { can } from "../auth/permissions";
import {
  ActiveFilterChips,
  BulkActionToolbar,
  ColumnSelector,
  DataListStates,
  DataPageLayout,
  DataToolbar,
  ExportMenu,
  FilterField,
  FilterInput,
  FilterPanel,
  ResponsiveDataList,
  SavedViewSelector,
  type ListColumn,
} from "../components/data-list/ListInfrastructure";
import {
  Dialog,
  MutationFeedback,
  OfflineGate,
  PageHeader,
} from "../components/WorkflowUi";
import { Button, Field, SelectField } from "../components/ui";
import { AssetStatusBadge } from "../components/AssetStatusBadge";
import { ConditionBadge } from "../components/ConditionBadge";
import { QrAssetScanner } from "../components/QrAssetScanner";
import { useApp } from "../context/AppContext";
import {
  createCsv,
  createPrintHtml,
  createSpreadsheetXml,
  downloadText,
  type ExportColumn,
} from "../data/listExports";
import {
  LIST_PREFERENCES_VERSION,
  loadListPreferences,
  removeSavedView,
  saveListPreferences,
  upsertSavedView,
  type SavedListView,
} from "../data/listPreferences";
import type { ListFilter, ListResult, ListSort } from "../data/listQuery";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { runBulkCommands } from "../data/bulkActions";
import type { Asset } from "../domain/types";
import { useT } from "../i18n";

const columnIds = [
  "code",
  "category",
  "name",
  "serial",
  "location",
  "department",
  "status",
  "condition",
  "updated",
];
const preferenceKey = "kcs-assets-list-preferences:v1";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const emptyResult: ListResult<Asset> = {
  items: [],
  totalCount: 0,
  hasNext: false,
  hasPrevious: false,
};
const filterDefinitions = [
  ["codePrefix", "assets.codeGroup"],
  ["category", "assets.category"],
  ["subcategory", "assets.subcategory"],
  ["type", "assets.itemType"],
  ["status", "assets.status"],
  ["condition", "assets.condition"],
  ["location", "assets.location"],
  ["department", "assets.department"],
  ["assignedTo", "assets.assignee"],
  ["supplier", "assets.supplier"],
  ["brand", "assets.brand"],
  ["model", "assets.model"],
  ["purchaseYear", "assets.purchaseYear"],
  ["warrantyStatus", "assets.warranty"],
  ["maintenanceRequired", "assets.maintenanceRequired"],
  ["missingQr", "assets.missingQr"],
  ["missingSerial", "assets.missingSerial"],
  ["endOfLife", "assets.endOfLife"],
  ["dateAddedFrom", "assets.dateAddedFrom"],
  ["dateAddedTo", "assets.dateAddedTo"],
  ["updatedFrom", "assets.updatedFrom"],
  ["updatedTo", "assets.updatedTo"],
] as const;

export default function Assets() {
  const { user } = useApp(),
    t = useT(),
    navigate = useNavigate(),
    [params] = useSearchParams(),
    repository = useRepository(),
    snapshot = useMockSnapshot();
  const [search, setSearch] = useState(""),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [draftFilters, setDraftFilters] = useState<Record<string, string>>({}),
    [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<ListSort>({
      field: "code",
      direction: "asc",
    }),
    [cursor, setCursor] = useState<string | undefined>();
  const pageSize = 5000;
  const [result, setResult] = useState<ListResult<Asset>>(emptyResult),
    [facets, setFacets] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true),
    [hasLoaded, setHasLoaded] = useState(false),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [selected, setSelected] = useState<string[]>([]);
  const [preferences, setPreferences] = useState(() =>
    loadListPreferences(localStorage, preferenceKey, columnIds),
  );
  const [viewDialog, setViewDialog] = useState(false),
    [viewName, setViewName] = useState("");
  const [bulkAction, setBulkAction] = useState(""),
    [bulkDialog, setBulkDialog] = useState(false),
    [bulkReason, setBulkReason] = useState(""),
    [bulkTarget, setBulkTarget] = useState("");
  const [mutation, setMutation] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const [printHtml, setPrintHtml] = useState("");
  const demoState = params.get("state");
  const [errorRecovered, setErrorRecovered] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    repository
      .assetFacets()
      .then(setFacets)
      .catch(() => setFacets({}));
  }, [repository]);
  const queryFilters = useMemo<ListFilter[]>(
    () =>
      Object.entries(filters)
        .filter(([, value]) => value)
        .map(([field, value]) => {
          if (field.endsWith("From"))
            return {
              field: field === "dateAddedFrom" ? "dateAdded" : "lastUpdated",
              operator: "gte",
              value,
            };
          if (field.endsWith("To"))
            return {
              field: field === "dateAddedTo" ? "dateAdded" : "lastUpdated",
              operator: "lte",
              value,
            };
          if (
            [
              "maintenanceRequired",
              "missingQr",
              "missingSerial",
              "endOfLife",
            ].includes(field)
          )
            return { field, operator: "truthy", value: true };
          return { field, operator: "eq", value };
        }),
    [filters],
  );
  const load = useCallback(async () => {
    void reload;
    const requestId = ++requestSequence.current;
    if (demoState === "loading") {
      setLoading(true);
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (demoState === "error" && !errorRecovered)
        throw new Error("The mock repository returned a recoverable error.");
      const next = await repository.queryAssets({
        search,
        filters: queryFilters,
        sort: [sort],
        pageSize,
        cursor,
      });
      if (requestId === requestSequence.current)
        setResult(demoState === "empty" ? emptyResult : next);
    } catch (value) {
      if (requestId === requestSequence.current)
        setError(value instanceof Error ? value.message : t("common.error"));
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
        setHasLoaded(true);
      }
    }
  }, [
    cursor,
    demoState,
    errorRecovered,
    pageSize,
    queryFilters,
    reload,
    repository,
    search,
    sort,
    t,
  ]);
  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const updateFilter = (field: string, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setCursor(undefined);
    setSelected([]);
  };
  const updateDraftFilter = (field: string, value: string) =>
    setDraftFilters((current) => ({ ...current, [field]: value }));
  const toggleFilters = () =>
    setShowFilters((open) => {
      if (!open) setDraftFilters(filters);
      return !open;
    });
  const saveFilters = () => {
    setFilters(draftFilters);
    setCursor(undefined);
    setSelected([]);
    setShowFilters(false);
  };
  const clearFilters = () => {
    setDraftFilters({});
    setFilters({});
    setCursor(undefined);
    setSelected([]);
  };
  const activeFilters = [
    ...filterDefinitions
      .filter(([field]) => filters[field])
      .map(([field, key]) => ({ field, label: t(key), value: filters[field] })),
    ...(filters.alphabet
      ? [
          {
            field: "alphabet",
            label: t("assets.alphabet"),
            value: filters.alphabet,
          },
        ]
      : []),
  ];
  const columns = useMemo<ListColumn<Asset>[]>(
    () => [
      {
        id: "code",
        label: t("assets.codeColumn"),
        required: true,
        sortable: true,
        render: (asset) => <b className="asset-code">{asset.code}</b>,
        value: (asset) => asset.code,
      },
      {
        id: "category",
        label: t("assets.category"),
        sortable: true,
        render: (asset) => asset.category,
        value: (asset) => asset.category,
      },
      {
        id: "name",
        label: t("assets.asset"),
        required: true,
        sortable: true,
        render: (asset) => (
          <span>
            <strong>{asset.name}</strong>
            <small>
              {asset.brand} · {asset.model}
            </small>
          </span>
        ),
        value: (asset) => asset.name,
      },
      {
        id: "serial",
        label: t("assets.serial"),
        render: (asset) => asset.serialNumber || "—",
        value: (asset) => asset.serialNumber,
      },
      {
        id: "location",
        label: t("assets.location"),
        sortable: true,
        render: (asset) => asset.location,
        value: (asset) => asset.location,
      },
      {
        id: "department",
        label: t("assets.department"),
        sortable: true,
        render: (asset) => asset.department,
        value: (asset) => asset.department,
      },
      {
        id: "status",
        label: t("assets.status"),
        sortable: true,
        render: (asset) => (
          <AssetStatusBadge
            status={asset.status}
            size="compact"
            variant="table"
          />
        ),
        value: (asset) => t(`status.${asset.status}`),
      },
      {
        id: "condition",
        label: t("assets.condition"),
        sortable: true,
        render: (asset) => <ConditionBadge condition={asset.condition} size="compact" variant="table" />,
        value: (asset) => t(`condition.${asset.condition}`),
      },
      {
        id: "updated",
        label: t("assets.updated"),
        sortable: true,
        render: (asset) => asset.lastUpdated,
        value: (asset) => asset.lastUpdated,
      },
    ],
    [t],
  );
  const visible = preferences.visibleColumns.length
    ? preferences.visibleColumns
    : columnIds;
  const setVisible = (value: string[]) =>
    setPreferences((current) => ({ ...current, visibleColumns: value }));
  useEffect(() => {
    saveListPreferences(localStorage, preferenceKey, preferences);
  }, [preferences]);

  const saveView = () => {
    if (!viewName.trim()) return;
    const view: SavedListView = {
      id: `view-${Date.now()}`,
      name: viewName.trim(),
      search,
      filters: queryFilters,
      sort: [sort],
      pageSize,
      visibleColumns: visible,
      ownerId: user?.id || "anonymous",
      isShared: false,
      version: LIST_PREFERENCES_VERSION,
    };
    setPreferences((current) => upsertSavedView(current, view));
    setViewName("");
    setViewDialog(false);
  };
  const applyView = (id: string) => {
    const view = preferences.savedViews.find((item) => item.id === id);
    if (!view) return;
    setSearch(view.search);
    setFilters(
      Object.fromEntries(
        view.filters.map((filter) => [
          filter.field === "dateAdded"
            ? filter.operator === "gte"
              ? "dateAddedFrom"
              : "dateAddedTo"
            : filter.field === "lastUpdated"
              ? filter.operator === "gte"
                ? "updatedFrom"
                : "updatedTo"
              : filter.field,
          String(filter.value ?? ""),
        ]),
      ),
    );
    setSort(view.sort[0] || { field: "code", direction: "asc" });
    setVisible(view.visibleColumns);
    setCursor(undefined);
    setSelected([]);
  };
  const exportColumns: ExportColumn<Asset>[] = columns
    .filter((column) => visible.includes(column.id))
    .map((column) => ({
      id: column.id,
      label: column.label,
      value: column.value,
      authorized: can(user?.role, "assets.view"),
    }));
  const exportRows = selected.length
    ? result.items.filter((asset) => selected.includes(asset.id))
    : result.items;
  const metadata = {
    title: t("assets.exportTitle"),
    generatedAt: new Date().toISOString(),
    generatedBy: user?.name || "KCS user",
  };
  const exportCsv = () =>
    downloadText(
      "kcs-assets.csv",
      createCsv(exportRows, exportColumns, metadata),
      "text/csv;charset=utf-8",
    );
  const exportExcel = () =>
    downloadText(
      "kcs-assets.xls",
      createSpreadsheetXml(exportRows, exportColumns, metadata),
      "application/vnd.ms-excel",
    );

  const actions = [
    can(user?.role, "assets.edit") && {
      id: "edit",
      label: t("assets.bulk.edit"),
    },
    can(user?.role, "assets.edit") && {
      id: "location",
      label: t("assets.bulk.location"),
    },
    can(user?.role, "assets.edit") && {
      id: "department",
      label: t("assets.bulk.department"),
    },
    can(user?.role, "assets.edit") && {
      id: "status",
      label: t("assets.bulk.status"),
    },
    can(user?.role, "assets.archive") && {
      id: "archive",
      label: t("assets.bulk.archive"),
    },
    can(user?.role, "assets.archive") && {
      id: "delete",
      label: t("assets.bulk.delete"),
    },
    can(user?.role, "disposals.request") && {
      id: "disposal",
      label: t("assets.bulk.disposal"),
    },
    can(user?.role, "assets.view") && { id: "qr", label: t("assets.bulk.qr") },
    can(user?.role, "assets.view") && {
      id: "export",
      label: t("assets.bulk.export"),
    },
  ].filter(Boolean) as { id: string; label: string }[];
  const beginBulk = (requestedAction = bulkAction) => {
    setBulkAction(requestedAction);
    if (requestedAction === "export") {
      exportCsv();
      return;
    }
    if (requestedAction === "qr") {
      setPrintHtml(
        createPrintHtml(exportRows, exportColumns, {
          ...metadata,
          title: t("assets.bulk.qr"),
        }),
      );
      return;
    }
    setBulkDialog(true);
  };
  const runBulk = async () => {
    if (!bulkReason.trim()) return;
    if (
      ["edit", "location", "department", "status"].includes(bulkAction) &&
      !bulkTarget
    )
      return;
    setMutation({ status: "loading", message: t("common.working") });
    const commands = selected.map((entityId) =>
      ["archive", "delete"].includes(bulkAction)
        ? {
            action: "asset.archive" as const,
            entityId,
            values: {
              reason:
                bulkAction === "delete"
                  ? `Verwijderen naar prullenbak: ${bulkReason}`
                  : bulkReason,
            },
          }
        : bulkAction === "disposal"
          ? {
              action: "disposal.create" as const,
              entityId,
              values: { reason: bulkReason },
            }
          : {
              action: "asset.edit" as const,
              entityId,
              values: {
                [bulkAction === "edit" ? "condition" : bulkAction]: bulkTarget,
                reason: bulkReason,
              },
            },
    );
    const outcome = await runBulkCommands(repository, commands);
    setMutation(
      outcome.failed
        ? {
            status: "error",
            message: `${outcome.succeeded}/${outcome.total} ${t("assets.bulk.done")} ${outcome.failures.map((failure) => failure.message).join(" ")}`,
          }
        : { status: "success", message: t("assets.bulk.done") },
    );
    setBulkDialog(false);
    setBulkAction("");
    setBulkReason("");
    setBulkTarget("");
    setSelected([]);
    setReload((value) => value + 1);
  };
  const targetValues =
    bulkAction === "location"
      ? facets.location || []
      : bulkAction === "department"
        ? facets.department || []
        : bulkAction === "status"
          ? facets.status || []
          : bulkAction === "edit"
            ? [
                "New",
                "Excellent",
                "Good",
                "Fair",
                "Poor",
                "Defective",
                "Beyond Repair",
              ]
            : [];

  return (
    <OfflineGate>
      <DataPageLayout
        header={
          <PageHeader
            title={t("assets.title")}
            description={t("assets.description")}
            actions={
              <>
                <Button
                  className="page-header-secondary-action page-header-scan-action"
                  variant="secondary"
                  onClick={() => navigate("/assets?scan=1")}
                >
                  <ScanLine />
                  {t("assets.scan")}
                </Button>
                {can(user?.role, "assets.import") && (
                  <Button
                    className="page-header-secondary-action page-header-import-action"
                    variant="secondary"
                    onClick={() => navigate("/assets/import")}
                  >
                    <FileUp />
                    {t("assets.import")}
                  </Button>
                )}
                {can(user?.role, "assets.create") && (
                  <Button onClick={() => navigate("/assets/new")}>
                    <Plus />
                    {t("assets.add")}
                  </Button>
                )}
              </>
            }
          />
        }
      >
        {params.get("scan") && (
          <QrAssetScanner
            assets={snapshot.assets}
            onAsset={(asset) => navigate(`/assets/${asset.id}`)}
            onClose={() => navigate("/assets", { replace: true })}
          />
        )}
        <section className="card data-card">
          <DataToolbar
            search={search}
            onSearch={(value) => {
              setSearch(value);
              setCursor(undefined);
              setSelected([]);
            }}
            searchLabel={t("assets.search")}
            filterCount={activeFilters.length}
            onToggleFilters={toggleFilters}
            savedViews={
              <SavedViewSelector
                views={preferences.savedViews}
                onApply={applyView}
                onSave={() => setViewDialog(true)}
                onDelete={(id) =>
                  setPreferences((current) => removeSavedView(current, id))
                }
              />
            }
            columnSelector={
              <ColumnSelector
                columns={columns}
                visible={visible}
                onChange={setVisible}
              />
            }
            exportMenu={
              <ExportMenu
                onCsv={exportCsv}
                onExcel={exportExcel}
                onPrint={() =>
                  setPrintHtml(
                    createPrintHtml(exportRows, exportColumns, metadata),
                  )
                }
              />
            }
          />
          <FilterPanel
            open={showFilters}
            onClear={clearFilters}
            onSave={saveFilters}
          >
            <fieldset className="alphabet-filter-field">
              <legend>{t("assets.alphabet")}</legend>
              <button
                type="button"
                className={!draftFilters.alphabet ? "active" : ""}
                aria-pressed={!draftFilters.alphabet}
                onClick={() => updateDraftFilter("alphabet", "")}
              >
                {t("common.all")}
              </button>
              {alphabet.map((letter) => (
                <button
                  type="button"
                  className={draftFilters.alphabet === letter ? "active" : ""}
                  key={letter}
                  aria-pressed={draftFilters.alphabet === letter}
                  onClick={() => updateDraftFilter("alphabet", letter)}
                >
                  {letter}
                </button>
              ))}
            </fieldset>
            {filterDefinitions.map(([field, key]) =>
              [
                "dateAddedFrom",
                "dateAddedTo",
                "updatedFrom",
                "updatedTo",
              ].includes(field) ? (
                <FilterInput
                  key={field}
                  label={t(key)}
                  type="date"
                  value={draftFilters[field] || ""}
                  onChange={(value) => updateDraftFilter(field, value)}
                />
              ) : (
                <FilterField
                  key={field}
                  label={t(key)}
                  value={draftFilters[field] || ""}
                  values={
                    [
                      "maintenanceRequired",
                      "missingQr",
                      "missingSerial",
                      "endOfLife",
                    ].includes(field)
                      ? [{ value: "true", label: t("assets.yes") }]
                      : field === "purchaseYear"
                        ? [
                            "2020",
                            "2021",
                            "2022",
                            "2023",
                            "2024",
                            "2025",
                            "2026",
                          ]
                        : field === "warrantyStatus"
                          ? [
                              { value: "Active", label: t("assets.active") },
                              {
                                value: "Expiring",
                                label: t("assets.expiring"),
                              },
                              { value: "Expired", label: t("assets.expired") },
                            ]
                          : field === "status"
                            ? (facets.status || []).map((value) => ({
                                value,
                                label: t(`status.${value}`),
                              }))
                            : field === "condition"
                              ? (facets.condition || []).map((value) => ({
                                  value,
                                  label: t(`condition.${value}`),
                                }))
                              : facets[field] || []
                  }
                  onChange={(value) => updateDraftFilter(field, value)}
                />
              ),
            )}
          </FilterPanel>
          <ActiveFilterChips
            filters={activeFilters}
            onRemove={(field) => updateFilter(field, "")}
          />
          <MutationFeedback
            status={mutation.status}
            message={mutation.message}
          />
          <BulkActionToolbar
            count={selected.length}
            actions={actions}
            value={bulkAction}
            onChange={setBulkAction}
            onRun={beginBulk}
            onClear={() => setSelected([])}
            busy={mutation.status === "loading"}
          />
          <DataListStates
            loading={loading && (!hasLoaded || demoState === "loading")}
            error={error}
            empty={hasLoaded && !error && !result.items.length}
            onRetry={() => {
              setErrorRecovered(true);
              setReload((value) => value + 1);
            }}
          />
          {!error && !!result.items.length && (
            <ResponsiveDataList
              id="assets"
              rows={result.items}
              columns={columns}
              visible={visible}
              rowKey={(asset) => asset.id}
              selected={selected}
              onSelection={setSelected}
              onRowClick={(asset) => navigate(`/assets/${asset.id}`)}
              sort={sort}
              onSort={(field) => {
                setSort((current) => ({
                  field,
                  direction:
                    current.field === field && current.direction === "asc"
                      ? "desc"
                      : "asc",
                }));
                setCursor(undefined);
              }}
            />
          )}
        </section>
        <Dialog
          open={viewDialog}
          title={t("assets.saveView")}
          onClose={() => setViewDialog(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setViewDialog(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={saveView} disabled={!viewName.trim()}>
                {t("common.save")}
              </Button>
            </>
          }
        >
          <Field
            label={t("assets.viewName")}
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            autoFocus
          />
        </Dialog>
        <Dialog
          open={bulkDialog}
          title={t("assets.bulk.confirm")}
          description={t("assets.bulk.confirmHelp")}
          onClose={() => setBulkDialog(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setBulkDialog(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={runBulk}
                disabled={
                  !bulkReason.trim() ||
                  (["edit", "location", "department", "status"].includes(
                    bulkAction,
                  ) &&
                    !bulkTarget)
                }
              >
                {t("common.apply")}
              </Button>
            </>
          }
        >
          <div className="workflow-form">
            {targetValues.length > 0 && (
              <SelectField
                label={t("assets.bulk.target")}
                value={bulkTarget}
                onChange={(event) => setBulkTarget(event.target.value)}
                required
              >
                <option value="">{t("common.chooseAction")}</option>
                {targetValues.map((value) => (
                  <option key={value}>
                    {bulkAction === "status"
                      ? t(`status.${value}`)
                      : bulkAction === "edit"
                        ? t(`condition.${value}`)
                        : value}
                  </option>
                ))}
              </SelectField>
            )}
            <Field
              label={t("assets.bulk.reason")}
              value={bulkReason}
              onChange={(event) => setBulkReason(event.target.value)}
              required
            />
          </div>
        </Dialog>
        <Dialog
          open={!!printHtml}
          title={t("common.printPreview")}
          onClose={() => setPrintHtml("")}
          footer={
            <Button onClick={() => window.print()}>
              {t("common.printPreview")}
            </Button>
          }
        >
          <iframe
            className="export-preview"
            title={t("common.printPreview")}
            srcDoc={printHtml}
          />
        </Dialog>
      </DataPageLayout>
    </OfflineGate>
  );
}
