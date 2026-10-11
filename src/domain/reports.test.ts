import { describe, expect, it } from "vitest";
import {
  REPORT_DEFINITIONS,
  buildReportData,
  exportReportToCsv,
  exportReportToExcel,
} from "./reports";
import type { MockSnapshot } from "../data/contracts";

const testSnapshot = {
  assets: [
    {
      id: "a1",
      code: "KCSDB-30",
      codePrefix: "KCSDB",
      codeNumber: 30,
      name: "Prowise Touchscreen 75",
      category: "Laptops & Digiborden",
      type: "Touchscreen",
      brand: "Prowise",
      model: "ProLine 75",
      serialNumber: "SN-98765",
      location: "KCS OnderBouw",
      department: "Groep 1A",
      assignedTo: "Jan de Vries",
      condition: "Good",
      status: "Available",
      purchaseDate: "2024-01-01",
      warrantyExpiry: "2027-01-01",
      lastUpdated: "2026-01-01",
      maintenanceRequired: false,
      qr: true,
    },
    {
      id: "a2",
      code: "KCSDB-31",
      codePrefix: "KCSDB",
      codeNumber: 31,
      name: "Lenovo ThinkPad L14",
      category: "Laptops & Digiborden",
      type: "Laptop",
      brand: "Lenovo",
      model: "L14 Gen 2",
      serialNumber: "SN-54321",
      location: "KCS OnderBouw",
      department: "Groep 2B",
      assignedTo: "",
      condition: "Poor",
      status: "Under Repair",
      purchaseDate: "2024-01-01",
      warrantyExpiry: "2027-01-01",
      lastUpdated: "2026-01-01",
      maintenanceRequired: true,
      qr: true,
    },
  ],
  inventory: [
    {
      id: "i1",
      code: "KB-01",
      name: "Logitech USB Keyboard",
      itemType: "Accessory",
      category: "Accessories",
      unit: "pcs",
      onHand: 12,
      reserved: 2,
      minimum: 5,
      reorderLevel: 5,
      reorderQuantity: 10,
      warehouse: "Central",
      location: "Storage A",
      createdBy: "admin",
      createdAt: "2026-01-01",
      modifiedBy: "admin",
      lastUpdated: "2026-01-01",
      archived: false,
    },
    {
      id: "i2",
      code: "CBL-01",
      name: "HDMI Cable 2m",
      itemType: "Accessory",
      category: "Accessories",
      unit: "pcs",
      onHand: 3,
      reserved: 0,
      minimum: 10,
      reorderLevel: 10,
      reorderQuantity: 20,
      warehouse: "Central",
      location: "Storage B",
      createdBy: "admin",
      createdAt: "2026-01-01",
      modifiedBy: "admin",
      lastUpdated: "2026-01-01",
      archived: false,
    },
  ],
  assignments: [
    {
      id: "as1",
      reference: "ASG-001",
      assetId: "a1",
      assetCode: "KCSDB-30",
      assetName: "Prowise Touchscreen 75",
      assignee: "Jan de Vries",
      assigneeType: "Employee",
      department: "Groep 1A",
      location: "KCS OnderBouw",
      assignedAt: "2026-02-01",
      assignedBy: "Admin",
      conditionAtIssue: "Good",
      operationalStatusAtIssue: "Operational",
      accessories: [],
      createdBy: "Admin",
      createdAt: "2026-02-01",
      modifiedBy: "Admin",
      lastUpdated: "2026-02-01",
      active: true,
      status: "Active",
      history: [],
    },
  ],
  borrows: [
    {
      id: "b1",
      reference: "BOR-001",
      assetId: "a2",
      assetCode: "KCSDB-31",
      asset: "Lenovo ThinkPad L14",
      borrower: "Klaas Visser",
      department: "Groep 2B",
      borrowDate: "2026-03-01",
      dueDate: "2026-03-10",
      status: "Overdue",
      condition: "Good",
      history: [],
    },
  ],
  repairs: [
    {
      id: "r1",
      reference: "REP-001",
      assetId: "a2",
      assetCode: "KCSDB-31",
      asset: "Lenovo ThinkPad L14",
      issue: "Defective screen panel",
      priority: "Medium",
      technician: "Tech 1",
      received: "2026-03-11",
      due: "2026-03-18",
      status: "Diagnosing",
      reportedAt: "2026-03-11",
      history: [],
    },
  ],
  maintenance: [
    {
      id: "m1",
      asset: "Prowise Touchscreen 75",
      assetCode: "KCSDB-30",
      type: "Semi-annual cleaning & firmware check",
      frequency: "Bi-annual",
      assignee: "Tech Staff",
      status: "Due",
      nextDate: "2026-03-01",
      history: [],
    },
  ],
  movements: [
    {
      id: "mv1",
      reference: "MOV-001",
      asset: "Prowise Touchscreen 75",
      assetCode: "KCSDB-30",
      type: "Transfer",
      from: "Central Depot",
      to: "Groep 1A",
      by: "Admin",
      quantity: 1,
      date: "2026-01-15",
      reason: "Classroom deployment",
    },
  ],
  audits: [
    {
      id: "aud1",
      reference: "AUD-001",
      name: "Q1 OnderBouw Physical Audit",
      scope: "KCS OnderBouw",
      assignee: "Auditor Smith",
      deadline: "2026-03-15",
      progress: 100,
      verified: 10,
      discrepancies: 1,
      status: "Completed",
      history: [],
    },
  ],
  auditDiscrepancies: [],
  correctiveActions: [],
  disposals: [],
  notifications: [],
  activity: [
    {
      id: "act1",
      at: "2026-03-15T10:00:00Z",
      user: "admin@kangoeroeschool.com",
      action: "ASSET_CREATED",
      entityType: "asset",
      entityId: "KCSDB-30",
      result: "Success",
      detail: "Registered new interactive display",
    },
  ],
  assetHistoryEvents: [],
  qrIdentities: [],
  references: [],
  locationTypes: [],
  codeGroups: [],
  reports: [],
} as unknown as MockSnapshot;

describe("AIMS Reporting Engine (Layer 11)", () => {
  it("provides all 12 operational report categories", () => {
    const categories = new Set(REPORT_DEFINITIONS.map((r) => r.category));
    expect(categories.size).toBe(12);
    expect(categories.has("assets")).toBe(true);
    expect(categories.has("inventory")).toBe(true);
    expect(categories.has("locations")).toBe(true);
    expect(categories.has("assignments")).toBe(true);
    expect(categories.has("loans")).toBe(true);
    expect(categories.has("repairs")).toBe(true);
    expect(categories.has("maintenance")).toBe(true);
    expect(categories.has("movements")).toBe(true);
    expect(categories.has("audits")).toBe(true);
    expect(categories.has("audit-logs")).toBe(true);
    expect(categories.has("warehouse")).toBe(true);
    expect(categories.has("devices")).toBe(true);
  });

  it("calculates canonical inventory metrics without hardcoding", () => {
    const report = buildReportData("inventory-status", testSnapshot);
    expect(report.totalRecords).toBe(2); // Available and Under Repair
    const totalMetric = report.metrics.find((m) => m.label.includes("Total Assets"));
    expect(totalMetric?.value).toBe(2);
  });

  it("filters assets report by search query and status", () => {
    const report = buildReportData("assets-master", testSnapshot, {
      search: "ThinkPad",
      status: "Under Repair",
    });
    expect(report.rows.length).toBe(1);
    expect(report.rows[0].code).toBe("KCSDB-31");
  });

  it("builds location hierarchy report correctly", () => {
    const report = buildReportData("location-hierarchy", testSnapshot);
    expect(report.rows.length).toBe(2);
    expect(report.rows[0].location).toBe("KCS OnderBouw");
  });

  it("exports valid CSV formatted with UTF-8 BOM", () => {
    const report = buildReportData("assets-master", testSnapshot);
    const csv = exportReportToCsv(report, "en");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Inventory Code","Asset Name"');
    expect(csv).toContain('"KCSDB-30"');
  });

  it("exports valid XLSX workbook binary array", () => {
    const report = buildReportData("assets-master", testSnapshot);
    const buffer = exportReportToExcel(report, "en");
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(100);
  });
});
