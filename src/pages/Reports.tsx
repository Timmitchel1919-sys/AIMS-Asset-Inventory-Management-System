import {
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Field, SelectField } from "../components/ui";
import { DataTable, type DataColumn } from "../components/DataTable";
import { Dialog, OfflineGate, PageHeader } from "../components/WorkflowUi";
import { useApp } from "../context/AppContext";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import {
  REPORT_DEFINITIONS,
  buildReportData,
  downloadFile,
  exportReportToCsv,
  exportReportToExcel,
  type ReportCategory,
  type ReportFilterOptions,
} from "../domain/reports";

const CATEGORY_OPTIONS: { id: ReportCategory | "all"; en: string; nl: string }[] = [
  { id: "all", en: "All Categories", nl: "Alle Categorieën" },
  { id: "assets", en: "Assets", nl: "Middelen" },
  { id: "inventory", en: "Inventory & Status", nl: "Voorraad & Status" },
  { id: "locations", en: "Locations", nl: "Locaties" },
  { id: "assignments", en: "Assignments", nl: "Toewijzingen" },
  { id: "loans", en: "Loans", nl: "Uitleen" },
  { id: "repairs", en: "Repairs", nl: "Reparaties" },
  { id: "maintenance", en: "Maintenance", nl: "Onderhoud" },
  { id: "movements", en: "Movements", nl: "Mutaties" },
  { id: "audits", en: "Audits", nl: "Controles" },
  { id: "audit-logs", en: "Audit Trail", nl: "Audittrail" },
  { id: "warehouse", en: "Warehouse", nl: "Magazijn" },
  { id: "devices", en: "Devices", nl: "Apparaten" },
];

export default function ReportsPage() {
  const { language, user, formatDateTime } = useApp();
  const nl = language === "nl";
  const snapshot = useMockSnapshot();
  const repository = useRepository();

  const [selectedReportId, setSelectedReportId] =
    useState<string>("assets-master");
  const [activeCategory, setActiveCategory] = useState<ReportCategory | "all">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Filtered available reports
  const availableReports = useMemo(() => {
    if (activeCategory === "all") return REPORT_DEFINITIONS;
    return REPORT_DEFINITIONS.filter((r) => r.category === activeCategory);
  }, [activeCategory]);

  const handleCategoryChange = (newCat: ReportCategory | "all") => {
    setActiveCategory(newCat);
    const reportsForCat =
      newCat === "all"
        ? REPORT_DEFINITIONS
        : REPORT_DEFINITIONS.filter((r) => r.category === newCat);
    if (
      !reportsForCat.some((r) => r.id === selectedReportId) &&
      reportsForCat.length > 0
    ) {
      setSelectedReportId(reportsForCat[0].id);
    }
  };

  const handleReportChange = (newId: string) => {
    setSelectedReportId(newId);
    const rep = REPORT_DEFINITIONS.find((r) => r.id === newId);
    if (rep && activeCategory !== "all" && rep.category !== activeCategory) {
      setActiveCategory(rep.category);
    }
  };

  const currentReportConfig = useMemo(() => {
    return (
      REPORT_DEFINITIONS.find((r) => r.id === selectedReportId) ||
      REPORT_DEFINITIONS[0]
    );
  }, [selectedReportId]);

  const filterOptions: ReportFilterOptions = useMemo(
    () => ({
      search,
      status: filterStatus || undefined,
      location: filterLocation || undefined,
      department: filterDepartment || undefined,
    }),
    [search, filterStatus, filterLocation, filterDepartment],
  );

  // Canonical report data generated directly from live snapshot
  const generated = useMemo(() => {
    return buildReportData(
      selectedReportId,
      snapshot,
      filterOptions,
      user?.name || "AIMS User",
    );
  }, [selectedReportId, snapshot, filterOptions, user?.name]);

  // Record export operation to audit trail
  const recordExportAudit = async (format: string) => {
    try {
      await repository.execute({
        action: "report.export",
        values: {
          event: "REPORT_EXPORTED",
          action: "EXPORT_DATA",
          entityType: "report",
          entityId: currentReportConfig.id,
          detail: `Exported ${currentReportConfig.name} (${generated.totalRecords} records) as ${format}. Filters: ${JSON.stringify(filterOptions)}`,
          result: "Success",
        },
      });
    } catch {
      // Best effort audit record
    }
  };

  const handleExportCsv = async () => {
    const csvContent = exportReportToCsv(generated, language as "en" | "nl");
    const filename = `${currentReportConfig.id}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(csvContent, filename, "text/csv;charset=utf-8;");
    await recordExportAudit("CSV");
    setExportNotice(
      nl
        ? `CSV-bestand gedownload: ${filename}`
        : `CSV export completed: ${filename}`,
    );
    setTimeout(() => setExportNotice(null), 4000);
  };

  const handleExportExcel = async () => {
    const excelBuffer = exportReportToExcel(generated, language as "en" | "nl");
    const filename = `${currentReportConfig.id}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    downloadFile(
      excelBuffer,
      filename,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    await recordExportAudit("XLSX");
    setExportNotice(
      nl
        ? `Excel-werkblad gedownload: ${filename}`
        : `Excel workbook export completed: ${filename}`,
    );
    setTimeout(() => setExportNotice(null), 4000);
  };

  const handleOpenPrintPreview = async () => {
    setPrintModalOpen(true);
    await recordExportAudit("PDF/Print");
  };

  // Build DataTable columns
  const tableColumns: DataColumn<Record<string, any>>[] = useMemo(() => {
    return generated.columns.map((col) => ({
      id: col.key,
      label: nl ? col.labelNl : col.label,
      render: (item) => {
        const val = item[col.key];
        if (col.key === "status") {
          return (
            <Badge
              tone={
                val === "Available" || val === "Active" || val === "Completed"
                  ? "success"
                  : val === "Under Repair" ||
                      val === "Overdue" ||
                      val === "Defective"
                    ? "danger"
                    : "neutral"
              }
            >
              {String(val || "—")}
            </Badge>
          );
        }
        return <span>{String(val ?? "—")}</span>;
      },
      text: (item) => String(item[col.key] ?? ""),
      sortable: true,
    }));
  }, [generated.columns, nl]);

  const uniqueLocations = useMemo(() => {
    return Array.from(
      new Set(snapshot.assets.map((a) => a.location).filter(Boolean)),
    ).sort();
  }, [snapshot.assets]);

  const uniqueDepartments = useMemo(() => {
    return Array.from(
      new Set(snapshot.assets.map((a) => a.department).filter(Boolean)),
    ).sort();
  }, [snapshot.assets]);

  return (
    <OfflineGate>
      <div className="page reports-page">
        <PageHeader
          title={nl ? "Rapporten & Exportcentrum" : "Reporting & Export Center"}
          description={
            nl
              ? "Geautoriseerde operationele rapporten, auditoverzichten en exports direct vanuit de canonieke AIMS-gegevens."
              : "Authorized operational reports, audit summaries, and data exports directly from canonical AIMS data."
          }
          actions={
            <div className="actions">
              <Button variant="secondary" onClick={handleOpenPrintPreview}>
                <Printer className="w-4 h-4 mr-1" />
                {nl ? "Afdrukken / PDF" : "Print / PDF"}
              </Button>
              <Button variant="secondary" onClick={handleExportCsv}>
                <FileText className="w-4 h-4 mr-1" />
                CSV
              </Button>
              <Button onClick={handleExportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Excel (XLSX)
              </Button>
            </div>
          }
        />

        {exportNotice && (
          <div className="alert alert-success mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{exportNotice}</span>
          </div>
        )}

        {/* Unified Report Definition, KPIs & Filter Toolbar */}
        <section className="card reports-control-card">
          <div className="reports-control-header">
            <div className="reports-identity">
              <div className="reports-identity-icon" aria-hidden="true">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="reports-title">
                  {nl ? currentReportConfig.nameNl : currentReportConfig.name}
                </h2>
                <p className="reports-description">
                  {nl
                    ? currentReportConfig.descriptionNl
                    : currentReportConfig.description}
                </p>
              </div>
            </div>

            <div
              className="reports-metrics-inline"
              aria-label={nl ? "Rapportstatistieken" : "Report summary metrics"}
            >
              {generated.metrics.map((m, idx) => (
                <div key={idx} className="reports-metric-pill">
                  <span className="reports-metric-pill-label">
                    {nl ? m.labelNl : m.label}
                  </span>
                  <strong className="reports-metric-pill-value">{m.value}</strong>
                </div>
              ))}
              <div className="reports-metric-pill reports-metric-pill--count">
                <span className="reports-metric-pill-label">
                  {nl ? "Records" : "Records"}
                </span>
                <strong className="reports-metric-pill-value">
                  {generated.totalRecords}
                </strong>
              </div>
            </div>
          </div>

          <div className="reports-filter-grid">
            <div className="reports-category-select">
              <SelectField
                label={nl ? "Categorie" : "Category"}
                value={activeCategory}
                onChange={(e) =>
                  handleCategoryChange(e.target.value as ReportCategory | "all")
                }
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {nl ? cat.nl : cat.en}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="reports-report-select">
              <SelectField
                label={
                  nl ? "Selecteer Rapportdefinitie" : "Select Report Definition"
                }
                value={selectedReportId}
                onChange={(e) => handleReportChange(e.target.value)}
              >
                {availableReports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {nl ? r.nameNl : r.name}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="reports-search-field">
              <Field
                label={nl ? "Snel Zoeken" : "Quick Search"}
                type="text"
                placeholder={nl ? "Filter records…" : "Filter records…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="reports-location-select">
              <SelectField
                label={nl ? "Locatiefilter" : "Location Filter"}
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
              >
                <option value="">
                  {nl ? "Alle Locaties" : "All Locations"}
                </option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        </section>

        {/* Dynamic Report Data Table ("element tree" elevated right below) */}
        <section className="card data-card reports-results-card">

          <DataTable
            id={`report-${selectedReportId}`}
            rows={generated.rows}
            columns={tableColumns}
            rowKey={(item: Record<string, any>) =>
              `${item.code || item.id || item.reference || item.auditId || item.assetCode || JSON.stringify(item)}`
            }
            searchPlaceholder={
              nl ? "Zoek in resultaten…" : "Search within results…"
            }
            emptyTitle={nl ? "Geen records gevonden" : "No records found"}
            emptyDescription={
              nl
                ? "Geen gegevens voldoen aan de geselecteerde filters."
                : "No data matches the selected filters."
            }
          />
        </section>

        {/* Clean Theme-Neutral Print / PDF Modal */}
        <Dialog
          open={printModalOpen}
          title={nl ? currentReportConfig.nameNl : currentReportConfig.name}
          description={
            nl
              ? "Afdrukvoorbeeld en exportweergave van de canonieke AIMS-gegevens."
              : "Print preview and export view of canonical AIMS data."
          }
          onClose={() => setPrintModalOpen(false)}
        >
          <div className="print-controls flex justify-between items-center mb-4">
            <span className="text-xs text-slate-500">
              {nl ? "Gegenereerd door: " : "Generated by: "}{" "}
              {user?.name || "AIMS"} ({formatDateTime(new Date())})
            </span>
            <Button onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" />
              {nl ? "Nu Afdrukken" : "Print Now"}
            </Button>
          </div>

          <div className="print-preview p-6 bg-white border rounded shadow-sm">
            <header className="flex justify-between items-start border-b pb-4 mb-4">
              <div>
                <strong className="text-lg font-black tracking-wider text-slate-900 block">
                  AIMS
                </strong>
                <small className="text-xs font-semibold text-slate-500 block">
                  Asset &amp; Inventory Management System
                </small>
                <h3 className="text-base font-bold text-slate-800 mt-2">
                  {nl ? currentReportConfig.nameNl : currentReportConfig.name}
                </h3>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>
                  <strong>St. Kangoeroe Community School</strong>
                </p>
                <p>{formatDateTime(new Date())}</p>
                <p>
                  {nl ? "Aantal records: " : "Record count: "}{" "}
                  {generated.totalRecords}
                </p>
              </div>
            </header>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-slate-100">
                  {generated.columns.slice(0, 6).map((col) => (
                    <th
                      key={col.key}
                      className="py-2 px-2 font-bold text-slate-700"
                    >
                      {nl ? col.labelNl : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {generated.rows.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="border-b">
                    {generated.columns.slice(0, 6).map((col) => (
                      <td key={col.key} className="py-1.5 px-2 text-slate-800">
                        {String(row[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {generated.rows.length > 50 && (
              <p className="text-center text-xs text-slate-400 mt-3">
                {nl
                  ? `(Toont de eerste 50 van ${generated.totalRecords} records. Download CSV/Excel voor de volledige dataset.)`
                  : `(Showing first 50 of ${generated.totalRecords} records. Download CSV/Excel for complete dataset.)`}
              </p>
            )}

            <footer className="mt-6 pt-3 border-t text-xs text-slate-400 flex justify-between">
              <span>
                {nl
                  ? "Vertrouwelijk — KCS Intern Beheer"
                  : "Confidential — KCS Internal Governance"}
              </span>
              <span>AIMS v0.1.0</span>
            </footer>
          </div>
        </Dialog>
      </div>
    </OfflineGate>
  );
}

export function AuditTrailPage() {
  const { language } = useApp();
  const nl = language === "nl";
  const snapshot = useMockSnapshot();

  const columns: DataColumn<any>[] = [
    {
      id: "time",
      label: nl ? "Datum en tijd" : "Timestamp",
      render: (item) => item.at,
      text: (item) => item.at,
      sortable: true,
    },
    {
      id: "user",
      label: nl ? "Gebruiker" : "User",
      render: (item) => item.user,
      text: (item) => item.user,
    },
    {
      id: "action",
      label: nl ? "Actie" : "Action",
      render: (item) => <strong>{item.event ?? item.action}</strong>,
      text: (item) => `${item.event ?? ""} ${item.action}`.trim(),
    },
    {
      id: "entity",
      label: nl ? "Record" : "Entity",
      render: (item) => `${item.entityType} · ${item.entityId}`,
      text: (item) => item.entityId,
    },
    {
      id: "detail",
      label: nl ? "Beschrijving" : "Description",
      render: (item) => item.detail,
      text: (item) => item.detail,
    },
    {
      id: "result",
      label: nl ? "Resultaat" : "Result",
      render: (item) => (
        <Badge tone={item.result === "Success" ? "success" : "danger"}>
          {item.result}
        </Badge>
      ),
      text: (item) => item.result,
    },
  ];

  return (
    <OfflineGate>
      <div className="page">
        <PageHeader
          title="Audit Trail"
          description="Searchable operational history of changes made throughout AIMS."
        />
        <section className="card data-card">
          <DataTable
            id="audit-trail"
            rows={snapshot.activity}
            columns={columns}
            rowKey={(item) => item.id}
            searchPlaceholder="Search operational history…"
            emptyTitle="No operational history"
            emptyDescription="Asset, inventory, maintenance, repair, disposal, and account events will appear here."
          />
        </section>
      </div>
    </OfflineGate>
  );
}
