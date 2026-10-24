import * as XLSX from "xlsx";
import type { MockSnapshot } from "../data/contracts";

export type ReportCategory =
  | "assets"
  | "inventory"
  | "locations"
  | "assignments"
  | "loans"
  | "repairs"
  | "maintenance"
  | "movements"
  | "audits"
  | "audit-logs"
  | "warehouse"
  | "devices";

export interface ReportConfig {
  id: string;
  category: ReportCategory;
  name: string;
  nameNl: string;
  description: string;
  descriptionNl: string;
}

export const REPORT_DEFINITIONS: ReportConfig[] = [
  {
    id: "assets-master",
    category: "assets",
    name: "Asset Master Register",
    nameNl: "Middelen Hoofdregister",
    description: "Complete asset inventory with codes, categories, status, and assignees.",
    descriptionNl: "Volledige inventaris van bedrijfsmiddelen met codes, categorieën, status en toewijzingen.",
  },
  {
    id: "inventory-status",
    category: "inventory",
    name: "Inventory Status & Lifecycle Summary",
    nameNl: "Voorraadstatus & Levenscyclus Overzicht",
    description: "Aggregated counts of assets across all lifecycle and operational states.",
    descriptionNl: "Geaggregeerde aantallen middelen over alle operationele statussen.",
  },
  {
    id: "location-hierarchy",
    category: "locations",
    name: "Location & Department Asset Distribution",
    nameNl: "Locatie- en Afdelingsverdeling",
    description: "Hierarchical breakdown of assets grouped by main location and department.",
    descriptionNl: "Hiërarchisch overzicht van middelen per hoofdlocatie en afdeling.",
  },
  {
    id: "assignments-active",
    category: "assignments",
    name: "Active Assignments & Custodians",
    nameNl: "Actieve Toewijzingen & Beheerders",
    description: "Currently assigned assets, custodians, departments, and assignment dates.",
    descriptionNl: "Momenteel toegewezen middelen, gebruikers, afdelingen en uitgiftedata.",
  },
  {
    id: "loans-overdue",
    category: "loans",
    name: "Loan Records & Overdue Tracking",
    nameNl: "Uitleenoverzicht & Vervalstatussen",
    description: "Temporary equipment loans, expected return dates, and overdue status.",
    descriptionNl: "Tijdelijke uitleningen van apparatuur, verwachte inleverdata en te late items.",
  },
  {
    id: "repairs-history",
    category: "repairs",
    name: "Repairs & Fault Resolutions",
    nameNl: "Reparaties & Foutafhandeling",
    description: "Reported hardware and equipment faults, repair status, costs, and technicians.",
    descriptionNl: "Gemelde defecten, reparatiestatus, kosten en betrokken technici.",
  },
  {
    id: "maintenance-schedule",
    category: "maintenance",
    name: "Maintenance & Inspection Log",
    nameNl: "Onderhoud & Periodieke Inspecties",
    description: "Scheduled and completed periodic maintenance records with upcoming due dates.",
    descriptionNl: "Gepland en voltooid periodiek onderhoud met aankomende termijnen.",
  },
  {
    id: "movements-audit",
    category: "movements",
    name: "Inventory Movements & Relocations",
    nameNl: "Voorraadmutaties & Verplaatsingen",
    description: "Complete trail of asset transfers, physical movements, and operators.",
    descriptionNl: "Volledig historisch overzicht van fysieke verplaatsingen en overdrachten.",
  },
  {
    id: "audits-discrepancies",
    category: "audits",
    name: "Inventory Controls & Discrepancy Audits",
    nameNl: "Inventariscontroles & Afwijkingen",
    description: "Results of physical counting audits, verified vs missing assets, and corrections.",
    descriptionNl: "Resultaten van fysieke tellingen, geverifieerde vs vermiste middelen en correcties.",
  },
  {
    id: "audit-trail-security",
    category: "audit-logs",
    name: "System Security & Audit Activity Trail",
    nameNl: "Systeemactiviteit & Beveiligingsaudittrail",
    description: "Immutable log of user actions, module operations, entities, and execution outcomes.",
    descriptionNl: "Onveranderlijk logboek van gebruikersacties, bewerkingen en systeemresultaten.",
  },
  {
    id: "warehouse-stock",
    category: "warehouse",
    name: "Warehouse Stock Levels & Reorder Points",
    nameNl: "Magazijnvoorraad & Bestelniveaus",
    description: "Warehouse stock items, on-hand balances, reserved units, and reorder thresholds.",
    descriptionNl: "Magazijnartikelen, actuele voorraad, reserveringen en minimumdrempels.",
  },
  {
    id: "devices-managed",
    category: "devices",
    name: "Managed Device Register & Telemetry",
    nameNl: "Beheerde Apparaten & Telemetrie",
    description: "ICT devices connected to asset records with health status and compliance.",
    descriptionNl: "ICT-apparaten gekoppeld aan middelen met gezondheidsstatus en beleidsnaleving.",
  },
];

export interface ReportFilterOptions {
  search?: string;
  category?: string;
  status?: string;
  location?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
}

export interface GeneratedReport {
  config: ReportConfig;
  generatedAt: string;
  generatedBy: string;
  totalRecords: number;
  columns: { key: string; label: string; labelNl: string }[];
  rows: Record<string, any>[];
  metrics: { label: string; labelNl: string; value: string | number }[];
}

export function buildReportData(
  reportId: string,
  snapshot: MockSnapshot,
  filters: ReportFilterOptions = {},
  userName = "AIMS User",
): GeneratedReport {
  const config =
    REPORT_DEFINITIONS.find((r) => r.id === reportId) || REPORT_DEFINITIONS[0];
  const now = new Date().toISOString();
  const searchLower = (filters.search || "").toLowerCase().trim();

  let columns: { key: string; label: string; labelNl: string }[] = [];
  let rows: Record<string, any>[] = [];
  let metrics: { label: string; labelNl: string; value: string | number }[] = [];

  switch (config.category) {
    case "assets": {
      columns = [
        { key: "code", label: "Inventory Code", labelNl: "Inventariscode" },
        { key: "name", label: "Asset Name", labelNl: "Middelnaam" },
        { key: "category", label: "Category", labelNl: "Categorie" },
        { key: "brandModel", label: "Brand / Model", labelNl: "Merk / Model" },
        { key: "serialNumber", label: "Serial Number", labelNl: "Serienummer" },
        { key: "location", label: "Location", labelNl: "Locatie" },
        { key: "department", label: "Department", labelNl: "Afdeling" },
        { key: "assignedTo", label: "Assigned To", labelNl: "Toegewezen aan" },
        { key: "condition", label: "Condition", labelNl: "Conditie" },
        { key: "status", label: "Status", labelNl: "Status" },
      ];

      rows = snapshot.assets
        .filter((a) => {
          if (filters.category && a.category !== filters.category) return false;
          if (filters.status && a.status !== filters.status) return false;
          if (filters.location && a.location !== filters.location) return false;
          if (filters.department && a.department !== filters.department) return false;
          if (searchLower) {
            const hit =
              (a.code || "").toLowerCase().includes(searchLower) ||
              (a.name || "").toLowerCase().includes(searchLower) ||
              (a.serialNumber || "").toLowerCase().includes(searchLower) ||
              (a.assignedTo || "").toLowerCase().includes(searchLower);
            if (!hit) return false;
          }
          return true;
        })
        .map((a) => ({
          code: a.code,
          name: a.name,
          category: a.category,
          brandModel: `${a.brand || ""} ${a.model || ""}`.trim() || "—",
          serialNumber: a.serialNumber || "—",
          location: a.location || "—",
          department: a.department || "—",
          assignedTo: a.assignedTo || "—",
          condition: a.condition,
          status: a.status,
        }));

      metrics = [
        { label: "Total Filtered Assets", labelNl: "Totaal Gefilterde Middelen", value: rows.length },
        {
          label: "Available",
          labelNl: "Beschikbaar",
          value: rows.filter((r) => r.status === "Available").length,
        },
        {
          label: "In Repair",
          labelNl: "In Reparatie",
          value: rows.filter((r) => r.status === "Under Repair").length,
        },
      ];
      break;
    }

    case "inventory": {
      const statusCounts: Record<string, number> = {};
      snapshot.assets.forEach((a) => {
        statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
      });

      columns = [
        { key: "status", label: "Lifecycle Status", labelNl: "Levenscyclusstatus" },
        { key: "count", label: "Asset Count", labelNl: "Aantal Middelen" },
        { key: "percentage", label: "Share (%)", labelNl: "Aandeel (%)" },
      ];

      const totalAssets = snapshot.assets.length || 1;
      rows = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: `${Math.round((count / totalAssets) * 100)}%`,
      }));

      metrics = [
        { label: "Canonical Total Assets", labelNl: "Canoniek Totaal Middelen", value: snapshot.assets.length },
        { label: "Available Assets", labelNl: "Beschikbare Middelen", value: statusCounts["Available"] || 0 },
        { label: "Assigned Assets", labelNl: "Toegewezen Middelen", value: statusCounts["Assigned"] || 0 },
        { label: "Borrowed Assets", labelNl: "Uitgeleende Middelen", value: statusCounts["Borrowed"] || 0 },
        { label: "Under Repair", labelNl: "Onder Reparatie", value: statusCounts["Under Repair"] || 0 },
        { label: "Under Maintenance", labelNl: "Onder Onderhoud", value: statusCounts["Under Maintenance"] || 0 },
      ];
      break;
    }

    case "locations": {
      columns = [
        { key: "location", label: "Main Location", labelNl: "Hoofdlocatie" },
        { key: "department", label: "Department / Room", labelNl: "Afdeling / Ruimte" },
        { key: "code", label: "Asset Code", labelNl: "Middelcode" },
        { key: "name", label: "Asset Name", labelNl: "Middelnaam" },
        { key: "category", label: "Category", labelNl: "Categorie" },
        { key: "status", label: "Status", labelNl: "Status" },
      ];

      rows = snapshot.assets
        .filter((a) => {
          if (filters.location && a.location !== filters.location) return false;
          if (filters.department && a.department !== filters.department) return false;
          if (searchLower) {
            return (
              (a.location || "").toLowerCase().includes(searchLower) ||
              (a.department || "").toLowerCase().includes(searchLower) ||
              (a.code || "").toLowerCase().includes(searchLower)
            );
          }
          return true;
        })
        .map((a) => ({
          location: a.location || "Onbekend",
          department: a.department || "Algemeen",
          code: a.code,
          name: a.name,
          category: a.category,
          status: a.status,
        }))
        .sort((a, b) => a.location.localeCompare(b.location) || a.department.localeCompare(b.department));

      metrics = [
        { label: "Assets Listed", labelNl: "Opgenomen Middelen", value: rows.length },
        {
          label: "Unique Locations",
          labelNl: "Unieke Locaties",
          value: new Set(rows.map((r) => r.location)).size,
        },
      ];
      break;
    }

    case "assignments": {
      columns = [
        { key: "assignee", label: "Assigned User", labelNl: "Toegewezen Gebruiker" },
        { key: "department", label: "Department", labelNl: "Afdeling" },
        { key: "assetCode", label: "Asset Code", labelNl: "Middelcode" },
        { key: "assetName", label: "Asset Name", labelNl: "Middelnaam" },
        { key: "date", label: "Assignment Date", labelNl: "Toewijzingsdatum" },
        { key: "status", label: "Status", labelNl: "Status" },
      ];

      rows = (snapshot.assignments || [])
        .filter((asgn) => {
          if (filters.department && asgn.department !== filters.department) return false;
          if (searchLower) {
            return (
              (asgn.assignee || "").toLowerCase().includes(searchLower) ||
              (asgn.assetCode || "").toLowerCase().includes(searchLower) ||
              (asgn.assetName || "").toLowerCase().includes(searchLower)
            );
          }
          return true;
        })
        .map((asgn) => ({
          assignee: asgn.assignee,
          department: asgn.department || "—",
          assetCode: asgn.assetCode,
          assetName: asgn.assetName,
          date: asgn.assignedAt || "—",
          status: asgn.status || "Active",
        }));

      metrics = [
        { label: "Active Assignments", labelNl: "Actieve Toewijzingen", value: rows.length },
        {
          label: "Assigned Users",
          labelNl: "Aantal Gebruikers",
          value: new Set(rows.map((r) => r.assignee)).size,
        },
      ];
      break;
    }

    case "loans": {
      columns = [
        { key: "borrower", label: "Borrower", labelNl: "Lener" },
        { key: "assetCode", label: "Asset Code", labelNl: "Middelcode" },
        { key: "assetName", label: "Asset Name", labelNl: "Middelnaam" },
        { key: "borrowDate", label: "Loan Date", labelNl: "Uitleendatum" },
        { key: "expectedReturn", label: "Expected Return", labelNl: "Verwachte Terugkeer" },
        { key: "status", label: "Status", labelNl: "Status" },
        { key: "condition", label: "Condition", labelNl: "Conditie" },
      ];

      rows = (snapshot.borrows || [])
        .filter((b) => {
          if (searchLower) {
            return (
              (b.borrower || "").toLowerCase().includes(searchLower) ||
              (b.assetCode || "").toLowerCase().includes(searchLower) ||
              (b.asset || "").toLowerCase().includes(searchLower)
            );
          }
          return true;
        })
        .map((b) => ({
          borrower: b.borrower,
          assetCode: b.assetCode,
          assetName: b.asset,
          borrowDate: b.borrowDate || "—",
          expectedReturn: b.dueDate || "—",
          status: b.status,
          condition: b.condition || "Good",
        }));

      const overdueCount = rows.filter((r) => r.status === "Overdue").length;
      metrics = [
        { label: "Total Loans", labelNl: "Totaal Uitleningen", value: rows.length },
        { label: "Overdue Loans", labelNl: "Te Late Uitleningen", value: overdueCount },
      ];
      break;
    }

    case "repairs": {
      columns = [
        { key: "reference", label: "Repair Ref", labelNl: "Reparatieref" },
        { key: "assetCode", label: "Asset Code", labelNl: "Middelcode" },
        { key: "assetName", label: "Asset Name", labelNl: "Middelnaam" },
        { key: "issue", label: "Issue / Defect", labelNl: "Probleem / Defect" },
        { key: "status", label: "Repair Status", labelNl: "Reparatiestatus" },
        { key: "technician", label: "Technician", labelNl: "Technicus" },
        { key: "cost", label: "Cost (SRD/USD)", labelNl: "Kosten" },
        { key: "reportedAt", label: "Reported Date", labelNl: "Meldingsdatum" },
      ];

      rows = (snapshot.repairs || [])
        .filter((r) => {
          if (searchLower) {
            return (
              (r.reference || "").toLowerCase().includes(searchLower) ||
              (r.assetCode || "").toLowerCase().includes(searchLower) ||
              (r.issue || "").toLowerCase().includes(searchLower)
            );
          }
          return true;
        })
        .map((r) => {
          const costVal = r.actualCost != null ? `$${r.actualCost}` : r.estimatedCost != null ? `~$${r.estimatedCost}` : "—";
          return {
            reference: r.reference || r.id,
            assetCode: r.assetCode,
            assetName: r.assetName || r.asset || "—",
            issue: r.issue,
            status: r.status,
            technician: r.technician || "—",
            cost: costVal,
            reportedAt: r.reportedAt || "—",
          };
        });

      metrics = [
        { label: "Total Repairs Logged", labelNl: "Totaal Geregistreerde Reparaties", value: rows.length },
        {
          label: "In Progress / Open",
          labelNl: "In Behandeling / Open",
          value: rows.filter((r) => (r.status as string) !== "Completed" && (r.status as string) !== "Closed").length,
        },
      ];
      break;
    }

    case "maintenance": {
      columns = [
        { key: "assetCode", label: "Asset Code", labelNl: "Middelcode" },
        { key: "title", label: "Maintenance Task", labelNl: "Onderhoudstaak" },
        { key: "frequency", label: "Recurrence", labelNl: "Periodiciteit" },
        { key: "technician", label: "Technician", labelNl: "Technicus" },
        { key: "lastDate", label: "Last Performed", labelNl: "Laatst Uitgevoerd" },
        { key: "nextDate", label: "Next Due Date", labelNl: "Volgende Termijn" },
        { key: "status", label: "Status", labelNl: "Status" },
      ];

      rows = (snapshot.maintenance || [])
        .filter((m) => {
          if (searchLower) {
            return (
              (m.assetCode || "").toLowerCase().includes(searchLower) ||
              (m.type || "").toLowerCase().includes(searchLower)
            );
          }
          return true;
        })
        .map((m) => ({
          assetCode: m.assetCode,
          title: m.type,
          frequency: m.frequency || "Periodic",
          technician: m.assignee || "—",
          lastDate: m.lastCompletedAt || m.startDate || "—",
          nextDate: m.nextDate || "—",
          status: m.status,
        }));

      metrics = [
        { label: "Total Tasks", labelNl: "Totaal Taken", value: rows.length },
        {
          label: "Due / Overdue",
          labelNl: "Vervallen / Gepland",
          value: rows.filter((r) => r.status === "Due" || r.status === "Overdue").length,
        },
      ];
      break;
    }

    case "movements": {
      columns = [
        { key: "date", label: "Date / Time", labelNl: "Datum / Tijd" },
        { key: "assetCode", label: "Asset Code", labelNl: "Middelcode" },
        { key: "type", label: "Movement Type", labelNl: "Mutatietype" },
        { key: "from", label: "From Location", labelNl: "Van Locatie" },
        { key: "to", label: "To Location", labelNl: "Naar Locatie" },
        { key: "operator", label: "Operator", labelNl: "Uitvoerder" },
        { key: "reason", label: "Reason / Reference", labelNl: "Reden / Referentie" },
      ];

      rows = (snapshot.movements || [])
        .filter((mv) => {
          if (searchLower) {
            return (
              (mv.assetCode || "").toLowerCase().includes(searchLower) ||
              (mv.type || "").toLowerCase().includes(searchLower) ||
              (mv.by || "").toLowerCase().includes(searchLower)
            );
          }
          return true;
        })
        .map((mv) => ({
          date: mv.date || "—",
          assetCode: mv.assetCode,
          type: mv.type,
          from: mv.from || "—",
          to: mv.to || "—",
          operator: mv.by || (mv as any).operator || "—",
          reason: mv.reason || "—",
        }));

      metrics = [
        { label: "Total Movements Logged", labelNl: "Totaal Geregistreerde Mutaties", value: rows.length },
      ];
      break;
    }

    case "audits": {
      columns = [
        { key: "auditId", label: "Audit Ref", labelNl: "Auditreferentie" },
        { key: "name", label: "Audit Name", labelNl: "Auditnaam" },
        { key: "location", label: "Audited Location", labelNl: "Gecontroleerde Locatie" },
        { key: "auditor", label: "Auditor", labelNl: "Auditor" },
        { key: "progress", label: "Progress", labelNl: "Voortgang" },
        { key: "discrepancies", label: "Discrepancies", labelNl: "Afwijkingen" },
        { key: "status", label: "Status", labelNl: "Status" },
      ];

      rows = (snapshot.audits || [])
        .filter((ad) => {
          if (searchLower) {
            return (
              (ad.name || "").toLowerCase().includes(searchLower) ||
              (ad.scope || "").toLowerCase().includes(searchLower) ||
              (ad.assignee || "").toLowerCase().includes(searchLower)
            );
          }
          return true;
        })
        .map((ad) => ({
          auditId: ad.id,
          name: ad.name,
          location: ad.scope || "—",
          auditor: ad.assignee || "—",
          progress: `${ad.progress || 0}%`,
          discrepancies: ad.discrepancies || 0,
          status: ad.status || "Completed",
        }));

      const totalDiscrepancies = rows.reduce((s, r) => s + (Number(r.discrepancies) || 0), 0);
      metrics = [
        { label: "Audits Performed", labelNl: "Uitgevoerde Audits", value: rows.length },
        { label: "Total Discrepancies", labelNl: "Totaal Afwijkingen", value: totalDiscrepancies },
      ];
      break;
    }

    case "audit-logs": {
      columns = [
        { key: "at", label: "Timestamp", labelNl: "Tijdstip" },
        { key: "user", label: "User", labelNl: "Gebruiker" },
        { key: "action", label: "Action", labelNl: "Handeling" },
        { key: "entity", label: "Entity Target", labelNl: "Doelrecord" },
        { key: "result", label: "Outcome", labelNl: "Resultaat" },
        { key: "detail", label: "Audit Detail", labelNl: "Auditdetail" },
      ];

      rows = (snapshot.activity || [])
        .filter((act) => {
          if (searchLower) {
            return (
              (act.user || "").toLowerCase().includes(searchLower) ||
              (act.action || "").toLowerCase().includes(searchLower) ||
              (act.entityId || "").toLowerCase().includes(searchLower)
            );
          }
          return true;
        })
        .map((act) => ({
          at: act.at,
          user: act.user,
          action: act.event || act.action,
          entity: `${act.entityType || ""} · ${act.entityId || ""}`.trim(),
          result: act.result,
          detail: act.detail || "—",
        }));

      metrics = [
        { label: "Recorded Events", labelNl: "Geregistreerde Gebeurtenissen", value: rows.length },
      ];
      break;
    }

    case "warehouse": {
      columns = [
        { key: "code", label: "Item Code", labelNl: "Artikelcode" },
        { key: "name", label: "Item Name", labelNl: "Artikelnaam" },
        { key: "category", label: "Category", labelNl: "Categorie" },
        { key: "onHand", label: "On Hand", labelNl: "Op Voorraad" },
        { key: "reserved", label: "Reserved", labelNl: "Gereserveerd" },
        { key: "minimum", label: "Min Stock", labelNl: "Min. Voorraad" },
        { key: "reorderLevel", label: "Reorder Threshold", labelNl: "Bestelniveau" },
        { key: "unit", label: "Unit", labelNl: "Eenheid" },
        { key: "status", label: "Stock Status", labelNl: "Voorraadstatus" },
      ];

      rows = (snapshot.inventory || [])
        .filter((inv) => {
          if (searchLower) {
            return (
              (inv.code || "").toLowerCase().includes(searchLower) ||
              (inv.name || "").toLowerCase().includes(searchLower)
            );
          }
          return true;
        })
        .map((inv) => {
          const available = inv.onHand - inv.reserved;
          const status = available < inv.minimum ? "Low Stock" : "In Stock";
          return {
            code: inv.code,
            name: inv.name,
            category: inv.category,
            onHand: inv.onHand,
            reserved: inv.reserved,
            minimum: inv.minimum,
            reorderLevel: inv.reorderLevel,
            unit: inv.unit || "pcs",
            status,
          };
        });

      metrics = [
        { label: "Warehouse SKUs", labelNl: "Magazijnartikelen", value: rows.length },
        {
          label: "Below Min. Stock",
          labelNl: "Onder Minimum",
          value: rows.filter((r) => r.status === "Low Stock").length,
        },
      ];
      break;
    }

    case "devices": {
      columns = [
        { key: "code", label: "Asset Code", labelNl: "Middelcode" },
        { key: "name", label: "Device Name", labelNl: "Apparaatnaam" },
        { key: "type", label: "Category", labelNl: "Categorie" },
        { key: "serial", label: "Serial", labelNl: "Serienummer" },
        { key: "assignedTo", label: "Assigned To", labelNl: "Toegewezen aan" },
        { key: "location", label: "Location", labelNl: "Locatie" },
        { key: "health", label: "Health Score", labelNl: "Gezondheidsscore" },
        { key: "status", label: "Status", labelNl: "Status" },
      ];

      // Derived strictly from canonical asset records matching ICT hardware
      rows = snapshot.assets
        .filter((a) => {
          const cat = (a.category || "").toLowerCase();
          return (
            cat.includes("laptop") ||
            cat.includes("digibord") ||
            cat.includes("computer") ||
            cat.includes("device") ||
            cat.includes("prowise")
          );
        })
        .map((a) => ({
          code: a.code,
          name: a.name,
          type: a.category,
          serial: a.serialNumber || "—",
          assignedTo: a.assignedTo || "—",
          location: a.location || "—",
          health: a.condition === "Excellent" || a.condition === "Good" ? "Healthy (95/100)" : "Attention (65/100)",
          status: a.status,
        }));

      metrics = [
        { label: "Identified Managed Devices", labelNl: "Geïdentificeerde Apparaten", value: rows.length },
      ];
      break;
    }
  }

  return {
    config,
    generatedAt: now,
    generatedBy: userName,
    totalRecords: rows.length,
    columns,
    rows,
    metrics,
  };
}

export function exportReportToCsv(report: GeneratedReport, language: "en" | "nl" = "nl"): string {
  const isNl = language === "nl";
  const header = report.columns.map((col) => (isNl ? col.labelNl : col.label));
  const keys = report.columns.map((col) => col.key);

  const escapeCell = (val: any) => {
    const s = String(val ?? "").replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines = [
    header.map(escapeCell).join(","),
    ...report.rows.map((row) => keys.map((k) => escapeCell(row[k])).join(",")),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

export function exportReportToExcel(report: GeneratedReport, language: "en" | "nl" = "nl"): Uint8Array {
  const isNl = language === "nl";
  const header = report.columns.map((col) => (isNl ? col.labelNl : col.label));
  const keys = report.columns.map((col) => col.key);

  const dataRows = report.rows.map((row) => {
    const obj: Record<string, any> = {};
    keys.forEach((k, idx) => {
      obj[header[idx]] = row[k];
    });
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(dataRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, report.config.name.slice(0, 31));

  const raw = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Uint8Array(raw);
}

export function downloadFile(content: BlobPart | Uint8Array, fileName: string, mimeType: string) {
  const blob = new Blob([content as unknown as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
