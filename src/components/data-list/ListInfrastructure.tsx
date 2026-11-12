import { CollapsibleSearch } from "../CollapsibleSearch";
import { PageActionsSlot } from "../pageActions";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Filter,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, Loader, State } from "../ui";
import { useT } from "../../i18n";
import { useApp } from "../../context/AppContext";

export interface ListColumn<T> {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  value: (row: T) => unknown;
  sortable?: boolean;
  required?: boolean;
}

export function DataPageLayout({
  header,
  alphabet,
  children,
}: {
  header: ReactNode;
  alphabet?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page data-page">
      {header}
      {alphabet}
      {children}
    </div>
  );
}

export function DataToolbar({
  search,
  onSearch,
  searchLabel,
  filterCount,
  onToggleFilters,
  savedViews,
  columnSelector,
  exportMenu,
  count,
  collapsibleSearch = false,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchLabel: string;
  filterCount: number;
  onToggleFilters: () => void;
  savedViews?: ReactNode;
  columnSelector?: ReactNode;
  exportMenu: ReactNode;
  count?: number;
  /** Show the search as a search key that expands on click. */
  collapsibleSearch?: boolean;
}) {
  const t = useT();
  const { language } = useApp();
  const nl = language === "nl";
  return (
    <div className="data-toolbar list-toolbar">
      {collapsibleSearch ? (
        <CollapsibleSearch value={search} onChange={onSearch} label={searchLabel} />
      ) : (
        <label className="search">
          <Search size={17} />
          <span className="sr-only">{searchLabel}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchLabel}
          />
        </label>
      )}
      <div className="table-actions">
        {typeof count === "number" && (
          <span className="data-toolbar__count" aria-live="polite">
            <b>{count.toLocaleString(nl ? "nl-NL" : "en-US")}</b>
            {nl ? "totaal records" : "total records"}
          </span>
        )}
        <Button
          variant="secondary"
          onClick={onToggleFilters}
          aria-expanded={filterCount > 0}
        >
          <Filter />
          {t("common.filters")}
          {filterCount ? ` (${filterCount})` : ""}
        </Button>
        {savedViews}
        {columnSelector}
        {exportMenu}
        <PageActionsSlot />
      </div>
    </div>
  );
}

export function FilterPanel({
  open,
  children,
  onClear,
  onSave,
}: {
  open: boolean;
  children: ReactNode;
  onClear: () => void;
  onSave: () => void;
}) {
  const t = useT();
  if (!open) return null;
  return (
    <section
      className="advanced-filter-panel"
      aria-label={t("common.advancedFilters")}
    >
      <div className="filter-grid">{children}</div>
      <div className="filter-actions">
        <Button variant="secondary" onClick={onClear}>
          {t("common.clearAll")}
        </Button>
        <Button onClick={onSave}>{t("common.save")}</Button>
      </div>
    </section>
  );
}

/**
 * FilterField — custom dropdown die ALTIJD naar beneden openklapt.
 * Vervangt de native <select>, want browsers besluiten daar zelf of een
 * popup naar boven of beneden moet (afhankelijk van beschikbare ruimte).
 * Deze versie forceert "top: 100%" dus altijd onder het veld.
 */
export function FilterField({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: (string | { value: string; label: string })[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const options: { value: string; label: string }[] = [
    { value: "", label: t("common.all") },
    ...values.map((item) =>
      typeof item === "string"
        ? { value: item, label: item }
        : { value: item.value, label: item.label },
    ),
  ];
  const current =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <div
        className={`filter-dropdown${open ? " is-open" : ""}`}
        ref={rootRef}
      >
        <button
          id={id}
          type="button"
          className="filter-dropdown__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="filter-dropdown__value">{current.label}</span>
          <span className="filter-dropdown__caret" aria-hidden="true">
            ▾
          </span>
        </button>
        {open && (
          <ul
            role="listbox"
            className="filter-dropdown__menu"
            aria-labelledby={id}
          >
            {options.map((option) => (
              <li
                key={option.value || "__all__"}
                role="option"
                aria-selected={option.value === value}
                className={`filter-dropdown__option${
                  option.value === value ? " is-selected" : ""
                }`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  );
}

export function FilterInput({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function ActiveFilterChips({
  filters,
  onRemove,
}: {
  filters: { field: string; label: string; value: string }[];
  onRemove: (field: string) => void;
}) {
  const t = useT();
  if (!filters.length) return null;
  return (
    <div className="filter-chips" aria-label={t("common.activeFilters")}>
      {filters.map((filter) => (
        <span key={filter.field}>
          {filter.label}: {filter.value}
          <button
            aria-label={`${t("common.removeFilter")}: ${filter.label}`}
            onClick={() => onRemove(filter.field)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export function ColumnSelector<T>({
  columns,
  visible,
  onChange,
}: {
  columns: ListColumn<T>[];
  visible: string[];
  onChange: (columns: string[]) => void;
}) {
  const t = useT();
  return (
    <details className="list-menu">
      <summary className="btn btn-secondary">
        <Columns3 />
        {t("common.columns")}
      </summary>
      <div>
        {columns.map((column) => (
          <label key={column.id}>
            <input
              type="checkbox"
              checked={visible.includes(column.id)}
              disabled={column.required}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...visible, column.id]
                    : visible.filter((id) => id !== column.id),
                )
              }
            />
            {column.label}
          </label>
        ))}
      </div>
    </details>
  );
}



export function SavedViewSelector({
  views,
  onApply,
  onSave,
  onDelete,
}: {
  views: { id: string; name: string }[];
  onApply: (id: string) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  return (
    <details className="list-menu">
      <summary className="btn btn-secondary">
        <Save />
        {t("common.views")}
      </summary>
      <div>
        <Button variant="ghost" onClick={onSave}>
          {t("common.saveCurrentView")}
        </Button>
        {views.length === 0 ? (
          <small>{t("common.noSavedViews")}</small>
        ) : (
          views.map((view) => (
            <span className="saved-view-row" key={view.id}>
              <button onClick={() => onApply(view.id)}>{view.name}</button>
              <button
                aria-label={`${t("common.removeFilter")}: ${view.name}`}
                onClick={() => onDelete(view.id)}
              >
                <Trash2 />
              </button>
            </span>
          ))
        )}
      </div>
    </details>
  );
}

export function ExportMenu({
  onCsv,
  onExcel,
  onPrint,
}: {
  onCsv: () => void;
  onExcel: () => void;
  onPrint: () => void;
}) {
  const t = useT();
  return (
    <details className="list-menu">
      <summary className="btn btn-secondary">
        <Download />
        {t("common.export")}
      </summary>
      <div>
        <button onClick={onCsv}>CSV</button>
        <button onClick={onExcel}>Excel</button>
        <button onClick={onPrint}>{t("common.printPreview")}</button>
      </div>
    </details>
  );
}

export function BulkActionToolbar({
  count,
  actions,
  value,
  onChange,
  onRun,
  onRunMulti,
  onClear,
  busy,
}: {
  count: number;
  actions: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  onRun: (action?: string) => void;
  /** Called when the user picks 2+ edit-fields via the checkbox menu. */
  onRunMulti?: (actionIds: string[]) => void;
  onClear: () => void;
  busy: boolean;
}) {
  const t = useT();
  const { language } = useApp();
  const nl = language === "nl";
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    // Reset selectie zodra er geen rijen meer geselecteerd zijn.
    if (!count) {
      setPicked([]);
      setOpen(false);
    }
  }, [count]);

  if (!count) return null;

  const quickActions = actions.filter(
    (action) => action.id === "archive" || action.id === "delete",
  );
  const selectActions = actions.filter(
    (action) => action.id !== "archive" && action.id !== "delete",
  );
  // Acties die zich LENEN voor multi-select combineren (velden op het middel
  // aanpassen). Overige acties (toInventory, qr, export, disposal, bulkEdit)
  // zijn stand-alone en blijven radio-stijl.
  const MULTI_IDS = new Set([
    "code",
    "brand",
    "name",
    "model",
    "serial",
    "mainLocation",
    "subLocation",
    "assignUser",
    "edit",
    "status",
  ]);
  const multiActions = selectActions.filter((action) => MULTI_IDS.has(action.id));
  const singleActions = selectActions.filter(
    (action) => !MULTI_IDS.has(action.id),
  );

  const togglePick = (id: string) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const apply = () => {
    if (!picked.length) return;
    if (picked.length === 1) {
      onChange(picked[0]);
      onRun(picked[0]);
    } else if (onRunMulti) {
      onRunMulti(picked);
    }
    setOpen(false);
    setPicked([]);
  };

  const triggerLabel = picked.length
    ? `${picked.length} ${nl ? "gekozen" : "picked"}`
    : t("common.chooseAction");

  return (
    <div
      className="bulk-toolbar"
      role="region"
      aria-label={t("common.bulkAction")}
    >
      <strong>
        {count} {t("common.selected")}
      </strong>
      <div
        className={`bulk-action-picker${open ? " is-open" : ""}`}
        ref={rootRef}
      >
        <button
          type="button"
          className="bulk-action-picker__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          disabled={busy}
        >
          <span>{triggerLabel}</span>
          <span className="bulk-action-picker__caret" aria-hidden="true">▾</span>
        </button>
        {open && (
          <div className="bulk-action-picker__menu" role="menu">
            {!!multiActions.length && (
              <>
                <div className="bulk-action-picker__group-label">
                  {nl ? "Velden aanpassen (meerdere mogelijk)" : "Edit fields (pick multiple)"}
                </div>
                {multiActions.map((action) => {
                  const checked = picked.includes(action.id);
                  return (
                    <label
                      key={action.id}
                      className={`bulk-action-picker__option${
                        checked ? " is-checked" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePick(action.id)}
                      />
                      <span>{action.label}</span>
                    </label>
                  );
                })}
              </>
            )}
            {!!singleActions.length && (
              <>
                <div className="bulk-action-picker__group-label">
                  {nl ? "Losse acties" : "Single actions"}
                </div>
                {singleActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className="bulk-action-picker__single"
                    onClick={() => {
                      onChange(action.id);
                      onRun(action.id);
                      setOpen(false);
                      setPicked([]);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      <Button onClick={apply} disabled={!picked.length || busy}>
        {busy ? t("common.working") : t("common.apply")}
      </Button>
      {quickActions.map((action) => (
        <Button
          key={action.id}
          variant={action.id === "delete" ? "danger" : "secondary"}
          disabled={busy}
          onClick={() => {
            onChange(action.id);
            onRun(action.id);
          }}
        >
          {action.id === "delete" ? <Trash2 /> : <Archive />}
          {action.label}
        </Button>
      ))}
      <Button variant="ghost" onClick={onClear}>
        {t("common.clearSelection")}
      </Button>
    </div>
  );
}

export function DataListStates({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error: string;
  empty: boolean;
  onRetry: () => void;
}) {
  const t = useT();
  if (loading) return <Loader />;
  if (error)
    return (
      <State
        type="error"
        title={t("common.loadError")}
        description={error}
        action={<Button onClick={onRetry}>{t("common.tryAgain")}</Button>}
      />
    );
  if (empty)
    return (
      <State
        type="empty"
        title={t("common.noResults")}
        description={t("common.noResultsHelp")}
      />
    );
  return null;
}

export function ResponsiveDataList<T>({
  id,
  rows,
  columns,
  visible,
  rowKey,
  selected,
  onSelection,
  onRowClick,
  onSort,
  sort,
}: {
  id: string;
  rows: T[];
  columns: ListColumn<T>[];
  visible: string[];
  rowKey: (row: T) => string;
  selected: string[];
  onSelection: (ids: string[]) => void;
  onRowClick: (row: T) => void;
  onSort: (id: string) => void;
  sort?: { field: string; direction: "asc" | "desc" };
}) {
  const t = useT(),
    { formatAuto } = useApp(),
    visibleSet = new Set(visible),
    selectedSet = new Set(selected),
    shown = columns.filter((column) => visibleSet.has(column.id));
  // Renders the full result set — scroll to reach the last row.
  const displayRows = rows;
  // Any cell that renders as an ISO date/date-time string (e.g. the
  // "last updated" column) follows the user's date & time preference.
  const cell = (column: ListColumn<T>, row: T) => formatAuto(column.render(row));
  const allSelected =
    displayRows.length > 0 &&
    displayRows.every((row) => selectedSet.has(rowKey(row)));
  const toggleAll = (checked: boolean) =>
    onSelection(
      checked
        ? [...new Set([...selected, ...displayRows.map(rowKey)])]
        : selected.filter(
            (id) => !displayRows.some((row) => rowKey(row) === id),
          ),
    );
  return (
    <div className={`data-table data-table-${id}`} data-testid={`table-${id}`}>
      <div className="table-scroll desktop-table">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  aria-label={t("common.selectAllPage")}
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </th>
              {shown.map((column) => (
                <th key={column.id} data-column-id={column.id}>
                  {column.sortable ? (
                    <button onClick={() => onSort(column.id)}>
                      {column.label}
                      {sort?.field === column.id
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
            {displayRows.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  className="clickable"
                  onClick={() => onRowClick(row)}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      aria-label={`${t("common.selected")} ${key}`}
                      type="checkbox"
                      checked={selectedSet.has(key)}
                      onChange={(event) =>
                        onSelection(
                          event.target.checked
                            ? [...selected, key]
                            : selected.filter(
                                (selectedId) => selectedId !== key,
                              ),
                        )
                      }
                    />
                  </td>
                  {shown.map((column) => (
                    <td key={column.id} data-column-id={column.id}>{cell(column, row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mobile-records">
        {displayRows.map((row) => {
          const key = rowKey(row);
          return (
            <article
              key={key}
              tabIndex={0}
              onClick={() => onRowClick(row)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onRowClick(row);
              }}
            >
              <label onClick={(event) => event.stopPropagation()}>
                <input
                  aria-label={`${t("common.selected")} ${key}`}
                  type="checkbox"
                  checked={selectedSet.has(key)}
                  onChange={(event) =>
                    onSelection(
                      event.target.checked
                        ? [...selected, key]
                        : selected.filter((selectedId) => selectedId !== key),
                    )
                  }
                />
              </label>
              {shown.map((column) => (
                <div key={column.id}>
                  <small>{column.label}</small>
                  <span>{cell(column, row)}</span>
                </div>
              ))}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function PaginationControls({
  totalCount,
  pageSize,
  hasNext,
  hasPrevious,
  onPageSize,
  onNext,
  onPrevious,
}: {
  totalCount: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
  onPageSize: (size: number) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const t = useT();
  return (
    <nav className="pagination" aria-label={t("common.records")}>
      <label>
        {t("common.rowsPerPage")}{" "}
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          {[5, 10, 25, 50].map((size) => (
            <option key={size}>{size}</option>
          ))}
        </select>
      </label>
      <span>
        {totalCount} {t("common.records")}
      </span>
      <Button
        variant="secondary"
        onClick={onPrevious}
        disabled={!hasPrevious}
        aria-label={t("common.previous")}
      >
        <ChevronLeft />
        {t("common.previous")}
      </Button>
      <Button
        variant="secondary"
        onClick={onNext}
        disabled={!hasNext}
        aria-label={t("common.next")}
      >
        {t("common.next")}
        <ChevronRight />
      </Button>
    </nav>
  );
}
