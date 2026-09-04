import { describe, expect, it } from "vitest";
import {
  assetsForDepartment,
  departmentActivityFeed,
  departmentAssetSummary,
  departmentHistoryEvents,
  departmentLocationLabel,
  departmentMovements,
  inventoryForDepartment,
  isIctCategory,
} from "./departmentIntelligence";
import type { Asset, Movement } from "./types";
import type {
  AssetHistoryEvent,
  InventoryItem,
  ReferenceRecord,
} from "../data/contracts";

const asset = (overrides: Partial<Asset>): Asset => ({
  id: "a1",
  code: "KCSMD-001",
  codePrefix: "KCSMD",
  codeNumber: 1,
  name: "Laptop",
  category: "Laptops",
  type: "Device",
  brand: "Dell",
  model: "X",
  serialNumber: "SN1",
  location: "Group 1A",
  department: "Group 1A",
  status: "Available",
  condition: "Good",
  purchaseDate: "2024-01-01",
  warrantyExpiry: "2028-01-01",
  lastUpdated: "2026-01-01",
  qr: false,
  ...overrides,
});

const categoryRef = (name: string, type: string): ReferenceRecord => ({
  id: `cat-${name}`,
  kind: "category",
  name,
  type,
  status: "Active",
  relatedCount: 0,
  details: {},
});

const locationRef = (
  id: string,
  name: string,
  parentLocationId?: string | null,
): ReferenceRecord => ({
  id,
  kind: "location",
  name,
  type: "Room",
  status: "Active",
  relatedCount: 0,
  parentLocationId: parentLocationId ?? null,
  details: {},
});

const deptRef = (
  name: string,
  mainLocationId?: string | null,
): ReferenceRecord => ({
  id: `dept-${name}`,
  kind: "department",
  name,
  type: "Department",
  status: "Active",
  relatedCount: 0,
  mainLocationId: mainLocationId ?? null,
  details: {},
});

describe("assetsForDepartment / inventoryForDepartment", () => {
  it("matches on the department name, since Asset.department is a plain string not a foreign key", () => {
    const assets = [
      asset({ id: "a1", department: "Group 1A" }),
      asset({ id: "a2", department: "Group 2B" }),
    ];
    expect(assetsForDepartment(assets, "Group 1A").map((a) => a.id)).toEqual([
      "a1",
    ]);
  });

  it("excludes archived inventory lines", () => {
    const inventory: InventoryItem[] = [
      {
        id: "i1",
        code: "INV-1",
        name: "Toner",
        itemType: "Consumable",
        category: "Consumables",
        unit: "box",
        onHand: 3,
        reserved: 0,
        minimum: 1,
        reorderLevel: 1,
        reorderQuantity: 1,
        warehouse: "Main",
        location: "Group 1A",
        department: "Group 1A",
        createdBy: "x",
        createdAt: "2026-01-01",
        modifiedBy: "x",
        lastUpdated: "2026-01-01",
        archived: false,
      },
      {
        id: "i2",
        code: "INV-2",
        name: "Old toner",
        itemType: "Consumable",
        category: "Consumables",
        unit: "box",
        onHand: 0,
        reserved: 0,
        minimum: 1,
        reorderLevel: 1,
        reorderQuantity: 1,
        warehouse: "Main",
        location: "Group 1A",
        department: "Group 1A",
        createdBy: "x",
        createdAt: "2026-01-01",
        modifiedBy: "x",
        lastUpdated: "2026-01-01",
        archived: true,
      },
    ];
    expect(
      inventoryForDepartment(inventory, "Group 1A").map((i) => i.id),
    ).toEqual(["i1"]);
  });
});

describe("isIctCategory", () => {
  it("reads the category's own type field (Serialized vs Quantity-based)", () => {
    const references = [
      categoryRef("Laptops", "Serialized"),
      categoryRef("Consumables", "Quantity-based"),
    ];
    expect(isIctCategory("Laptops", references)).toBe(true);
    expect(isIctCategory("Consumables", references)).toBe(false);
  });

  it("defaults to ICT when the category has no matching reference record", () => {
    expect(isIctCategory("Unknown category", [])).toBe(true);
  });
});

describe("departmentAssetSummary", () => {
  it("computes every KPI from the current asset list — nothing hard-coded", () => {
    const references = [
      categoryRef("Laptops", "Serialized"),
      categoryRef("Consumables", "Quantity-based"),
    ];
    const assets = [
      asset({ id: "a1", status: "Available", category: "Laptops" }),
      asset({ id: "a2", status: "Assigned", category: "Laptops" }),
      asset({ id: "a3", status: "Under Repair", category: "Laptops" }),
      asset({ id: "a4", status: "Disposed", category: "Laptops" }),
      asset({ id: "a5", status: "Available", category: "Consumables" }),
    ];
    expect(departmentAssetSummary(assets, references)).toEqual({
      total: 5,
      ict: 4,
      active: 4,
      assigned: 1,
      maintenance: 1,
      disposed: 1,
    });
  });

  it("returns all zeros for a department with no assets (empty state input)", () => {
    expect(departmentAssetSummary([], [])).toEqual({
      total: 0,
      ict: 0,
      active: 0,
      assigned: 0,
      maintenance: 0,
      disposed: 0,
    });
  });
});

describe("departmentMovements", () => {
  const movement = (overrides: Partial<Movement>): Movement => ({
    id: "m1",
    reference: "TRF-1",
    type: "Asset movement",
    asset: "Laptop",
    assetCode: "KCSMD-001",
    from: "Group 1A",
    to: "Group 2B",
    by: "Naomi Williams",
    date: "2026-09-01",
    quantity: 1,
    ...overrides,
  });

  it("matches on either end of the transaction and sorts most-recent-first", () => {
    const movements = [
      movement({
        id: "m1",
        date: "2026-09-01",
        sourceDepartment: "Group 1A",
        destinationDepartment: "Group 2B",
      }),
      movement({
        id: "m2",
        date: "2026-09-04",
        sourceDepartment: "Central Storage",
        destinationDepartment: "Group 1A",
      }),
      movement({
        id: "m3",
        date: "2026-08-01",
        sourceDepartment: "Library",
        destinationDepartment: "Facilities",
      }),
    ];
    expect(departmentMovements(movements, "Group 1A").map((m) => m.id)).toEqual([
      "m2",
      "m1",
    ]);
  });
});

describe("departmentHistoryEvents", () => {
  const event = (overrides: Partial<AssetHistoryEvent>): AssetHistoryEvent => ({
    id: "e1",
    assetId: "a1",
    assetCode: "KCSMD-001",
    eventType: "transfer",
    category: "movement",
    title: "Transferred",
    description: "",
    sourceModule: "assets",
    source: "system",
    createdAt: "2026-09-01T00:00:00.000Z",
    occurredAt: "2026-09-01T00:00:00.000Z",
    createdBy: "system",
    isLegacyImport: false,
    isManual: false,
    status: "Final",
    version: 1,
    ...overrides,
  });

  it("matches events whose previous or next snapshot names this department", () => {
    const events = [
      event({
        id: "e1",
        previous: { department: "Group 1A" },
        next: { department: "Group 2B" },
      }),
      event({ id: "e2", previous: { department: "Library" }, next: { department: "Library" } }),
    ];
    expect(departmentHistoryEvents(events, "Group 2B").map((e) => e.id)).toEqual(["e1"]);
    expect(departmentHistoryEvents(events, "Group 1A").map((e) => e.id)).toEqual(["e1"]);
    expect(departmentHistoryEvents(events, "Library").map((e) => e.id)).toEqual(["e2"]);
  });
});

describe("departmentActivityFeed", () => {
  it("merges movements and history events into one recency-sorted feed and respects the limit", () => {
    const movements: Movement[] = [
      {
        id: "m1",
        reference: "TRF-1",
        type: "Asset movement",
        asset: "Laptop",
        assetCode: "KCSMD-001",
        from: "Group 1A",
        to: "Group 2B",
        by: "Naomi Williams",
        date: "2026-09-04T10:00:00.000Z",
        quantity: 1,
        sourceDepartment: "Group 1A",
        destinationDepartment: "Group 2B",
      },
    ];
    const events: AssetHistoryEvent[] = [
      {
        id: "e1",
        assetId: "a1",
        assetCode: "KCSMD-001",
        eventType: "status_change",
        category: "status",
        title: "Status changed",
        description: "",
        previous: { department: "Group 2B", status: "Available" },
        next: { department: "Group 2B", status: "Under Repair" },
        sourceModule: "assets",
        source: "system",
        createdAt: "2026-09-03T10:00:00.000Z",
        occurredAt: "2026-09-03T10:00:00.000Z",
        createdBy: "system",
        isLegacyImport: false,
        isManual: false,
        status: "Final",
        version: 1,
      },
    ];
    const feed = departmentActivityFeed(movements, events, "Group 2B");
    expect(feed.map((item) => item.kind)).toEqual(["movement", "history"]);
    expect(departmentActivityFeed(movements, events, "Group 2B", 1)).toHaveLength(1);
  });

  it("returns an empty feed when there is no activity (empty state input)", () => {
    expect(departmentActivityFeed([], [], "Group 1A")).toEqual([]);
  });
});

describe("departmentLocationLabel", () => {
  it("splits the location path into a main location and a joined sub-location", () => {
    const references = [
      locationRef("loc-main", "Main Building", null),
      locationRef("loc-sub", "Room 2B", "loc-main"),
    ];
    const department = deptRef("Group 2B", "loc-sub");
    expect(departmentLocationLabel(references, department)).toEqual({
      location: "Main Building",
      subLocation: "Room 2B",
    });
  });

  it("returns empty strings when the department has no main location (empty state input)", () => {
    const department = deptRef("Unassigned", null);
    expect(departmentLocationLabel([], department)).toEqual({
      location: "",
      subLocation: "",
    });
  });
});
