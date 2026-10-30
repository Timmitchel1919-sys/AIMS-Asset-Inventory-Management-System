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
import type { WorkflowCommand } from "../data/contracts";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { runBulkCommands } from "../data/bulkActions";
import type { Asset } from "../domain/types";
import { useT } from "../i18n";
import { ASSET_CONDITIONS } from "../domain/assetCondition";
import { assetAssigneeName, assetDepartmentName } from "../domain/assetLookups";
import { parentLocationIdOf, rootLocations } from "../domain/locationTree";

const columnIds = [
  "code",
  "brand",
  "name",
  "codeGroup",
  "model",
  "serial",
  "location",
  "department",
  "assignee",
  "condition",
  "status",
];
const preferenceKey = "kcs-assets-list-preferences:v1";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const emptyResult: ListResult<Asset> = {
  items: [],
  totalCount: 0,
  hasNext: false,
  hasPrevious: false,
};

export function formatIctData(value: string | undefined | null, column: string): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") return "—";

  if (column === "serial" || column === "serialNumber") {
    return trimmed.toUpperCase();
  }
  if (column === "code" || column === "codeGroup") {
    return trimmed;
  }
  if (/^hp$/i.test(trimmed)) {
    return "HP";
  }
  if (/^apc$/i.test(trimmed)) {
    return "APC";
  }
  if (/^hs-p010k$/i.test(trimmed)) {
    return "HS-P010K";
  }
  if (/^pn-l862b$/i.test(trimmed)) {
    return "PN-L862B";
  }
  if (column === "brand") {
    if (/^sharp(\s.*)?$/i.test(trimmed)) return "Sharp";
    if (/^apc$/i.test(trimmed)) return "APC";
    if (/^hp$/i.test(trimmed)) return "HP";
    if (/^ibm$/i.test(trimmed)) return "IBM";
  }
  if (column === "model") {
    return trimmed;
  }
  if (/^(kh|kangoeroe\s*high)\s*nieuw\s*bouw/i.test(trimmed)) {
    const parts = trimmed.split(/\s*\/\s*/);
    const main = "KH nieuw bouw";
    if (parts.length > 1) {
      const sub = parts.slice(1).map((p) => {
        if (/^computer\s*lokaal$/i.test(p)) return "Computer lokaal";
        if (/^ict[- ]?storage$/i.test(p)) return "ICT-Storage";
        if (/^practicum\s*lokaal$/i.test(p)) return "Practicum lokaal";
        if (/^groep\s*1d$/i.test(p)) return "Groep 1D";
        return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
      }).join(" / ");
      return `${main} / ${sub}`;
    }
    return main;
  }
  if (/^computer\s*lokaal$/i.test(trimmed)) {
    return "Computer lokaal";
  }
  if (/^practicum\s*lokaal$/i.test(trimmed)) {
    return "Practicum lokaal";
  }
  if (/^ict[- ]?storage$/i.test(trimmed)) {
    return "ICT-Storage";
  }
  if (/^groep\s*1d$/i.test(trimmed)) {
    return "Groep 1D";
  }
  if (/^kcs\s*basis$/i.test(trimmed)) {
    return "KCS Basis";
  }
  if (/^kcs\s*boven\s*bouw$/i.test(trimmed) || /^kcs\s*bovenbouw$/i.test(trimmed)) {
    return "KCS Boven bouw";
  }
  if (/^cabin$/i.test(trimmed)) {
    return "Cabin";
  }
  if (/^ict\s*kantoor$/i.test(trimmed)) {
    return "ICT Kantoor";
  }
  if (/^\d+[a-zA-Z]$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (column === "assignee") {
    return trimmed
      .split(/\s+/)
      .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ""))
      .join(" ");
  }

  // Preserve user-specified uppercase and lowercase letters
  return trimmed;
}
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
  const [viewDialog, setViewDialog] = useState(false);
  const [viewName, setViewName] = useState("");

  const [bulkAction, setBulkAction] = useState(""),
    [bulkDialog, setBulkDialog] = useState(false),
    [bulkReason, setBulkReason] = useState(""),
    [bulkTarget, setBulkTarget] = useState("");
  const [bulkData, setBulkData] = useState<{
    codePrefix?: string;
    codeStartNumber?: string;
    codeDirect?: string;
    brand?: string;
    name?: string;
    model?: string;
    serialNumber?: string;
    isSerialSequence?: boolean;
    serialPrefix?: string;
    serialStartNumber?: string;
    location?: string;
    department?: string;
  }>({});

  const brandSuggestions = useMemo(() => {
    const set = new Set<string>();
    (facets.brand || []).forEach((b) => b && set.add(b));
    snapshot.assets.forEach((a) => a.brand && set.add(a.brand));
    return Array.from(set).sort();
  }, [facets.brand, snapshot.assets]);

  const modelSuggestions = useMemo(() => {
    const set = new Set<string>();
    (facets.model || []).forEach((m) => m && set.add(m));
    snapshot.assets.forEach((a) => a.model && set.add(a.model));
    return Array.from(set).sort();
  }, [facets.model, snapshot.assets]);

  const nameSuggestions = useMemo(() => {
    const set = new Set<string>();
    snapshot.assets.forEach((a) => a.name && set.add(a.name));
    return Array.from(set).sort();
  }, [snapshot.assets]);

  const mainLocationOptions = useMemo(() => {
    const fromRefs = rootLocations(snapshot.references).map((r) => r.name);
    const fromFacets = facets.location || [];
    return Array.from(new Set([...fromRefs, ...fromFacets])).filter(Boolean).sort();
  }, [snapshot.references, facets.location]);

  const subLocationOptions = useMemo(() => {
    const fromRefs = snapshot.references
      .filter((r) => r.kind === "department" || (r.kind === "location" && parentLocationIdOf(r)))
      .map((r) => r.name);
    const fromFacets = facets.department || [];
    return Array.from(new Set([...fromRefs, ...fromFacets])).filter(Boolean).sort();
  }, [snapshot.references, facets.department]);
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
        id: "brand",
        label: t("assets.brand"),
        sortable: true,
        render: (asset) => formatIctData(asset.brand, "brand"),
        value: (asset) => formatIctData(asset.brand, "brand"),
      },
      {
        id: "name",
        label: t("assets.asset"),
        required: true,
        sortable: true,
        render: (asset) => <strong>{formatIctData(asset.name, "name")}</strong>,
        value: (asset) => formatIctData(asset.name, "name"),
      },
      {
        id: "codeGroup",
        label: t("assets.codeGroup"),
        sortable: true,
        render: (asset) => asset.codePrefix,
        value: (asset) => asset.codePrefix,
      },
      {
        id: "model",
        label: t("assets.model"),
        sortable: true,
        render: (asset) => formatIctData(asset.model, "model"),
        value: (asset) => formatIctData(asset.model, "model"),
      },
      {
        id: "serial",
        label: t("assets.serial"),
        sortable: true,
        render: (asset) => (
          <span
            style={{
              fontFamily: "var(--font-mono, monospace)",
              textTransform: "uppercase",
              overflowWrap: "anywhere",
              wordBreak: "break-all",
              whiteSpace: "normal",
              display: "inline-block",
              maxWidth: "100%",
            }}
          >
            {formatIctData(asset.serialNumber, "serial")}
          </span>
        ),
        value: (asset) => formatIctData(asset.serialNumber, "serial"),
      },
      {
        id: "location",
        label: t("assets.location"),
        sortable: true,
        render: (asset) => formatIctData(asset.location, "location"),
        value: (asset) => formatIctData(asset.location, "location"),
      },
      {
        id: "department",
        label: t("assets.department"),
        sortable: true,
        // Read through the canonical id so a renamed department shows everywhere.
        render: (asset) =>
          formatIctData(assetDepartmentName(asset, snapshot.references), "department"),
        value: (asset) =>
          formatIctData(assetDepartmentName(asset, snapshot.references), "department"),
      },
      {
        id: "assignee",
        label: t("assets.assignee"),
        sortable: true,
        render: (asset) =>
          formatIctData(
            assetAssigneeName(asset, snapshot.users) || asset.responsibleEmployee,
            "assignee",
          ),
        value: (asset) =>
          formatIctData(
            assetAssigneeName(asset, snapshot.users) || asset.responsibleEmployee,
            "assignee",
          ),
      },
      {
        id: "condition",
        label: t("assets.condition"),
        sortable: true,
        render: (asset) => <ConditionBadge condition={asset.condition} size="compact" variant="table" />,
        value: (asset) => t(`condition.${asset.condition}`),
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
    ],
    [t, snapshot.references, snapshot.users],
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
      id: "bulkEdit",
      label: t("assets.bulk.editSelected"),
    },
    can(user?.role, "assets.edit") && {
      id: "code",
      label: t("assets.bulk.editInvCode"),
    },
    can(user?.role, "assets.edit") && {
      id: "brand",
      label: t("assets.bulk.brand"),
    },
    can(user?.role, "assets.edit") && {
      id: "name",
      label: t("assets.bulk.asset"),
    },
    can(user?.role, "assets.edit") && {
      id: "model",
      label: t("assets.bulk.model"),
    },
    can(user?.role, "assets.edit") && {
      id: "serial",
      label: t("assets.bulk.serial"),
    },
    can(user?.role, "assets.edit") && {
      id: "mainLocation",
      label: t("assets.bulk.mainLocation"),
    },
    can(user?.role, "assets.edit") && {
      id: "subLocation",
      label: t("assets.bulk.subLocation"),
    },
    can(user?.role, "assets.edit") && {
      id: "edit",
      label: t("assets.bulk.edit"),
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
    can(user?.role, "inventory.create") && {
      id: "toInventory",
      label: t("assets.bulk.toInventory"),
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

    const selectedAssets = snapshot.assets.filter((a) => selected.includes(a.id));
    const commonBrand =
      selectedAssets.length &&
      selectedAssets.every((a) => a.brand === selectedAssets[0].brand)
        ? selectedAssets[0].brand
        : "";
    const commonName =
      selectedAssets.length &&
      selectedAssets.every((a) => a.name === selectedAssets[0].name)
        ? selectedAssets[0].name
        : "";
    const commonModel =
      selectedAssets.length &&
      selectedAssets.every((a) => a.model === selectedAssets[0].model)
        ? selectedAssets[0].model
        : "";
    const commonSerial =
      selectedAssets.length &&
      selectedAssets.every(
        (a) => a.serialNumber === selectedAssets[0].serialNumber,
      )
        ? selectedAssets[0].serialNumber
        : "";
    const commonLocation =
      selectedAssets.length &&
      selectedAssets.every((a) => a.location === selectedAssets[0].location)
        ? selectedAssets[0].location
        : "";
    const commonDepartment =
      selectedAssets.length &&
      selectedAssets.every(
        (a) => a.department === selectedAssets[0].department,
      )
        ? selectedAssets[0].department
        : "";
    const commonCodePrefix =
      selectedAssets.length &&
      selectedAssets.every(
        (a) => a.codePrefix === selectedAssets[0].codePrefix,
      )
        ? selectedAssets[0].codePrefix
        : "";
    const commonCondition =
      selectedAssets.length &&
      selectedAssets.every((a) => a.condition === selectedAssets[0].condition)
        ? selectedAssets[0].condition
        : "";
    const commonStatus =
      selectedAssets.length &&
      selectedAssets.every((a) => a.status === selectedAssets[0].status)
        ? selectedAssets[0].status
        : "";

    setBulkData({
      brand: commonBrand,
      name: commonName,
      model: commonModel,
      serialNumber: commonSerial,
      location: commonLocation,
      department: commonDepartment,
      codePrefix: commonCodePrefix,
      codeDirect: selected.length === 1 ? selectedAssets[0]?.code : "",
      codeStartNumber: "",
      isSerialSequence: false,
      serialPrefix: commonSerial ? commonSerial.replace(/\d+$/, "") : "",
      serialStartNumber: "",
    });

    if (requestedAction === "brand") setBulkTarget(commonBrand);
    else if (requestedAction === "name") setBulkTarget(commonName);
    else if (requestedAction === "model") setBulkTarget(commonModel);
    else if (requestedAction === "serial") setBulkTarget(commonSerial);
    else if (
      requestedAction === "mainLocation" ||
      requestedAction === "location"
    )
      setBulkTarget(commonLocation);
    else if (
      requestedAction === "subLocation" ||
      requestedAction === "department"
    )
      setBulkTarget(commonDepartment);
    else if (requestedAction === "edit") setBulkTarget(commonCondition);
    else if (requestedAction === "status") setBulkTarget(commonStatus);
    else setBulkTarget("");

    setBulkReason("");
    setBulkDialog(true);
  };

  const runBulk = async () => {
    if (!bulkReason.trim()) return;
    setMutation({ status: "loading", message: t("common.working") });

    const commands: WorkflowCommand[] = selected.map((entityId, idx) => {
      const currentAsset = snapshot.assets.find((a) => a.id === entityId);

      if (bulkAction === "toInventory") {
        const stamp = Date.now().toString(36);
        const baseCode = (currentAsset?.code || `ASSET-${idx + 1}`).toUpperCase();
        return {
          action: "inventory.create" as const,
          values: {
            code: `INV-${baseCode}-${stamp}${idx}`,
            name: currentAsset?.name || "Nieuw voorraadartikel",
            itemType: "Equipment",
            category: currentAsset?.category || "Equipment",
            subcategory: currentAsset?.subcategory || "",
            brand: currentAsset?.brand || "",
            model: currentAsset?.model || "",
            manufacturer: currentAsset?.manufacturer || "",
            supplier: currentAsset?.supplier || "",
            unit: "pieces",
            onHand: 1,
            minimum: 0,
            reorderLevel: 0,
            reorderQuantity: 0,
            warehouse: "Main warehouse",
            location: currentAsset?.location || "Warehouse",
            department: currentAsset?.department || "",
            notes:
              `Toegevoegd vanuit ICT-module (${baseCode}). ${bulkReason}`.trim(),
          },
        };
      }

      if (["archive", "delete"].includes(bulkAction)) {
        return {
          action: "asset.archive" as const,
          entityId,
          values: {
            reason:
              bulkAction === "delete"
                ? `Verwijderen naar prullenbak: ${bulkReason}`
                : bulkReason,
          },
        };
      }

      if (bulkAction === "disposal") {
        return {
          action: "disposal.create" as const,
          entityId,
          values: { reason: bulkReason },
        };
      }

      const values: Record<string, any> = {
        reason: bulkReason,
        allowDuplicateSerial: true,
      };

      if (bulkAction === "bulkEdit") {
        if (bulkData.brand !== undefined && bulkData.brand !== "")
          values.brand = bulkData.brand;
        if (bulkData.name !== undefined && bulkData.name !== "")
          values.name = bulkData.name;
        if (bulkData.model !== undefined && bulkData.model !== "")
          values.model = bulkData.model;
        if (bulkData.location !== undefined && bulkData.location !== "") {
          values.location = bulkData.location;
          const locRef = snapshot.references.find(
            (r) => r.kind === "location" && r.name === bulkData.location,
          );
          if (locRef) {
            values.currentLocationId = locRef.id;
            values.homeLocationId = locRef.id;
            values.mainLocationId = locRef.mainLocationId || locRef.id;
          }
        }
        if (bulkData.department !== undefined && bulkData.department !== "") {
          values.department = bulkData.department;
          const deptRef = snapshot.references.find(
            (r) => r.kind === "department" && r.name === bulkData.department,
          );
          if (deptRef) values.departmentId = deptRef.id;
        }
        if (bulkData.isSerialSequence && bulkData.serialPrefix) {
          const startNum =
            parseInt(bulkData.serialStartNumber || "1", 10) || 1;
          const num = startNum + idx;
          values.serialNumber = `${bulkData.serialPrefix}${String(num).padStart(3, "0")}`;
        } else if (
          bulkData.serialNumber !== undefined &&
          bulkData.serialNumber !== ""
        ) {
          values.serialNumber = bulkData.serialNumber;
        }
        if (bulkData.codePrefix) {
          const prefix = bulkData.codePrefix.toUpperCase();
          const startNum = bulkData.codeStartNumber
            ? parseInt(bulkData.codeStartNumber, 10)
            : undefined;
          const num =
            startNum !== undefined
              ? startNum + idx
              : (currentAsset?.codeNumber || idx + 1);
          values.codeCorrection = `${prefix}-${num < 100 ? String(num).padStart(2, "0") : num}`;
          values.correctionReason = bulkReason;
          values.codePrefix = prefix;
          values.codeNumber = num;
        }
      } else if (bulkAction === "brand") {
        values.brand = bulkTarget || bulkData.brand;
      } else if (bulkAction === "name") {
        values.name = bulkTarget || bulkData.name;
      } else if (bulkAction === "model") {
        values.model = bulkTarget || bulkData.model;
      } else if (bulkAction === "serial") {
        if (bulkData.isSerialSequence && bulkData.serialPrefix) {
          const startNum =
            parseInt(bulkData.serialStartNumber || "1", 10) || 1;
          const num = startNum + idx;
          values.serialNumber = `${bulkData.serialPrefix}${String(num).padStart(3, "0")}`;
        } else {
          values.serialNumber = bulkTarget || bulkData.serialNumber;
        }
      } else if (bulkAction === "mainLocation" || bulkAction === "location") {
        const locName = bulkTarget || bulkData.location;
        values.location = locName;
        const locRef = snapshot.references.find(
          (r) => r.kind === "location" && r.name === locName,
        );
        if (locRef) {
          values.currentLocationId = locRef.id;
          values.homeLocationId = locRef.id;
          values.mainLocationId = locRef.mainLocationId || locRef.id;
        }
      } else if (bulkAction === "subLocation" || bulkAction === "department") {
        const deptName = bulkTarget || bulkData.department;
        values.department = deptName;
        const deptRef = snapshot.references.find(
          (r) => r.kind === "department" && r.name === deptName,
        );
        if (deptRef) values.departmentId = deptRef.id;
      } else if (bulkAction === "code") {
        if (selected.length === 1 && (bulkTarget || bulkData.codeDirect)) {
          values.codeCorrection = (
            bulkTarget ||
            bulkData.codeDirect ||
            ""
          ).toUpperCase();
          values.correctionReason = bulkReason;
        } else if (bulkData.codePrefix) {
          const prefix = bulkData.codePrefix.toUpperCase();
          const startNum = bulkData.codeStartNumber
            ? parseInt(bulkData.codeStartNumber, 10)
            : undefined;
          const num =
            startNum !== undefined
              ? startNum + idx
              : (currentAsset?.codeNumber || idx + 1);
          values.codeCorrection = `${prefix}-${num < 100 ? String(num).padStart(2, "0") : num}`;
          values.correctionReason = bulkReason;
          values.codePrefix = prefix;
          values.codeNumber = num;
        }
      } else if (bulkAction === "edit") {
        values.condition = bulkTarget;
      } else if (bulkAction === "status") {
        values.status = bulkTarget;
      }

      return {
        action: "asset.edit" as const,
        entityId,
        values,
      };
    });

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

  const isApplyDisabled =
    !bulkReason.trim() ||
    (bulkAction === "bulkEdit" &&
      !bulkData.brand &&
      !bulkData.name &&
      !bulkData.model &&
      !bulkData.serialNumber &&
      !bulkData.serialPrefix &&
      !bulkData.location &&
      !bulkData.department &&
      !bulkData.codePrefix &&
      !bulkData.codeDirect) ||
    (["edit", "status"].includes(bulkAction) && !bulkTarget) ||
    (bulkAction === "brand" && !bulkTarget && !bulkData.brand) ||
    (bulkAction === "name" && !bulkTarget && !bulkData.name) ||
    (bulkAction === "model" && !bulkTarget && !bulkData.model) ||
    (bulkAction === "serial" &&
      !bulkTarget &&
      !bulkData.serialNumber &&
      !(bulkData.isSerialSequence && bulkData.serialPrefix)) ||
    ((bulkAction === "mainLocation" || bulkAction === "location") &&
      !bulkTarget &&
      !bulkData.location) ||
    ((bulkAction === "subLocation" || bulkAction === "department") &&
      !bulkTarget &&
      !bulkData.department) ||
    (bulkAction === "code" &&
      !bulkTarget &&
      !bulkData.codePrefix &&
      !bulkData.codeDirect);

  const targetValues =
    bulkAction === "status"
      ? facets.status || []
      : bulkAction === "edit"
        ? [...ASSET_CONDITIONS]
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
            count={result.totalCount}
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
          open={bulkDialog}
          title={
            bulkAction === "bulkEdit"
              ? t("assets.bulk.editSelected")
              : bulkAction === "code"
                ? t("assets.bulk.editInvCode")
                : bulkAction === "brand"
                  ? t("assets.bulk.brand")
                  : bulkAction === "name"
                    ? t("assets.bulk.asset")
                    : bulkAction === "model"
                      ? t("assets.bulk.model")
                      : bulkAction === "serial"
                        ? t("assets.bulk.serial")
                        : bulkAction === "mainLocation" || bulkAction === "location"
                          ? t("assets.bulk.mainLocation")
                          : bulkAction === "subLocation" || bulkAction === "department"
                            ? t("assets.bulk.subLocation")
                            : bulkAction === "toInventory"
                              ? t("assets.bulk.toInventory")
                              : t("assets.bulk.confirm")
          }
          description={
            bulkAction === "bulkEdit"
              ? `${selected.length} ${t("common.selected")}. ${t("assets.bulk.editSelectedHelp")}`
              : `${selected.length} ${t("common.selected")}. ${t("assets.bulk.confirmHelp")}`
          }
          onClose={() => setBulkDialog(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setBulkDialog(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={runBulk} disabled={isApplyDisabled}>
                {t("common.apply")}
              </Button>
            </>
          }
        >
          <div className="workflow-form">
            <datalist id="bulk-brand-suggestions">
              {brandSuggestions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            <datalist id="bulk-name-suggestions">
              {nameSuggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <datalist id="bulk-model-suggestions">
              {modelSuggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>

            {bulkAction === "bulkEdit" && (
              <>
                <div className="field-with-hint">
                  <SelectField
                    label={t("assets.bulk.codePrefix")}
                    value={bulkData.codePrefix || ""}
                    onChange={(e) =>
                      setBulkData((prev) => ({
                        ...prev,
                        codePrefix: e.target.value,
                      }))
                    }
                  >
                    <option value="">(Geen wijziging / No change)</option>
                    {[...(snapshot.codeGroups || [])]
                      .filter((g) => g.isActive)
                      .map((g) => (
                        <option key={g.id} value={g.prefix}>
                          {g.name} ({g.prefix})
                        </option>
                      ))}
                  </SelectField>
                  {bulkData.codePrefix && (
                    <Field
                      label={t("assets.bulk.codeStart")}
                      type="number"
                      min="1"
                      placeholder="Bestaand volgnummer behouden / Keep existing sequence"
                      value={bulkData.codeStartNumber || ""}
                      onChange={(e) =>
                        setBulkData((prev) => ({
                          ...prev,
                          codeStartNumber: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>

                <Field
                  label={t("assets.bulk.brand")}
                  list="bulk-brand-suggestions"
                  placeholder="(Geen wijziging / No change)"
                  value={bulkData.brand || ""}
                  onChange={(e) =>
                    setBulkData((prev) => ({ ...prev, brand: e.target.value }))
                  }
                />

                <Field
                  label={t("assets.bulk.asset")}
                  list="bulk-name-suggestions"
                  placeholder="(Geen wijziging / No change)"
                  value={bulkData.name || ""}
                  onChange={(e) =>
                    setBulkData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />

                <Field
                  label={t("assets.bulk.model")}
                  list="bulk-model-suggestions"
                  placeholder="(Geen wijziging / No change)"
                  value={bulkData.model || ""}
                  onChange={(e) =>
                    setBulkData((prev) => ({ ...prev, model: e.target.value }))
                  }
                />

                <div className="field-with-hint">
                  <Field
                    label={t("assets.bulk.serial")}
                    placeholder="(Geen wijziging / No change)"
                    value={bulkData.serialNumber || ""}
                    onChange={(e) =>
                      setBulkData((prev) => ({
                        ...prev,
                        serialNumber: e.target.value,
                        isSerialSequence: false,
                      }))
                    }
                  />
                  {selected.length > 1 && (
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem", fontSize: "var(--text-base)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={!!bulkData.isSerialSequence}
                        onChange={(e) =>
                          setBulkData((prev) => ({
                            ...prev,
                            isSerialSequence: e.target.checked,
                          }))
                        }
                      />
                      <span>{t("assets.bulk.serialSequence")}</span>
                    </label>
                  )}
                  {bulkData.isSerialSequence && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <Field
                        label={t("assets.bulk.serialPrefix")}
                        value={bulkData.serialPrefix || ""}
                        onChange={(e) =>
                          setBulkData((prev) => ({
                            ...prev,
                            serialPrefix: e.target.value,
                          }))
                        }
                      />
                      <Field
                        label={t("assets.bulk.serialStart")}
                        type="number"
                        min="1"
                        value={bulkData.serialStartNumber || "1"}
                        onChange={(e) =>
                          setBulkData((prev) => ({
                            ...prev,
                            serialStartNumber: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                </div>

                <SelectField
                  label={t("assets.bulk.mainLocation")}
                  value={bulkData.location || ""}
                  onChange={(e) =>
                    setBulkData((prev) => ({ ...prev, location: e.target.value }))
                  }
                >
                  <option value="">(Geen wijziging / No change)</option>
                  {mainLocationOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  label={t("assets.bulk.subLocation")}
                  value={bulkData.department || ""}
                  onChange={(e) =>
                    setBulkData((prev) => ({
                      ...prev,
                      department: e.target.value,
                    }))
                  }
                >
                  <option value="">(Geen wijziging / No change)</option>
                  {subLocationOptions.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </SelectField>
              </>
            )}

            {bulkAction === "code" && (
              <div className="field-with-hint">
                {selected.length === 1 ? (
                  <Field
                    label={t("assets.bulk.editInvCode")}
                    value={bulkData.codeDirect || bulkTarget}
                    onChange={(e) => {
                      setBulkTarget(e.target.value);
                      setBulkData((prev) => ({ ...prev, codeDirect: e.target.value }));
                    }}
                    required
                  />
                ) : (
                  <>
                    <SelectField
                      label={t("assets.bulk.codePrefix")}
                      value={bulkData.codePrefix || ""}
                      onChange={(e) =>
                        setBulkData((prev) => ({
                          ...prev,
                          codePrefix: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">{t("common.chooseAction")}</option>
                      {[...(snapshot.codeGroups || [])]
                        .filter((g) => g.isActive)
                        .map((g) => (
                          <option key={g.id} value={g.prefix}>
                            {g.name} ({g.prefix})
                          </option>
                        ))}
                    </SelectField>
                    <Field
                      label={t("assets.bulk.codeStart")}
                      type="number"
                      min="1"
                      placeholder="Bestaand volgnummer behouden / Keep existing sequence"
                      value={bulkData.codeStartNumber || ""}
                      onChange={(e) =>
                        setBulkData((prev) => ({
                          ...prev,
                          codeStartNumber: e.target.value,
                        }))
                      }
                    />
                  </>
                )}
              </div>
            )}

            {bulkAction === "brand" && (
              <Field
                label={t("assets.bulk.brand")}
                list="bulk-brand-suggestions"
                value={bulkTarget}
                onChange={(e) => {
                  setBulkTarget(e.target.value);
                  setBulkData((prev) => ({ ...prev, brand: e.target.value }));
                }}
                required
              />
            )}

            {bulkAction === "name" && (
              <Field
                label={t("assets.bulk.asset")}
                list="bulk-name-suggestions"
                value={bulkTarget}
                onChange={(e) => {
                  setBulkTarget(e.target.value);
                  setBulkData((prev) => ({ ...prev, name: e.target.value }));
                }}
                required
              />
            )}

            {bulkAction === "model" && (
              <Field
                label={t("assets.bulk.model")}
                list="bulk-model-suggestions"
                value={bulkTarget}
                onChange={(e) => {
                  setBulkTarget(e.target.value);
                  setBulkData((prev) => ({ ...prev, model: e.target.value }));
                }}
                required
              />
            )}

            {bulkAction === "serial" && (
              <div className="field-with-hint">
                <Field
                  label={t("assets.bulk.serial")}
                  value={bulkTarget}
                  onChange={(e) => {
                    setBulkTarget(e.target.value);
                    setBulkData((prev) => ({
                      ...prev,
                      serialNumber: e.target.value,
                      isSerialSequence: false,
                    }));
                  }}
                  required={!bulkData.isSerialSequence}
                />
                {selected.length > 1 && (
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem", fontSize: "var(--text-base)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={!!bulkData.isSerialSequence}
                      onChange={(e) =>
                        setBulkData((prev) => ({
                          ...prev,
                          isSerialSequence: e.target.checked,
                        }))
                      }
                    />
                    <span>{t("assets.bulk.serialSequence")}</span>
                  </label>
                )}
                {bulkData.isSerialSequence && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <Field
                      label={t("assets.bulk.serialPrefix")}
                      value={bulkData.serialPrefix || ""}
                      onChange={(e) =>
                        setBulkData((prev) => ({
                          ...prev,
                          serialPrefix: e.target.value,
                        }))
                      }
                      required
                    />
                    <Field
                      label={t("assets.bulk.serialStart")}
                      type="number"
                      min="1"
                      value={bulkData.serialStartNumber || "1"}
                      onChange={(e) =>
                        setBulkData((prev) => ({
                          ...prev,
                          serialStartNumber: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {(bulkAction === "mainLocation" || bulkAction === "location") && (
              <SelectField
                label={t("assets.bulk.mainLocation")}
                value={bulkTarget}
                onChange={(e) => {
                  setBulkTarget(e.target.value);
                  setBulkData((prev) => ({ ...prev, location: e.target.value }));
                }}
                required
              >
                <option value="">{t("common.chooseAction")}</option>
                {mainLocationOptions.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </SelectField>
            )}

            {(bulkAction === "subLocation" || bulkAction === "department") && (
              <SelectField
                label={t("assets.bulk.subLocation")}
                value={bulkTarget}
                onChange={(e) => {
                  setBulkTarget(e.target.value);
                  setBulkData((prev) => ({ ...prev, department: e.target.value }));
                }}
                required
              >
                <option value="">{t("common.chooseAction")}</option>
                {subLocationOptions.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </SelectField>
            )}

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
