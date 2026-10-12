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

export default function ReportsPage() {
  const { language, user, formatDateTime } = useApp();
  const nl = language === "nl";
  const snapshot = useMockSnapshot();
  const repository = useRepository();

  const [selectedReportId, setSelectedReportId] = useState<string>("assets-master");
  const [activeCategory, setActiveCategory] = useState<ReportCategory | "all">("all");
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
                  : val === "Under Repair" || val === "Overdue" || val === "Defective"
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

        {/* Report Category Switcher */}
        <section className="card p-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase mr-1">
              {nl ? "Categorieën:" : "Categories:"}
            </span>
            {(
              [
                ["all", nl ? "Alle Rapporten" : "All Reports"],
                ["assets", nl ? "Middelen" : "Assets"],
                ["inventory", nl ? "Voorraad & Status" : "Inventory & Status"],
                ["locations", nl ? "Locaties" : "Locations"],
                ["assignments", nl ? "Toewijzingen" : "Assignments"],
                ["loans", nl ? "Uitleen" : "Loans"],
                ["repairs", nl ? "Reparaties" : "Repairs"],
                ["maintenance", nl ? "Onderhoud" : "Maintenance"],
                ["movements", nl ? "Mutaties" : "Movements"],
                ["audits", nl ? "Controles" : "Audits"],
                ["audit-logs", nl ? "Audittrail" : "Audit Trail"],
                ["warehouse", nl ? "Magazijn" : "Warehouse"],
                ["devices", nl ? "Apparaten" : "Devices"],
              ] as const
            ).map(([catKey, catLabel]) => (
              <button
                key={catKey}
                type="button"
                className={`btn btn-sm ${activeCategory === catKey ? "btn-primary font-bold" : "btn-secondary"}`}
                onClick={() => {
                  setActiveCategory(catKey);
                  const firstInCat =
                    catKey === "all"
                      ? REPORT_DEFINITIONS[0]
                      : REPORT_DEFINITIONS.find((r) => r.category === catKey);
                  if (firstInCat) setSelectedReportId(firstInCat.id);
                }}
              >
                {catLabel}
              </button>
            ))}
          </div>
        </section>

        {/* Active Report Selector & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <SelectField
              label={nl ? "Selecteer Rapportdefinitie" : "Select Report Definition"}
              value={selectedReportId}
              onChange={(e) => setSelectedReportId(e.target.value)}
            >
              {availableReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {nl ? r.nameNl : r.name}
                </option>
              ))}
            </SelectField>
          </div>

          <div>
            <Field
              label={nl ? "Snel Zoeken" : "Quick Search"}
              type="text"
              placeholder={nl ? "Filter records…" : "Filter records…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <SelectField
              label={nl ? "Locatiefilter" : "Location Filter"}
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
            >
              <option value="">{nl ? "Alle Locaties" : "All Locations"}</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        {/* Real-Time KPI Metrics from Canonical Data */}
        {generated.metrics.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
            {generated.metrics.map((m, idx) => (
              <div key={idx} className="card p-3 border text-center">
                <span className="text-xs text-slate-500 font-semibold block mb-1">
                  {nl ? m.labelNl : m.label}
                </span>
                <strong className="text-xl font-bold text-slate-800">
                  {m.value}
                </strong>
              </div>
            ))}
          </div>
        )}

        {/* Dynamic Report Data Table */}
        <section className="card data-card mb-6">
          <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {nl ? currentReportConfig.nameNl : currentReportConfig.name}
              </h2>
              <p className="text-xs text-slate-500">
                {nl
                  ? currentReportConfig.descriptionNl
                  : currentReportConfig.description}
              </p>
            </div>
            <span className="text-xs bg-slate-200 px-2.5 py-1 rounded-full font-semibold text-slate-700">
              {generated.totalRecords}{" "}
              {nl ? "records gevonden" : "records found"}
            </span>
          </div>

          <DataTable
            id={`report-${selectedReportId}`}
            rows={generated.rows}
            columns={tableColumns}
            rowKey={(item: Record<string, any>) => `${item.code || item.id || item.reference || item.auditId || item.assetCode || JSON.stringify(item)}`}
            searchPlaceholder={nl ? "Zoek in resultaten…" : "Search within results…"}
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
              {nl ? "Gegenereerd door: " : "Generated by: "} {user?.name || "AIMS"} (
              {formatDateTime(new Date())})
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
                    <th key={col.key} className="py-2 px-2 font-bold text-slate-700">
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

