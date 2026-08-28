import {
  Archive,
  Columns3,
  Download,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Loader, State } from "./ui";
import { useApp } from "../context/AppContext";
import {
  COLLAPSED_ROW_LIMIT,
  DataCollapseBar,
} from "./data-list/DataCollapseBar";

export interface DataColumn<T> {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  text?: (row: T) => string | number;
  sortable?: boolean;
}
export interface DataTableProps<T> {
  id: string;
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  loading?: boolean;
  error?: string;
  pageSizeOptions?: number[];
  onRowClick?: (row: T) => void;
  onBulkAction?: (
    ids: string[],
    action: string,
    reason?: string,
  ) => Promise<void> | void;
  filters?: ReactNode;
}

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const DATEISH_COLUMN = /(date|time|at$|created|updated|due|deadline|scheduled)/i;

export function DataTable<T>({
  id,
  rows,
  columns,
  rowKey,
  searchPlaceholder,
  emptyTitle,
  emptyDescription,
  loading = false,
  error,
  onRowClick,
  onBulkAction,
  filters,
}: DataTableProps<T>) {
  const { language, formatDate, formatDateTime } = useApp();
  const nl = language === "nl";
  // Route any value that renders as an ISO date/date-time through the user's
  // preference, whatever the column is named. Falls back to the column-id
  // heuristic for date-ish columns that carry a non-ISO string.
  const toDisplay = (columnId: string, rendered: ReactNode) => {
    if (typeof rendered !== "string") return rendered;
    const value = rendered.trim();
    if (ISO_DATE_TIME.test(value)) return formatDateTime(value);
    if (ISO_DATE_ONLY.test(value)) return formatDate(value);
    if (!DATEISH_COLUMN.test(columnId)) return rendered;
    return /[T:]|\d{1,2}:\d{2}/.test(value) ? formatDateTime(value) : formatDate(value);
  };
  const cellSearchText = (column: DataColumn<T>, row: T) => {
    const raw = String(column.text?.(row) ?? column.render(row) ?? "");
    const shown = toDisplay(column.id, column.text ? String(column.text(row)) : column.render(row));
    return typeof shown === "string" && shown !== raw ? `${raw} ${shown}` : raw;
  };
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [visible, setVisible] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`kcs-columns-${id}`) || "null",
      ) as string[] | null;
      return saved?.filter((value) =>
        columns.some((column) => column.id === value),
      ).length
        ? saved.filter((value) => columns.some((column) => column.id === value))
        : columns.map((column) => column.id);
    } catch {
      return columns.map((column) => column.id);
    }
  });
  const [sort, setSort] = useState<{
    id: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  // Every module table shows the full data set by default; the text "collapse"
  // control under the table folds it down to a 30-row preview and back.
  const [collapsed, setCollapsed] = useState(false);
  const [savedViews, setSavedViews] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem(`kcs-views-${id}`) || "[]"),
  );
  const [notice, setNotice] = useState("");

  const searchable = useMemo(
    () =>
      rows.filter((row) =>
        columns.some((column) =>
          cellSearchText(column, row)
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, query, rows],
  );
  const sorted = useMemo(() => {
    if (!sort) return searchable;
    const column = columns.find((item) => item.id === sort.id);
    if (!column) return searchable;
    return [...searchable].sort((a, b) => {
      const av = column.text?.(a) ?? "",
        bv = column.text?.(b) ?? "";
      const result =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, {
              numeric: true,
              sensitivity: "base",
            });
      return sort.direction === "asc" ? result : -result;
    });
  }, [columns, searchable, sort]);
  const totalCount = sorted.length;
  const collapsible = totalCount > COLLAPSED_ROW_LIMIT;
  const pageRows =
    collapsible && collapsed ? sorted.slice(0, COLLAPSED_ROW_LIMIT) : sorted;
  const visibleColumns = columns.filter((column) =>
    visible.includes(column.id),
  );
  const mobileColumns =
    id === "locations"
      ? visibleColumns.filter((column) => column.id !== "actions")
      : [
          ...visibleColumns.slice(0, 5),
          ...visibleColumns.filter(
            (column) =>
              column.id === "status" &&
              !visibleColumns.slice(0, 5).includes(column),
          ),
        ];
  const renderCell = (column: DataColumn<T>, row: T) =>
    toDisplay(column.id, column.render(row));
  useEffect(() => {
    localStorage.setItem(`kcs-columns-${id}`, JSON.stringify(visible));
  }, [id, visible]);

  function toggleAll() {
    const ids = pageRows.map(rowKey);
    setSelected(
      ids.every((value) => selected.includes(value))
        ? selected.filter((value) => !ids.includes(value))
        : [...new Set([...selected, ...ids])],
    );
  }
  function toggle(idValue: string) {
    setSelected((current) =>
      current.includes(idValue)
        ? current.filter((value) => value !== idValue)
        : [...current, idValue],
    );
  }
  function saveView() {
    const name = prompt(
      nl ? "Naam van opgeslagen weergave" : "Saved view name",
    );
    if (!name) return;
    const next = [...new Set([...savedViews, name])];
    setSavedViews(next);
    localStorage.setItem(`kcs-views-${id}`, JSON.stringify(next));
    setNotice(nl ? "Weergave opgeslagen." : "View saved.");
  }
  function exportCsv() {
    const header = visibleColumns
      .map((column) => quote(column.label))
      .join(",");
    const body = sorted
      .map((row) =>
        visibleColumns
          .map((column) => quote(String(column.text?.(row) ?? "")))
          .join(","),
      )
      .join("\n");
    const blob = new Blob([`\uFEFF${header}\n${body}`], {
      type: "text/csv;charset=utf-8",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `kcs-${id}.csv`;
    link.click();
    URL.revokeObjectURL(href);
    setNotice(nl ? "CSV-export aangemaakt." : "CSV export created.");
  }
  async function bulk(action: string) {
    if (!selected.length || !onBulkAction) return;
    const reason =
      action === "delete"
        ? window
            .prompt(
              nl
                ? "Geef de verplichte reden voor verwijderen naar de prullenbak:"
                : "Enter the required reason for moving to the recycle bin:",
            )
            ?.trim()
        : undefined;
    if (action === "delete" && !reason) return;
    await onBulkAction(selected, action, reason);
    setSelected([]);
    setNotice(nl ? "Bulkactie voltooid." : "Bulk action completed.");
  }

  if (loading) return <Loader />;
  if (error)
    return (
      <State
        type="error"
        title={nl ? "Gegevens niet beschikbaar" : "Data unavailable"}
        description={error}
      />
    );
  return (
    <div className={`data-table data-table-${id}`} data-testid={`table-${id}`}>
      <div className="data-toolbar">
        <label className="search">
          <Search size={17} />
          <span className="sr-only">{searchPlaceholder}</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={searchPlaceholder}
          />
        </label>
        {filters}
        <div className="table-actions">
          <Button variant="secondary" onClick={saveView}>
            <Save />
            {nl ? "Weergave opslaan" : "Save view"}
          </Button>
          <div className="column-menu">
            <Button
              variant="secondary"
              aria-expanded={showColumns}
              onClick={() => setShowColumns((value) => !value)}
            >
              <Columns3 />
              {nl ? "Kolommen" : "Columns"}
            </Button>
            {showColumns && (
              <div
                role="dialog"
                aria-label={nl ? "Kolommen kiezen" : "Choose columns"}
              >
                {columns.map((column) => (
                  <label key={column.id}>
                    <input
                      type="checkbox"
                      checked={visible.includes(column.id)}
                      onChange={() =>
                        setVisible((current) =>
                          current.includes(column.id)
                            ? current.filter((value) => value !== column.id)
                            : [...current, column.id],
                        )
                      }
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <Button variant="secondary" onClick={exportCsv}>
            <Download />
            {nl ? "Exporteren" : "Export"}
          </Button>
        </div>
      </div>
      {(query || savedViews.length > 0) && (
        <div className="filter-chips">
          {query && (
            <button onClick={() => setQuery("")}>
              {nl ? "Zoeken" : "Search"}: {query} ×
            </button>
          )}
          {savedViews.map((view) => (
            <span key={view}>
              {view}
              <button
                aria-label={`${nl ? "Verwijder" : "Remove"} ${view}`}
                onClick={() => {
                  const next = savedViews.filter((value) => value !== view);
                  setSavedViews(next);
                  localStorage.setItem(`kcs-views-${id}`, JSON.stringify(next));
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="bulk-toolbar" role="status">
          <b>
            {selected.length} {nl ? "geselecteerd" : "selected"}
          </b>
          {onBulkAction && (
            <>
              <Button variant="secondary" onClick={() => bulk("archive")}>
                <Archive />
                {nl ? "Archiveren" : "Archive"}
              </Button>
              <Button variant="danger" onClick={() => bulk("delete")}>
                <Trash2 />
                {nl ? "Verwijderen" : "Delete"}
              </Button>
              <Button variant="secondary" onClick={() => bulk("restore")}>
                {nl ? "Herstellen" : "Restore"}
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={() => setSelected([])}>
            {nl ? "Selectie wissen" : "Clear selection"}
          </Button>
        </div>
      )}
      {notice && (
        <p className="inline-notice" role="status">
          {notice}
        </p>
      )}
      {pageRows.length === 0 ? (
        <State type="empty" title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div className="table-scroll desktop-table">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label={nl ? "Selecteer pagina" : "Select page"}
                      type="checkbox"
                      checked={pageRows.every((row) =>
                        selected.includes(rowKey(row)),
                      )}
                      onChange={toggleAll}
                    />
                  </th>
                  {visibleColumns.map((column) => (
                    <th key={column.id} data-column-id={column.id}>
                      {column.sortable ? (
                        <button
                          onClick={() =>
                            setSort((current) => ({
                              id: column.id,
                              direction:
                                current?.id === column.id &&
                                current.direction === "asc"
                                  ? "desc"
                                  : "asc",
                            }))
                          }
                        >
                          {column.label}
                          {sort?.id === column.id
                            ? sort.direction === "asc"
                              ? " ↑"
                              : " ↓"
                            : ""}
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={() => onRowClick?.(row)}
                    className={onRowClick ? "clickable" : ""}
                  >
                    <td onClick={(event) => event.stopPropagation()}>
                      <input
                        aria-label={`${nl ? "Selecteer" : "Select"} ${rowKey(row)}`}
                        type="checkbox"
                        checked={selected.includes(rowKey(row))}
                        onChange={() => toggle(rowKey(row))}
                      />
                    </td>
                    {visibleColumns.map((column) => (
                      <td key={column.id} data-column-id={column.id}>
                        {renderCell(column, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-records">
            {pageRows.map((row) => (
              <article key={rowKey(row)} onClick={() => onRowClick?.(row)}>
                <label onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.includes(rowKey(row))}
                    onChange={() => toggle(rowKey(row))}
                  />
                  <span className="sr-only">
                    {nl ? "Selecteren" : "Select"}
                  </span>
                </label>
                {mobileColumns.map((column) => (
                  <div key={column.id}>
                    <small>{column.label}</small>
                    <span>{renderCell(column, row)}</span>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </>
      )}
      <DataCollapseBar
        total={totalCount}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      />
    </div>
  );
}
