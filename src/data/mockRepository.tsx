import type { ReactNode } from "react";
import { useApp } from "../context/AppContext";
import type {
  Asset,
  AssetStatus,
  Audit,
  AuditDiscrepancy,
  BorrowRecord,
  CorrectiveAction,
  Maintenance,
  Movement,
  Repair,
} from "../domain/types";
import { compareAssetCodes, normalizeAssetCode } from "../domain/assetCode";
import {
  assets as seedAssets,
  audits as seedAudits,
  borrows as seedBorrows,
  maintenance as seedMaintenance,
  movements as seedMovements,
  notifications as seedNotifications,
  repairs as seedRepairs,
} from "./mock";
import type {
  ActivityRecord,
  AssetHistoryEvent,
  Assignment,
  CodeGroup,
  Disposal,
  InventoryItem,
  InventoryMovement,
  InventoryRepository,
  LocationType,
  MockSnapshot,
  ReferenceRecord,
  ReportDefinition,
  ReportResult,
  RoleRecord,
  ScheduledReport,
  StockReservation,
  SystemUser,
  WorkflowCommand,
  WorkflowResult,
} from "./contracts";
import { executeListQuery, type ListQuery } from "./listQuery";
import {
  assignmentEligible,
  auditCompletionEligible,
  auditProgress,
  availableStock,
  borrowEligible,
  canTransitionAssignment,
  canTransitionAudit,
  canTransitionBorrow,
  canTransitionCorrectiveAction,
  canTransitionMaintenance,
  canTransitionRepair,
  deterministicAuditSelection,
  discrepancySeverity,
  fulfillReservation,
  nextScheduledRun,
  notificationKey,
  releaseStock,
  reserveStock,
  validDateRange,
  validMaintenanceSchedule,
  validMovement,
  validateLocationMove,
} from "../domain/rules";
import { mappedCondition } from "../domain/assetStatus";
import { RepositoryProvider } from "./repositoryContext";

const clone = <T,>(value: T): T => structuredClone(value);
const enforceMappedCondition = <T extends Record<string, unknown>>(
  values: T,
) => {
  const condition = mappedCondition(String(values.status || ""));
  return condition ? { ...values, condition } : values;
};
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const id = (prefix: string, count: number) =>
  `${prefix}-${String(count + 1).padStart(4, "0")}`;

const inventorySeeds: InventoryItem[] = [
  {
    id: "inv-1",
    code: "INV-CAB-001",
    barcode: "871000001",
    name: "CAT6 network cable",
    description: "Blue 2 metre patch cable",
    itemType: "Consumable",
    category: "Consumables",
    subcategory: "Cables",
    brand: "D-Link",
    model: "CAT6-2M",
    supplier: "TechSource",
    unit: "pieces",
    onHand: 182,
    reserved: 24,
    minimum: 50,
    reorderLevel: 60,
    reorderQuantity: 100,
    maximum: 300,
    warehouse: "Main warehouse",
    storageRoom: "ICT Store",
    shelf: "A",
    rack: "04",
    location: "Shelf A-04",
    department: "ICT",
    lastPurchaseDate: "2026-06-14",
    unitCost: 4.25,
    currency: "SRD",
    createdBy: "Naomi Williams",
    createdAt: "2026-01-10",
    modifiedBy: "Naomi Williams",
    lastUpdated: "2026-07-29",
    archived: false,
  },
  {
    id: "inv-2",
    code: "INV-BAT-012",
    barcode: "871000012",
    name: "UPS replacement battery",
    itemType: "Spare part",
    category: "Consumables",
    subcategory: "Batteries",
    brand: "APC",
    model: "RBC7",
    supplier: "Power Systems",
    unit: "pieces",
    onHand: 8,
    reserved: 2,
    minimum: 10,
    reorderLevel: 12,
    reorderQuantity: 10,
    maximum: 30,
    warehouse: "Main warehouse",
    storageRoom: "ICT Store",
    rack: "B-02",
    location: "Rack B-02",
    department: "ICT",
    expirationDate: "2028-05-01",
    createdBy: "Naomi Williams",
    createdAt: "2026-02-11",
    modifiedBy: "Michael King",
    lastUpdated: "2026-07-28",
    archived: false,
  },
  {
    id: "inv-3",
    code: "INV-TON-044",
    barcode: "871000044",
    name: "HP 59A toner",
    itemType: "Consumable",
    category: "Consumables",
    subcategory: "Toner",
    brand: "HP",
    model: "59A",
    supplier: "Office World",
    unit: "cartridges",
    onHand: 14,
    reserved: 3,
    minimum: 8,
    reorderLevel: 10,
    reorderQuantity: 12,
    maximum: 36,
    warehouse: "Main warehouse",
    storageRoom: "ICT Store",
    shelf: "C-11",
    location: "Shelf C-11",
    department: "Administration",
    createdBy: "Naomi Williams",
    createdAt: "2026-03-04",
    modifiedBy: "Naomi Williams",
    lastUpdated: "2026-07-27",
    archived: false,
  },
  ...[
    ["HDMI cable", "Cables", 28, 4, 10],
    ["AA battery pack", "Batteries", 0, 0, 8],
    ["USB mouse", "Peripherals", 16, 5, 10],
    ["USB keyboard", "Peripherals", 12, 2, 8],
    ["Laptop adapter", "Adapters", 6, 1, 8],
    ["Screen cleaning kit", "Cleaning", 24, 3, 10],
    ["Black printer toner", "Toner", 5, 2, 8],
    ["Cable ties", "Cables", 80, 20, 25],
  ].map((row, index): InventoryItem => ({
    id: `inv-${index + 4}`,
    code: `INV-DEMO-${String(index + 1).padStart(3, "0")}`,
    barcode: `872000${String(index + 1).padStart(3, "0")}`,
    name: String(row[0]),
    itemType: "Consumable",
    category: "Consumables",
    subcategory: String(row[1]),
    brand: "Demo Supply",
    model: `DS-${index + 1}`,
    supplier: "Fictional Office Supply",
    unit: "pieces",
    onHand: Number(row[2]),
    reserved: Number(row[3]),
    minimum: Number(row[4]),
    reorderLevel: Number(row[4]) + 2,
    reorderQuantity: 20,
    warehouse: "Main warehouse",
    storageRoom: "ICT Store",
    location: `Shelf D-${index + 1}`,
    department: "ICT",
    createdBy: "Demo Seeder",
    createdAt: "2026-07-01",
    modifiedBy: "Demo Seeder",
    lastUpdated: "2026-07-30",
    archived: false,
  })),
];
const disposalSeeds: Disposal[] = [
  {
    id: "dsp-0001",
    assetId: "ast-005",
    assetCode: "KCSPW-018",
    assetName: "APC Smart-UPS 1500",
    reason: "Economically irreparable battery and controller failure",
    status: "Inspected",
    requestedBy: "Joseph Lewis",
    requestedAt: "2026-07-26",
    inspectionNotes: "Repair exceeds replacement value.",
  },
];
const referenceSeeds: ReferenceRecord[] = [
  {
    id: "cat-1",
    kind: "category",
    name: "Laptops",
    type: "Serialized",
    status: "Active",
    relatedCount: 2,
    details: {
      codeGroup: "KCSMD",
      minimumStock: 0,
      maintenance: true,
      subcategories: ["Windows laptops", "Chromebooks"],
    },
  },
  {
    id: "cat-2",
    kind: "category",
    name: "Consumables",
    type: "Quantity-based",
    status: "Active",
    relatedCount: 3,
    details: {
      codeGroup: "INV",
      minimumStock: 10,
      maintenance: false,
      subcategories: ["Cables", "Toner", "Batteries"],
    },
  },
  {
    id: "loc-1",
    kind: "location",
    name: "Main Campus",
    type: "Campus",
    status: "Active",
    relatedCount: 6,
    details: { manager: "Naomi Williams" },
  },
  {
    id: "loc-2",
    kind: "location",
    name: "ICT Store",
    type: "Storage room",
    parent: "Main Campus",
    status: "Active",
    relatedCount: 3,
    details: {
      manager: "Michael King",
      position: "Shelf AÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“C",
    },
  },
  ...[
    "Warehouse",
    "Server Room",
    "Classroom 12",
    "Staff Room",
    "Library",
    "ICT Workshop",
  ].map((name, index): ReferenceRecord => ({
    id: `loc-${index + 3}`,
    kind: "location",
    name,
    type:
      name === "Warehouse"
        ? "Warehouse"
        : name.startsWith("Classroom")
          ? "Classroom"
          : "Office",
    typeId:
      name === "Warehouse"
        ? "warehouse"
        : name.startsWith("Classroom")
          ? "classroom"
          : "office",
    parent: "Main Campus",
    parentId: "loc-1",
    parentLocationId: "loc-1",
    status: "Active",
    relatedCount: 0,
    details: {},
  })),
  {
    id: "dep-1",
    kind: "department",
    name: "ICT",
    type: "Department",
    status: "Active",
    relatedCount: 4,
    details: { manager: "Michael King" },
  },
  {
    id: "dep-2",
    kind: "department",
    name: "Administration",
    type: "Department",
    status: "Active",
    relatedCount: 2,
    details: { manager: "Rita James" },
  },
];
const locationTypeSeeds: LocationType[] = [
  ["main-location", "Main location", "MAIN", [], 0],
  ["campus", "Building", "BLDG", [], 1],
  ["building", "Building", "BLDG", ["main-location"], 2],
  ["floor", "Classroom", "CLASS", ["building"], 3],
  ["department", "Office", "OFFICE", ["main-location", "building"], 4],
  ["office", "Office", "OFFICE", ["main-location", "building"], 5],
  ["classroom", "Classroom", "CLASS", ["main-location", "building"], 6],
  ["laboratory", "Laboratory", "LAB", ["main-location", "building"], 7],
  ["warehouse", "Warehouse", "WH", ["main-location", "building"], 8],
  [
    "storage-room",
    "Storage room",
    "STORE",
    ["main-location", "building", "warehouse"],
    9,
  ],
  ["shelf", "Shelf", "SHELF", ["storage-room", "warehouse", "cabinet"], 10],
  ["rack", "Cabinet", "CABINET", ["storage-room", "warehouse"], 11],
  [
    "storage-position",
    "Other",
    "OTHER",
    ["main-location", "building", "storage-room"],
    12,
  ],
].map(([typeId, name, code, parents, sortOrder]) => ({
  id: String(typeId),
  name: String(name),
  code: String(code),
  description: `System location type: ${name}.`,
  isActive: true,
  sortOrder: Number(sortOrder),
  allowedParentTypeIds: parents as string[],
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
}));
const codeGroupSeeds: CodeGroup[] = [
  ["devices", "Mobile devices", "KCSMD", 1, 5000, 152],
  ["laptops", "Laptops", "KCSL", 1, 5000, 126],
  ["boards", "Boards and projectors", "KCSBD", 1, 5000, 43],
  ["routers", "Routers and networking", "KCSRT", 1, 5000, 90],
  ["power", "Power equipment", "KCSPW", 1, 5000, 19],
].map(
  (
    [groupId, name, prefix, minimumNumber, maximumNumber, nextAvailableNumber],
    index,
  ) => ({
    id: String(groupId),
    name: String(name),
    prefix: String(prefix),
    minimumNumber: Number(minimumNumber),
    maximumNumber: Number(maximumNumber),
    nextAvailableNumber: Number(nextAvailableNumber),
    isActive: true,
    sortOrder: index + 1,
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
  }),
);
const officialMainLocations: ReferenceRecord[] = [
  {
    id: "loc-main-onderbouw",
    kind: "location",
    name: "Kangoeroe School Onderbouw",
    type: "Main location",
    typeId: "main-location",
    mainLocationId: null,
    containerLocationId: null,
    status: "Active",
    relatedCount: 0,
    details: { manager: "Naomi Williams" },
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
  },
  {
    id: "loc-main-bovenbouw",
    kind: "location",
    name: "Kangoeroe School Bovenbouw",
    type: "Main location",
    typeId: "main-location",
    mainLocationId: null,
    containerLocationId: null,
    status: "Active",
    relatedCount: 0,
    details: { manager: "Emmy Sastropawiro" },
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
  },
  {
    id: "loc-main-high",
    kind: "location",
    name: "Kangoeroe High",
    type: "Main location",
    typeId: "main-location",
    mainLocationId: null,
    containerLocationId: null,
    status: "Active",
    relatedCount: 0,
    details: { manager: "Naomi Williams" },
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
  },
];
const migratedReferenceSeeds: ReferenceRecord[] = [
  ...referenceSeeds.filter((item) => item.name !== "Main Campus"),
  ...officialMainLocations,
].map((item) =>
  item.kind !== "location" || item.type === "Main location"
    ? item
    : {
        ...item,
        parent: undefined,
        parentId: undefined,
        parentLocationId: undefined,
        mainLocationId:
          item.name === "Server Room"
            ? "loc-main-high"
            : item.name === "ICT Workshop"
              ? "loc-main-bovenbouw"
              : "loc-main-onderbouw",
        containerLocationId: null,
      },
);
const userSeeds: SystemUser[] = [
  {
    id: "u1",
    name: "Naomi Williams",
    email: "admin@kcs.example",
    role: "Administrator",
    department: "ICT",
    status: "Active",
    lastLogin: "2026-07-30 08:10",
  },
  {
    id: "u2",
    name: "Rohan Budhram",
    email: "Manager-ICT@kangoeroeschool.com",
    role: "ICT Manager",
    department: "ICT",
    status: "Active",
    lastLogin: "",
  },
  {
    id: "u3",
    name: "Emmy Sastropawiro",
    email: "sastropawiroe@kangoeroeschool.com",
    role: "Hoofd Planning & Coördinatie ICT Afd.",
    department: "ICT",
    status: "Active",
    lastLogin: "",
  },
  {
    id: "u4",
    name: "Shaquil Alienda",
    email: "aliendas@kangoeroeschool.com",
    role: "Junior IT Technician",
    department: "ICT",
    status: "Active",
    lastLogin: "",
  },
  {
    id: "u5",
    name: "Vicel Desperce",
    email: "despercev@kangoeroeschool.com",
    role: "Docent Informatica",
    department: "ICT",
    status: "Active",
    lastLogin: "",
  },
  {
    id: "u6",
    name: "Julian Maclean",
    email: "macleanjv@kangoeroeschool.com",
    role: "IT Technician",
    department: "ICT",
    status: "Active",
    lastLogin: "",
  },
  {
    id: "u7",
    name: "Jason Sanoesi",
    email: "sanoesij@kangoeroeschool.com",
    role: "Junior IT Technician",
    department: "ICT",
    status: "Active",
    lastLogin: "",
  },
];
const roleSeeds: RoleRecord[] = [
  {
    id: "role-1",
    name: "Administrator",
    description: "Complete mock administration access.",
    permissions: ["all"],
    system: true,
  },
  {
    id: "role-2",
    name: "ICT Manager",
    description: "ICT operations without account administration.",
    permissions: [
      "assets",
      "assignments",
      "borrow",
      "repairs",
      "maintenance",
      "audits",
      "reports",
    ],
    system: true,
  },
  {
    id: "role-3",
    name: "Hoofd Planning & Coördinatie ICT Afd.",
    description: "ICT planning and coordination.",
    permissions: [
      "assets",
      "assignments",
      "borrow",
      "repairs",
      "maintenance",
      "audits",
      "reports",
    ],
    system: true,
  },
  {
    id: "role-4",
    name: "Junior IT Technician",
    description: "Junior ICT technical operations.",
    permissions: [
      "assets.view",
      "inventory.view",
      "repairs.manage",
      "maintenance.manage",
    ],
    system: true,
  },
  {
    id: "role-5",
    name: "Docent Informatica",
    description: "ICT education and assigned asset access.",
    permissions: ["assets.view", "inventory.view"],
    system: true,
  },
  {
    id: "role-6",
    name: "IT Technician",
    description: "ICT technical operations.",
    permissions: ["assets", "assignments", "repairs", "maintenance"],
    system: true,
  },
];
const reportSeeds: ReportDefinition[] = [
  {
    id: "rep-1",
    name: "Monthly inventory summary",
    category: "Monthly",
    frequency: "Monthly",
    format: "PDF, Excel",
    lastGenerated: "2026-07-01",
    scheduled: true,
  },
  {
    id: "rep-2",
    name: "Low-stock report",
    category: "Inventory",
    frequency: "Weekly",
    format: "CSV, Excel",
    lastGenerated: "2026-07-27",
    scheduled: true,
  },
  {
    id: "rep-3",
    name: "Audit discrepancy report",
    category: "Audit",
    frequency: "On demand",
    format: "PDF",
    lastGenerated: "2026-07-22",
    scheduled: false,
  },
];

export class WorkflowRepositoryEngine implements InventoryRepository {
  private listeners = new Set<() => void>();
  protected state: MockSnapshot = this.seed();
  private seed(): MockSnapshot {
    return {
      assets: clone(seedAssets).map((asset) => {
        const location = migratedReferenceSeeds.find(
          (item) => item.kind === "location" && item.name === asset.location,
        );
        return {
          ...asset,
          currentLocationId: location?.id,
          homeLocationId: location?.id,
          mainLocationId: location?.mainLocationId || location?.id,
        };
      }),
      inventory: clone(inventorySeeds),
      assignments: [],
      borrows: clone(seedBorrows),
      repairs: clone(seedRepairs),
      maintenance: clone(seedMaintenance),
      movements: clone(seedMovements),
      audits: clone(seedAudits),
      auditDiscrepancies: [],
      correctiveActions: [],
      disposals: clone(disposalSeeds),
      notifications: clone(seedNotifications),
      activity: [],
      assetHistoryEvents: [],
      references: clone(migratedReferenceSeeds),
      locationTypes: clone(locationTypeSeeds),
      codeGroups: clone(codeGroupSeeds),
      systemSettings: { hierarchyValidationMode: "warning" },
      users: clone(userSeeds),
      roles: clone(roleSeeds),
      reports: clone(reportSeeds),
      reportResults: [],
      scheduledReports: [],
      reservations: [],
      inventoryMovements: [],
    };
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  snapshot = () => this.state;
  reset = () => {
    this.state = this.seed();
    this.emit();
  };
  async queryAssets(query: ListQuery) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return executeListQuery(
      this.state.assets.filter((asset) => asset.status !== "Archived"),
      query,
      {
        searchable: ["code", "name", "serialNumber", "brand", "model"],
        value: (asset, field) => {
          if (field === "alphabet") return asset.name.slice(0, 1).toUpperCase();
          if (field === "itemType") return asset.type;
          if (field === "purchaseYear") return asset.purchaseDate.slice(0, 4);
          if (field === "missingQr") return !asset.qr;
          if (field === "missingSerial") return !asset.serialNumber;
          if (field === "endOfLife")
            return Boolean(
              asset.usefulLifeEnd && asset.usefulLifeEnd <= today(),
            );
          if (field === "warrantyStatus")
            return asset.warrantyExpiry < today()
              ? "Expired"
              : asset.warrantyExpiry <=
                  new Date(Date.now() + 90 * 86400000)
                    .toISOString()
                    .slice(0, 10)
                ? "Expiring"
                : "Active";
          return asset[field as keyof Asset];
        },
        compare: (a, b, sort) => {
          if (sort.field === "code") return compareAssetCodes(a, b, "full");
          if (sort.field === "codePrefix")
            return compareAssetCodes(a, b, "prefix");
          if (sort.field === "codeNumber")
            return compareAssetCodes(a, b, "sequence");
          return undefined;
        },
      },
    );
  }
  async assetFacets() {
    const fields: (keyof Asset)[] = [
      "codePrefix",
      "category",
      "subcategory",
      "type",
      "status",
      "condition",
      "location",
      "department",
      "assignedTo",
      "supplier",
      "brand",
      "model",
    ];
    return Object.fromEntries(
      fields.map((field) => [
        field,
        [
          ...new Set(
            this.state.assets
              .map((asset) => String(asset[field] ?? ""))
              .filter(Boolean),
          ),
        ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      ]),
    );
  }
  async queryInventory(query: ListQuery) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return executeListQuery(this.state.inventory, query, {
      searchable: ["code", "name", "brand", "model", "supplier", "location"],
      value: (item, field) =>
        field === "available"
          ? availableStock(item)
          : field === "lowStock"
            ? availableStock(item) <= item.minimum
            : item[field as keyof InventoryItem],
    });
  }
  async inventoryFacets() {
    const fields: (keyof InventoryItem)[] = [
      "category",
      "subcategory",
      "itemType",
      "warehouse",
      "location",
      "department",
      "supplier",
      "brand",
      "model",
    ];
    return Object.fromEntries(
      fields.map((field) => [
        field,
        [
          ...new Set(
            this.state.inventory
              .map((item) => String(item[field] ?? ""))
              .filter(Boolean),
          ),
        ].sort(),
      ]),
    );
  }
  async queryAssetHistory(assetId: string, maximum = 250) {
    return this.state.assetHistoryEvents
      .filter((event) => event.assetId === assetId && !event.isArchived)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, maximum);
  }
  protected replaceState(state: MockSnapshot) {
    this.state = state;
    this.emit();
  }
  protected emit() {
    this.state = { ...this.state };
    this.listeners.forEach((listener) => listener());
  }
  private log(command: WorkflowCommand, result: WorkflowResult) {
    const entry: ActivityRecord = {
      id: id("evt", this.state.activity.length),
      at: now(),
      user: command.actor || "Naomi Williams",
      action: command.action,
      entityType: command.action.split(".")[0],
      entityId: result.entityId || command.entityId || "batch",
      result: result.ok ? "Success" : "Failure",
      detail: result.message,
    };
    this.state.activity = [entry, ...this.state.activity];
  }
  private nextHistoryId() {
    let sequence = this.state.assetHistoryEvents.length;
    let candidate = id("ahe", sequence);
    while (
      this.state.assetHistoryEvents.some((event) => event.id === candidate)
    )
      candidate = id("ahe", ++sequence);
    return candidate;
  }
  private historyAsset(command: WorkflowCommand, result: WorkflowResult) {
    if (command.action.startsWith("asset."))
      return this.state.assets.find(
        (asset) => asset.id === (result.entityId || command.entityId),
      );
    const sourceId = result.entityId || command.entityId;
    const linkedAssetId =
      this.state.assignments.find((item) => item.id === sourceId)?.assetId ||
      this.state.disposals.find((item) => item.id === sourceId)?.assetId ||
      this.state.movements.find((item) => item.id === sourceId)?.assetId;
    if (linkedAssetId)
      return this.state.assets.find((asset) => asset.id === linkedAssetId);
    const assetCode =
      this.state.borrows.find((item) => item.id === sourceId)?.assetCode ||
      this.state.repairs.find((item) => item.id === sourceId)?.assetCode ||
      this.state.maintenance.find((item) => item.id === sourceId)?.assetCode ||
      this.state.movements.find((item) => item.id === sourceId)?.assetCode ||
      String(command.values?.assetCode || command.values?.scannedCode || "");
    return this.state.assets.find((asset) => asset.code === assetCode);
  }
  private recordAutomaticHistory(
    command: WorkflowCommand,
    result: WorkflowResult,
    before: MockSnapshot,
  ) {
    if (!result.ok || command.action.startsWith("history.")) return;
    const category = command.action.split(".")[0];
    if (
      !new Set([
        "asset",
        "assignment",
        "borrow",
        "repair",
        "maintenance",
        "movement",
        "audit",
        "disposal",
      ]).has(category)
    )
      return;
    const asset = this.historyAsset(command, result);
    if (!asset) return;
    const previousAsset = before.assets.find((item) => item.id === asset.id);
    const actor = command.actor || "Naomi Williams";
    const event: AssetHistoryEvent = {
      id: this.nextHistoryId(),
      assetId: asset.id,
      assetCode: asset.code,
      eventType: command.action.replaceAll(".", "_"),
      category,
      title: command.action
        .split(".")
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" "),
      description: result.message,
      previous: previousAsset
        ? {
            status: previousAsset.status,
            condition: previousAsset.condition,
            location: previousAsset.location,
            department: previousAsset.department,
            assignedTo: previousAsset.assignedTo || null,
          }
        : undefined,
      next: {
        status: asset.status,
        condition: asset.condition,
        location: asset.location,
        department: asset.department,
        assignedTo: asset.assignedTo || null,
      },
      issue: String(command.values?.issue || "") || undefined,
      solution:
        String(command.values?.solution || command.values?.outcome || "") ||
        undefined,
      notes: String(command.values?.notes || "") || undefined,
      sourceModule: category,
      sourceRecordId: result.entityId || command.entityId,
      source: "system",
      createdAt: now(),
      occurredAt: String(
        command.values?.occurredAt || command.values?.date || now(),
      ),
      createdBy: actor,
      performedBy: String(command.values?.performedBy || actor),
      isLegacyImport: false,
      isManual: false,
      status: "Final",
      version: 1,
    };
    this.state.assetHistoryEvents = [event, ...this.state.assetHistoryEvents];

    if (previousAsset?.condition !== asset.condition)
      this.state.assetHistoryEvents = [
        {
          ...event,
          id: this.nextHistoryId(),
          eventType: "condition_changed",
          category: "condition",
          title: "Condition changed",
          description: `${previousAsset?.condition || "Unknown"} → ${asset.condition}`,
        },
        ...this.state.assetHistoryEvents,
      ];
  }
  private finish(command: WorkflowCommand, result: WorkflowResult) {
    this.log(command, result);
    this.emit();
    return result;
  }
  async execute(command: WorkflowCommand): Promise<WorkflowResult> {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const historyBefore = clone(this.state);
    const v = enforceMappedCondition(command.values || {});
    let result: WorkflowResult = { ok: true, message: "Operation completed." };
    try {
      switch (command.action) {
        case "asset.create": {
          const prefix = String(v.codePrefix || "KCSMD");
          const used = this.state.assets
            .filter((asset) => asset.codePrefix === prefix)
            .map((asset) => asset.codeNumber);
          const number = Number(v.codeNumber || Math.max(0, ...used) + 1);
          if (number < 1 || number > 5000)
            throw new Error("KCS code sequence must be between 01 and 5000.");
          const code = `${prefix}-${number < 100 ? String(number).padStart(2, "0") : number}`;
          const serial = String(v.serialNumber || "").trim();
          if (!serial) throw new Error("A serial number is required.");
          if (
            this.state.assets.some(
              (asset) =>
                asset.code === code ||
                asset.serialNumber.toLowerCase() === serial.toLowerCase(),
            )
          )
            throw new Error("Asset code and serial number must be unique.");
          const asset: Asset = {
            id: id("ast", this.state.assets.length),
            code,
            codePrefix: prefix,
            codeNumber: number,
            name: String(v.name || "New asset"),
            description: String(v.description || ""),
            category: String(v.category || "Other school equipment"),
            subcategory: String(v.subcategory || ""),
            type: String(v.type || "Device"),
            brand: String(v.brand || "Unspecified"),
            model: String(v.model || "Unspecified"),
            serialNumber: serial,
            barcode: String(v.barcode || code),
            location: String(v.location || "ICT Store"),
            currentLocationId: String(v.currentLocationId || "") || undefined,
            homeLocationId: String(v.homeLocationId || "") || undefined,
            mainLocationId: String(v.mainLocationId || "") || undefined,
            department: String(v.department || "ICT"),
            assignedTo: String(v.assignedTo || "") || undefined,
            responsibleEmployee:
              String(v.responsibleEmployee || "") || undefined,
            supplier: String(v.supplier || "") || undefined,
            manufacturer: String(v.manufacturer || "") || undefined,
            status: (v.status || "Available") as AssetStatus,
            condition: (v.condition || "Good") as Asset["condition"],
            purchaseDate: String(v.purchaseDate || today()),
            purchasePrice: Number(v.purchasePrice || 0),
            warrantyStart: String(v.warrantyStart || ""),
            warrantyExpiry: String(v.warrantyExpiry || today()),
            dateAdded: today(),
            createdBy: command.actor || "Naomi Williams",
            lastUpdated: today(),
            lastModifiedBy: command.actor || "Naomi Williams",
            maintenanceRequired: false,
            technicalSpecifications: (v.technicalSpecifications ||
              {}) as Record<string, string>,
            remoteAccess: (v.remoteAccess || {}) as Asset["remoteAccess"],
            attachments: (v.attachments || []) as string[],
            photos: (v.photos || []) as string[],
            notes: String(v.notes || ""),
            qr: true,
          };
          this.state.assets = [asset, ...this.state.assets];
          result = {
            ok: true,
            message: `${asset.code} was created.`,
            entityId: asset.id,
          };
          break;
        }
        case "asset.edit": {
          const a = this.asset(command.entityId);
          const serial = String(v.serialNumber ?? a.serialNumber);
          if (
            this.state.assets.some(
              (asset) =>
                asset.id !== a.id &&
                asset.serialNumber.toLowerCase() === serial.toLowerCase(),
            )
          )
            throw new Error("Serial number already exists.");
          const correction = String(v.codeCorrection || "").trim();
          if (correction) {
            if (!String(v.correctionReason || "").trim())
              throw new Error("A correction reason is required.");
            const normalized = normalizeAssetCode(correction);
            if (!normalized)
              throw new Error("The corrected KCS code is invalid.");
            if (
              this.state.assets.some(
                (asset) =>
                  asset.id !== a.id && asset.code === normalized.fullAssetCode,
              )
            )
              throw new Error("The corrected KCS code already exists.");
            a.previousCodes = [...(a.previousCodes || []), a.code];
            a.code = normalized.fullAssetCode;
            a.codePrefix = normalized.codePrefix;
            a.codeNumber = normalized.codeNumber;
          }
          const values = { ...v };
          delete values.codeCorrection;
          delete values.correctionReason;
          Object.assign(a, values, {
            serialNumber: serial,
            lastUpdated: today(),
            lastModifiedBy: command.actor || "Naomi Williams",
          });
          result = {
            ok: true,
            message: `${a.code} was updated.`,
            entityId: a.id,
          };
          break;
        }
        case "asset.move": {
          const a = this.asset(command.entityId);
          const destination = String(v.destinationLocation || "").trim();
          if (!destination)
            throw new Error("Destination location is required.");
          const previousLocation = a.location,
            previousDepartment = a.department;
          a.location = destination;
          a.department = String(v.destinationDepartment || a.department);
          a.lastUpdated = today();
          a.lastModifiedBy = command.actor || "Naomi Williams";
          this.addMovement(
            "Asset movement",
            a.name,
            a.code,
            1,
            String(v.reason || "Location change"),
            previousLocation,
            destination,
            String(v.approvedBy || ""),
            (v.attachments || []) as string[],
          );
          result = {
            ok: true,
            message: `${a.code} moved from ${previousLocation} to ${destination}; department ${previousDepartment} to ${a.department}.`,
            entityId: a.id,
          };
          break;
        }
        case "asset.archive":
        case "asset.restore": {
          const a = this.asset(command.entityId);
          a.status =
            command.action === "asset.archive" ? "Archived" : "Available";
          a.lastUpdated = today();
          result = {
            ok: true,
            message: `${a.code} was ${command.action.endsWith("archive") ? "archived" : "restored"}.`,
            entityId: a.id,
          };
          break;
        }
        case "history.legacy.import": {
          const asset = this.asset(String(v.assetId || command.entityId || ""));
          const fingerprint = String(v.fingerprint || "").trim();
          if (!fingerprint)
            throw new Error("A stable legacy-history fingerprint is required.");
          const existing = this.state.assetHistoryEvents.find(
            (event) => event.fingerprint === fingerprint,
          );
          if (existing) {
            result = {
              ok: true,
              message: "Legacy history event already imported; skipped.",
              entityId: existing.id,
            };
            break;
          }
          const occurredAt = String(v.occurredAt || "");
          if (!occurredAt || Number.isNaN(Date.parse(occurredAt)))
            throw new Error("A valid original history date is required.");
          const event: AssetHistoryEvent = {
            id: String(v.id || `legacy-event-${fingerprint}`),
            assetId: asset.id,
            assetCode: asset.code,
            eventType: String(v.eventType || "legacy_import"),
            category: String(v.category || "legacy"),
            title: String(v.title || "Imported legacy record"),
            description: String(v.description || ""),
            issue: String(v.issue || "") || undefined,
            solution: String(v.solution || "") || undefined,
            notes: String(v.notes || "") || undefined,
            sourceModule: "legacy_migration",
            sourceRecordId: String(v.sourceRecordId || "") || undefined,
            source: "legacy_import",
            createdAt: now(),
            occurredAt: new Date(occurredAt).toISOString(),
            createdBy: command.actor || "legacy_migration",
            performedBy: String(v.performedBy || "") || undefined,
            importBatchId: String(v.importBatchId || "") || undefined,
            originalLegacyText: String(v.originalLegacyText || "") || undefined,
            isLegacyImport: true,
            isManual: false,
            status: "Final",
            version: 1,
            fingerprint,
          };
          this.state.assetHistoryEvents = [
            event,
            ...this.state.assetHistoryEvents,
          ];
          result = {
            ok: true,
            message: "Legacy history event imported.",
            entityId: event.id,
          };
          break;
        }
        case "history.manual.saveDraft": {
          const asset = this.asset(String(v.assetId || ""));
          const existing = command.entityId
            ? this.state.assetHistoryEvents.find(
                (event) => event.id === command.entityId,
              )
            : undefined;
          if (existing && (!existing.isManual || existing.status !== "Draft"))
            throw new Error("Only manual draft notes may be updated.");
          const expectedVersion = Number(v.expectedVersion || 0);
          if (
            existing &&
            expectedVersion &&
            existing.version !== expectedVersion
          )
            throw new Error(
              "This draft changed in another session. Reload before saving.",
            );
          const title = String(v.title || "").trim();
          const description = String(v.description || "").trim();
          if (!title && !description)
            throw new Error("Enter a title or description.");
          const timestamp = now();
          const draft: AssetHistoryEvent = {
            id: existing?.id || this.nextHistoryId(),
            assetId: asset.id,
            assetCode: asset.code,
            eventType: String(v.eventType || "manual_note"),
            category: String(v.category || "manual"),
            title: title || "Manual history note",
            description,
            issue: String(v.issue || "") || undefined,
            solution: String(v.solution || "") || undefined,
            notes: String(v.notes || "") || undefined,
            sourceModule: "asset_history",
            sourceRecordId: existing?.id,
            source: "manual",
            createdAt: existing?.createdAt || timestamp,
            occurredAt: String(v.occurredAt || timestamp),
            createdBy: existing?.createdBy || command.actor || "Naomi Williams",
            performedBy: String(
              v.performedBy || command.actor || "Naomi Williams",
            ),
            isLegacyImport: false,
            isManual: true,
            status: "Draft",
            updatedAt: timestamp,
            version: (existing?.version || 0) + 1,
          };
          this.state.assetHistoryEvents = existing
            ? this.state.assetHistoryEvents.map((event) =>
                event.id === existing.id ? draft : event,
              )
            : [draft, ...this.state.assetHistoryEvents];
          result = {
            ok: true,
            message: "History draft saved.",
            entityId: draft.id,
          };
          break;
        }
        case "history.manual.finalize": {
          const event = this.state.assetHistoryEvents.find(
            (item) => item.id === command.entityId,
          );
          if (!event || !event.isManual || event.status !== "Draft")
            throw new Error("Manual history draft not found.");
          event.status = "Final";
          event.updatedAt = now();
          event.version += 1;
          result = {
            ok: true,
            message: "History note finalized.",
            entityId: event.id,
          };
          break;
        }
        case "history.manual.delete": {
          const event = this.state.assetHistoryEvents.find(
            (item) => item.id === command.entityId,
          );
          if (!event || !event.isManual || event.status !== "Draft")
            throw new Error("Only manual drafts may be deleted.");
          event.isArchived = true;
          event.archivedAt = now();
          event.archivedBy = command.actor || "Naomi Williams";
          event.updatedAt = now();
          event.version += 1;
          result = {
            ok: true,
            message: "History draft deleted.",
            entityId: event.id,
          };
          break;
        }
        case "history.manual.correct": {
          const original = this.state.assetHistoryEvents.find(
            (item) => item.id === command.entityId,
          );
          if (!original || original.status !== "Final")
            throw new Error("Final history event not found.");
          const description = String(v.description || "").trim();
          if (!description)
            throw new Error("A correction explanation is required.");
          const correction: AssetHistoryEvent = {
            ...original,
            id: this.nextHistoryId(),
            eventType: "correction",
            category: "correction",
            title: `Correction: ${original.title}`,
            description,
            source: "correction",
            sourceRecordId: original.id,
            createdAt: now(),
            occurredAt: now(),
            createdBy: command.actor || "Naomi Williams",
            performedBy: command.actor || "Naomi Williams",
            isManual: true,
            version: 1,
          };
          this.state.assetHistoryEvents = [
            correction,
            ...this.state.assetHistoryEvents,
          ];
          result = {
            ok: true,
            message: "Correction event added.",
            entityId: correction.id,
          };
          break;
        }
        case "inventory.legacy.importBatch": {
          const rows = Array.isArray(v.rows)
            ? (v.rows as Array<Record<string, unknown>>)
            : [];
          if (!rows.length)
            throw new Error("No new laptop rows were supplied.");
          const actor = command.actor || "AIMS inventory importer";
          const importedAt = now();
          let created = 0;
          let skipped = 0;
          for (const row of rows) {
            const code = String(row.code || "").trim();
            const migrationId = String(row.id || "").trim();
            if (!code || !migrationId)
              throw new Error(
                "Every imported laptop requires a stable code and migration ID.",
              );
            const existingInventory = this.state.inventory.find(
              (item) => item.code.toLowerCase() === code.toLowerCase(),
            );
            const existingAsset = this.state.assets.find(
              (item) => item.code.toLowerCase() === code.toLowerCase(),
            );
            if (existingInventory || existingAsset) {
              skipped += 1;
              continue;
            }
            const sourceData = (row.sourceData || {}) as Record<string, string>;
            const importMetadata = {
              source: "KCS Laptop Inventory",
              sourceType: "legacy_inventory" as const,
              importedAt,
              importedBy: actor,
              sourceRecordCode: code,
              migrationVersion: "laptop-inventory-v1",
            };
            const inventoryId = `${migrationId}-inventory`;
            const assetId = `${migrationId}-asset`;
            const item: InventoryItem = {
              id: inventoryId,
              code,
              barcode: code,
              name: String(sourceData.brandModel || code),
              description: String(sourceData.specifications || ""),
              itemType: "Laptop",
              category: "IT Equipment",
              subcategory: "Computers / Laptops",
              brand: String(row.brand || ""),
              model: String(row.model || sourceData.brandModel || ""),
              manufacturer: String(row.brand || ""),
              unit: "piece",
              onHand: 1,
              reserved: 0,
              minimum: 0,
              reorderLevel: 0,
              reorderQuantity: 0,
              maximum: 1,
              warehouse: "",
              location: String(sourceData.location || ""),
              department: "",
              lastPurchaseDate: String(row.purchaseDate || ""),
              notes: "",
              createdBy: actor,
              createdAt: importedAt,
              modifiedBy: actor,
              lastUpdated: importedAt,
              archived: false,
              workflowStatus: "In stock",
              sourceData,
              importMetadata,
            };
            const prefix = code.match(/^[A-Za-z]+/)?.[0] || code;
            const codeNumber = Number(code.match(/(\d+)/)?.[1] || 0);
            const asset: Asset = {
              id: assetId,
              code,
              codePrefix: prefix,
              codeNumber,
              name: String(sourceData.brandModel || code),
              description: String(sourceData.specifications || ""),
              category: "IT Equipment",
              subcategory: "Computers",
              type: "Laptop",
              brand: String(row.brand || ""),
              model: String(row.model || sourceData.brandModel || ""),
              serialNumber: String(sourceData.serialNumber || ""),
              barcode: code,
              location: String(sourceData.location || ""),
              department: "",
              assignedTo: String(sourceData.user || "") || undefined,
              manufacturer: String(row.brand || "") || undefined,
              status: String(row.status || "Available") as AssetStatus,
              condition: String(row.condition || "Fair") as Asset["condition"],
              purchaseDate: String(row.purchaseDate || ""),
              warrantyExpiry: "",
              dateAdded: today(),
              createdBy: actor,
              lastUpdated: today(),
              lastModifiedBy: actor,
              maintenanceRequired: false,
              technicalSpecifications: (row.technicalSpecifications ||
                {}) as Record<string, string>,
              attachments: [],
              photos: [],
              notes: "",
              sourceData,
              importMetadata,
              qr: true,
            };
            this.state.inventory = [item, ...this.state.inventory];
            this.state.assets = [asset, ...this.state.assets];
            const event: AssetHistoryEvent = {
              id: `${migrationId}-history`,
              assetId,
              assetCode: code,
              eventType: "inventory_import_created",
              category: "inventory",
              title: "Legacy laptop inventory imported",
              description: `INVENTORY_IMPORT_CREATED: ${code}`,
              sourceModule: "inventory_import",
              sourceRecordId: inventoryId,
              source: "legacy_import",
              createdAt: importedAt,
              occurredAt: importedAt,
              createdBy: actor,
              performedBy: actor,
              importBatchId: String(v.batchId || "laptop-inventory-v1"),
              originalLegacyText: JSON.stringify(sourceData),
              isLegacyImport: true,
              isManual: false,
              status: "Final",
              version: 1,
              fingerprint: migrationId,
            };
            this.state.assetHistoryEvents = [
              event,
              ...this.state.assetHistoryEvents,
            ];
            this.log(command, {
              ok: true,
              message: `INVENTORY_IMPORT_CREATED: ${code}`,
              entityId: assetId,
            });
            created += 1;
          }
          result = {
            ok: true,
            message: `Laptop inventory import complete: ${created} created, ${skipped} skipped.`,
            entityId: String(v.batchId || "laptop-inventory-v1"),
          };
          break;
        }
        case "inventory.create": {
          const code = String(
            v.code || `INV-${this.state.inventory.length + 1}`,
          ).trim();
          if (
            this.state.inventory.some(
              (item) => item.code.toLowerCase() === code.toLowerCase(),
            )
          )
            throw new Error("Item code already exists.");
          const opening = Number(v.onHand || v.openingQuantity || 0);
          if (opening < 0)
            throw new Error("Opening quantity cannot be negative.");
          const item: InventoryItem = {
            id: id("inv", this.state.inventory.length),
            code,
            barcode: String(v.barcode || code),
            name: String(v.name || "New inventory item"),
            description: String(v.description || ""),
            itemType: String(v.itemType || "Consumable"),
            category: String(v.category || "Consumables"),
            subcategory: String(v.subcategory || ""),
            brand: String(v.brand || ""),
            model: String(v.model || ""),
            manufacturer: String(v.manufacturer || ""),
            supplier: String(v.supplier || ""),
            supplierItemCode: String(v.supplierItemCode || ""),
            unit: String(v.unit || "pieces"),
            onHand: opening,
            reserved: 0,
            minimum: Number(v.minimum || 0),
            reorderLevel: Number(v.reorderLevel || v.minimum || 0),
            reorderQuantity: Number(v.reorderQuantity || 0),
            maximum: Number(v.maximum || 0) || undefined,
            warehouse: String(v.warehouse || "Main warehouse"),
            storageRoom: String(v.storageRoom || ""),
            shelf: String(v.shelf || ""),
            rack: String(v.rack || ""),
            location: String(v.location || "Warehouse"),
            department: String(v.department || ""),
            lastPurchaseDate: String(v.lastPurchaseDate || ""),
            unitCost: Number(v.unitCost || 0) || undefined,
            currency: String(v.currency || "SRD"),
            batchNumber: String(v.batchNumber || ""),
            expirationDate: String(v.expirationDate || ""),
            notes: String(v.notes || ""),
            attachments: [],
            createdBy: command.actor || "Naomi Williams",
            createdAt: now(),
            modifiedBy: command.actor || "Naomi Williams",
            lastUpdated: now(),
            archived: false,
          };
          this.state.inventory = [item, ...this.state.inventory];
          if (opening)
            this.addInventoryMovement(
              "Opening balance",
              item,
              opening,
              0,
              opening,
              "Opening stock",
              undefined,
              item.location,
            );
          result = {
            ok: true,
            message: `${item.name} was created.`,
            entityId: item.id,
          };
          break;
        }
        case "inventory.edit": {
          const item = this.item(command.entityId);
          const protectedFields = ["onHand", "reserved"];
          protectedFields.forEach((field) => delete v[field]);
          Object.assign(item, v, {
            modifiedBy: command.actor || "Naomi Williams",
            lastUpdated: now(),
          });
          result = {
            ok: true,
            message: `${item.name} was updated.`,
            entityId: item.id,
          };
          break;
        }
        case "inventory.archive":
        case "inventory.restore": {
          const item = this.item(command.entityId);
          item.archived = command.action === "inventory.archive";
          result = {
            ok: true,
            message: `${item.name} was ${item.archived ? "archived" : "restored"}.`,
            entityId: item.id,
          };
          break;
        }
        case "stock.receive":
        case "stock.issue":
        case "stock.return":
        case "stock.correct": {
          const item = this.item(command.entityId);
          const quantity = Number(v.quantity || 1);
          if (quantity <= 0) throw new Error("Quantity must be positive.");
          if (
            command.action === "stock.correct" &&
            !String(v.reason || "").trim()
          )
            throw new Error("A correction reason is required.");
          if (
            command.action === "stock.issue" &&
            quantity > availableStock(item)
          )
            throw new Error("Quantity cannot exceed available stock.");
          const previous = item.onHand;
          const delta =
            command.action === "stock.issue"
              ? -quantity
              : command.action === "stock.correct"
                ? Number(v.delta || 0)
                : quantity;
          if (item.onHand + delta < 0)
            throw new Error("Stock cannot become negative.");
          item.onHand += delta;
          item.lastUpdated = now();
          const type =
            command.action === "stock.receive"
              ? "Incoming"
              : command.action === "stock.issue"
                ? "Outgoing"
                : command.action === "stock.return"
                  ? "Return"
                  : "Stock correction";
          this.addInventoryMovement(
            type,
            item,
            Math.abs(delta),
            previous,
            item.onHand,
            String(v.reason || type),
            String(v.source || ""),
            String(v.destination || item.location),
          );
          result = {
            ok: true,
            message: `Stock updated to ${item.onHand}.`,
            entityId: item.id,
          };
          break;
        }
        case "stock.reserve":
        case "reservation.create": {
          const item = this.item(command.entityId);
          const quantity = Number(v.quantity || 1);
          item.reserved = reserveStock(item, quantity);
          const reservation: StockReservation = {
            id: id("rsv", this.state.reservations.length),
            reference: `RSV-${today().replaceAll("-", "")}-${this.state.reservations.length + 1}`,
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            quantity,
            fulfilledQuantity: 0,
            requestedBy: String(
              v.requestedBy || command.actor || "Naomi Williams",
            ),
            beneficiary: String(v.beneficiary || v.department || "ICT"),
            purpose: String(v.purpose || v.reason || "Operational requirement"),
            requiredDate: String(v.requiredDate || today()),
            expirationDate: String(v.expirationDate || today()),
            approvedBy:
              command.action === "stock.reserve"
                ? command.actor || "Naomi Williams"
                : undefined,
            status: command.action === "stock.reserve" ? "Active" : "Pending",
            notes: String(v.notes || ""),
            createdAt: now(),
            history: [`${now()} Created`],
          };
          if (command.action === "reservation.create")
            item.reserved = releaseStock(item.reserved, quantity);
          this.state.reservations = [reservation, ...this.state.reservations];
          this.addInventoryMovement(
            "Reservation",
            item,
            quantity,
            item.onHand,
            item.onHand,
            reservation.purpose,
          );
          result = {
            ok: true,
            message: `Reservation ${reservation.reference} created.`,
            entityId: reservation.id,
          };
          break;
        }
        case "stock.transfer": {
          const item = this.item(command.entityId);
          const destination = String(v.destination || "").trim();
          if (!destination || destination === item.location)
            throw new Error("Source and destination must differ.");
          const quantity = Number(v.quantity || 1);
          if (quantity > availableStock(item))
            throw new Error("Quantity cannot exceed source availability.");
          const source = item.location;
          item.location = destination;
          this.addInventoryMovement(
            "Transfer",
            item,
            quantity,
            item.onHand,
            item.onHand,
            String(v.reason || "Storage transfer"),
            source,
            destination,
          );
          result = {
            ok: true,
            message: `${item.name} transferred to ${item.location}.`,
            entityId: item.id,
          };
          break;
        }
        case "reservation.approve":
        case "reservation.reject":
        case "reservation.release":
        case "reservation.fulfill":
        case "reservation.cancel": {
          const reservation = this.reservation(command.entityId),
            item = this.item(reservation.itemId),
            quantity = Number(
              v.quantity ||
                reservation.quantity - reservation.fulfilledQuantity,
            );
          if (command.action === "reservation.approve") {
            item.reserved = reserveStock(item, quantity);
            reservation.status = "Active";
            reservation.approvedBy = command.actor || "Naomi Williams";
          } else if (command.action === "reservation.fulfill") {
            const next = fulfillReservation(
              item.onHand,
              item.reserved,
              quantity,
            );
            const previous = item.onHand;
            item.onHand = next.onHand;
            item.reserved = next.reserved;
            reservation.fulfilledQuantity += quantity;
            reservation.status =
              reservation.fulfilledQuantity === reservation.quantity
                ? "Fulfilled"
                : "Partially fulfilled";
            this.addInventoryMovement(
              "Outgoing",
              item,
              quantity,
              previous,
              item.onHand,
              "Reservation fulfillment",
            );
          } else {
            if (
              ["Active", "Approved", "Partially fulfilled"].includes(
                reservation.status,
              )
            )
              item.reserved = releaseStock(
                item.reserved,
                reservation.quantity - reservation.fulfilledQuantity,
              );
            reservation.status =
              command.action === "reservation.reject"
                ? "Rejected"
                : command.action === "reservation.release"
                  ? "Released"
                  : "Cancelled";
            this.addInventoryMovement(
              "Reservation release",
              item,
              quantity,
              item.onHand,
              item.onHand,
              reservation.status,
            );
          }
          reservation.history.push(`${now()} ${reservation.status}`);
          result = {
            ok: true,
            message: `Reservation changed to ${reservation.status}.`,
            entityId: reservation.id,
          };
          break;
        }
        case "assignment.create": {
          const a = this.asset(command.entityId);
          if (
            !assignmentEligible(a.status) ||
            this.state.assignments.some((x) => x.assetId === a.id && x.active)
          )
            throw new Error("This asset is not eligible for assignment.");
          const at = String(v.assignedAt || today()),
            expected = String(v.expectedReturn || "");
          if (expected && expected < at)
            throw new Error(
              "Expected end date cannot precede assignment date.",
            );
          const assignment: Assignment = {
            id: id("asn", this.state.assignments.length),
            reference: `ASN-${today().slice(0, 4)}-${String(this.state.assignments.length + 1).padStart(4, "0")}`,
            assetId: a.id,
            assetCode: a.code,
            assetName: a.name,
            category: a.category,
            assignee: String(v.assignee || "Naomi Williams"),
            assigneeType: String(v.assigneeType || "Employee"),
            department: String(v.department || "ICT"),
            location: String(v.location || a.location),
            assignedAt: at,
            expectedReturn: expected,
            assignedBy: String(
              v.assignedBy || command.actor || "Naomi Williams",
            ),
            approvedBy: String(v.approvedBy || ""),
            status: "Active",
            active: true,
            conditionAtIssue: String(v.condition || a.condition),
            operationalStatusAtIssue: a.status,
            accessories: String(v.accessories || "")
              .split(",")
              .map((name) => name.trim())
              .filter(Boolean)
              .map((name) => ({ name, quantity: 1, conditionAtIssue: "Good" })),
            notes: String(v.notes || ""),
            attachments: (v.attachments || []) as string[],
            assigneeSignature: String(
              v.assigneeSignature || v.signature || "Mock assignee signature",
            ),
            staffSignature: String(v.staffSignature || "Mock staff signature"),
            signature: String(
              v.signature || v.assigneeSignature || "Mock signature captured",
            ),
            createdBy: command.actor || "Naomi Williams",
            createdAt: now(),
            modifiedBy: command.actor || "Naomi Williams",
            lastUpdated: now(),
            history: [
              {
                id: "h-1",
                at: now(),
                user: command.actor || "Naomi Williams",
                type: "Creation",
                description: "Assignment created and activated.",
                next: { status: "Active" },
                relatedRecord: a.code,
              },
            ],
          };
          a.status = "Assigned";
          a.assignedTo = assignment.assignee;
          a.department = assignment.department;
          a.location = assignment.location;
          this.state.assignments = [assignment, ...this.state.assignments];
          this.addMovement(
            "Assignment",
            a.name,
            a.code,
            1,
            "Asset assigned",
            "Available",
            assignment.location,
          );
          result = {
            ok: true,
            message: `${a.code} assigned to ${assignment.assignee}.`,
            entityId: assignment.id,
          };
          break;
        }
        case "assignment.edit":
        case "assignment.approve":
        case "assignment.requestReturn":
        case "assignment.cancel":
        case "assignment.reassign": {
          const assignment = this.assignment(command.entityId);
          const previous = assignment.status;
          const next =
            command.action === "assignment.approve"
              ? "Approved"
              : command.action === "assignment.requestReturn"
                ? "Return requested"
                : command.action === "assignment.cancel"
                  ? "Cancelled"
                  : command.action === "assignment.reassign"
                    ? "Reassigned"
                    : assignment.status;
          if (next !== previous && !canTransitionAssignment(previous, next))
            throw new Error(
              `Invalid assignment transition: ${previous} to ${next}.`,
            );
          if (command.action === "assignment.edit") {
            if (!String(v.reason || "").trim())
              throw new Error("A reason is required for assignment edits.");
            assignment.expectedReturn = String(
              v.expectedReturn || assignment.expectedReturn || "",
            );
            assignment.notes = String(v.notes || assignment.notes || "");
            assignment.department = String(
              v.department || assignment.department,
            );
          } else assignment.status = next;
          assignment.modifiedBy = command.actor || "Naomi Williams";
          assignment.lastUpdated = now();
          assignment.history.unshift({
            id: id("h", assignment.history.length),
            at: now(),
            user: command.actor || "Naomi Williams",
            type: command.action,
            description: `Assignment changed from ${previous} to ${assignment.status}.`,
            previous: { status: previous },
            next: { status: assignment.status },
            reason: String(v.reason || ""),
          });
          result = {
            ok: true,
            message: `${assignment.reference} updated.`,
            entityId: assignment.id,
          };
          break;
        }
        case "assignment.return": {
          const assignment = this.assignment(command.entityId);
          if (!["Active", "Return requested"].includes(assignment.status))
            throw new Error("Assignment must be active or return requested.");
          const returnDate = String(v.returnedAt || today());
          if (returnDate < assignment.assignedAt)
            throw new Error("Return date cannot precede assignment date.");
          assignment.active = false;
          assignment.status = "Returned";
          assignment.returnedAt = returnDate;
          assignment.returnedBy = String(v.returnedBy || assignment.assignee);
          assignment.receivedBy = String(
            v.receivedBy || command.actor || "Naomi Williams",
          );
          assignment.conditionAtReturn = String(
            v.condition || assignment.conditionAtIssue,
          );
          assignment.operationalStatusAfterReturn = String(
            v.outcome || "Available",
          );
          assignment.accessoriesReturned = String(v.accessoriesReturned || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          assignment.missingAccessories = String(v.missingAccessories || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          assignment.returnNotes = String(v.notes || "");
          assignment.returnSignature = String(v.returnSignature || "");
          assignment.lastUpdated = now();
          assignment.history.unshift({
            id: id("h", assignment.history.length),
            at: now(),
            user: command.actor || "Naomi Williams",
            type: "Return",
            description:
              "Assignment returned with explicit condition and accessory comparison.",
            previous: {
              status: "Active",
              condition: assignment.conditionAtIssue,
            },
            next: {
              status: "Returned",
              condition: assignment.conditionAtReturn,
            },
            reason: assignment.returnNotes,
          });
          const a = this.asset(assignment.assetId);
          const outcome = assignment.operationalStatusAfterReturn;
          a.status = outcome.includes("repair")
            ? "Under Repair"
            : outcome.includes("maintenance")
              ? "Under Maintenance"
              : outcome.includes("inspection") ||
                  assignment.missingAccessories.length
                ? "Reserved"
                : assignment.conditionAtReturn === "Defective"
                  ? "Damaged"
                  : "Available";
          a.condition = assignment.conditionAtReturn as typeof a.condition;
          delete a.assignedTo;
          this.addMovement(
            "Assignment return",
            a.name,
            a.code,
            1,
            assignment.returnNotes,
            assignment.location,
            String(v.destination || "ICT Store"),
          );
          result = {
            ok: true,
            message: `${a.code} was returned from assignment.`,
            entityId: assignment.id,
          };
          break;
        }
        case "borrow.create": {
          const a = this.asset(command.entityId);
          if (!borrowEligible(a.status))
            throw new Error("Only eligible equipment can be borrowed.");
          const start = String(v.borrowDate || today()),
            due = String(
              v.dueDate ||
                new Date(Date.now() + 86400000).toISOString().slice(0, 10),
            );
          if (!validDateRange(start, due) || due === start)
            throw new Error(
              "Expected return date must be after the borrow date.",
            );
          const borrow: BorrowRecord = {
            id: id("br", this.state.borrows.length),
            reference: `BOR-2026-${String(this.state.borrows.length + 84).padStart(4, "0")}`,
            asset: a.name,
            assetCode: a.code,
            assetId: a.id,
            borrower: String(v.borrower || "Authorized employee"),
            borrowerType: String(v.borrowerType || "Employee"),
            department: String(v.department || "Administration"),
            reason: String(v.reason || "Authorized temporary use"),
            requestedDate: today(),
            borrowDate: start,
            dueDate: due,
            intendedLocation: String(v.location || a.location),
            status: "Pending Approval",
            approvalStatus: "Pending",
            condition: a.condition,
            accessoriesRequested: String(v.accessories || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
            notes: String(v.notes || ""),
            history: [
              {
                id: "h-1",
                at: now(),
                user: command.actor || "Naomi Williams",
                type: "Request",
                description: "Borrow request submitted.",
              },
            ],
            createdBy: command.actor || "Naomi Williams",
            createdAt: now(),
            modifiedBy: command.actor || "Naomi Williams",
            lastUpdated: now(),
          };
          this.state.borrows = [borrow, ...this.state.borrows];
          result = {
            ok: true,
            message: `Borrow request ${borrow.reference} created.`,
            entityId: borrow.id,
          };
          break;
        }
        case "borrow.edit":
        case "borrow.submit":
        case "borrow.approve":
        case "borrow.reject":
        case "borrow.issue":
        case "borrow.return":
        case "borrow.cancel":
        case "borrow.remind":
        case "borrow.escalate": {
          const b = this.borrow(command.entityId);
          if (command.action === "borrow.edit") {
            if (!["Draft", "Pending Approval"].includes(b.status))
              throw new Error("Only draft or pending requests may be edited.");
            Object.assign(b, {
              reason: String(v.reason || b.reason || ""),
              dueDate: String(v.dueDate || b.dueDate),
              notes: String(v.notes || b.notes || ""),
            });
            b.history = [
              ...(b.history || []),
              {
                id: id("h", (b.history || []).length),
                at: now(),
                user: command.actor || "Naomi Williams",
                type: "Edit",
                description: "Borrow request edited.",
                reason: String(v.changeReason || "Administrative update"),
              },
            ];
            result = {
              ok: true,
              message: `${b.reference} updated.`,
              entityId: b.id,
            };
            break;
          }
          if (
            command.action === "borrow.remind" ||
            command.action === "borrow.escalate"
          ) {
            b.reminderAt = now();
            if (command.action === "borrow.escalate")
              b.escalationLevel = (b.escalationLevel || 0) + 1;
            result = {
              ok: true,
              message: `${b.reference} follow-up recorded.`,
              entityId: b.id,
            };
            break;
          }
          const next: BorrowRecord["status"] =
            command.action === "borrow.submit"
              ? "Pending Approval"
              : command.action === "borrow.approve"
                ? "Approved"
                : command.action === "borrow.reject"
                  ? "Rejected"
                  : command.action === "borrow.issue"
                    ? "Issued"
                    : command.action === "borrow.cancel"
                      ? "Cancelled"
                      : String(v.partial) === "true"
                        ? "Partially Returned"
                        : "Returned";
          if (
            !canTransitionBorrow(b.status, next) &&
            !(
              b.status === "Overdue" &&
              ["Partially Returned", "Returned"].includes(next)
            )
          )
            throw new Error(
              `Invalid borrow transition: ${b.status} to ${next}.`,
            );
          if (
            command.action === "borrow.reject" &&
            !String(v.reason || "").trim()
          )
            throw new Error("A rejection reason is required.");
          const a = this.state.assets.find((x) => x.code === b.assetCode);
          if (
            command.action === "borrow.issue" &&
            (!a || !borrowEligible(a.status))
          )
            throw new Error("Equipment is no longer available for issue.");
          b.status = next;
          b.approvalStatus =
            next === "Approved"
              ? "Approved"
              : next === "Rejected"
                ? "Rejected"
                : b.approvalStatus;
          b.approvedBy =
            next === "Approved"
              ? command.actor || "Naomi Williams"
              : b.approvedBy;
          b.approvalDate = next === "Approved" ? today() : b.approvalDate;
          b.rejectionReason =
            next === "Rejected" ? String(v.reason) : b.rejectionReason;
          b.issuedBy =
            next === "Issued" ? command.actor || "Naomi Williams" : b.issuedBy;
          b.issueDate = next === "Issued" ? today() : b.issueDate;
          b.returnCondition = String(
            v.condition || b.returnCondition || b.condition,
          );
          b.accessoriesIssued =
            next === "Issued"
              ? String(v.accessoriesIssued || b.accessoriesRequested || "")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
              : b.accessoriesIssued;
          b.accessoriesReturned =
            command.action === "borrow.return"
              ? String(v.accessoriesReturned || "")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
              : b.accessoriesReturned;
          b.missingAccessories =
            command.action === "borrow.return"
              ? String(v.missingAccessories || "")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
              : b.missingAccessories;
          b.damageFound =
            command.action === "borrow.return" &&
            String(v.damageFound) === "true";
          b.receivedBy =
            command.action === "borrow.return"
              ? String(v.receivedBy || command.actor || "Naomi Williams")
              : b.receivedBy;
          b.actualReturnDate =
            next === "Returned"
              ? String(v.returnDate || today())
              : b.actualReturnDate;
          b.borrowerSignature = String(
            v.borrowerSignature ||
              b.borrowerSignature ||
              "Mock borrower signature",
          );
          b.staffSignature = String(
            v.staffSignature || b.staffSignature || "Mock staff signature",
          );
          b.lastUpdated = now();
          b.history = [
            ...(b.history || []),
            {
              id: id("h", (b.history || []).length),
              at: now(),
              user: command.actor || "Naomi Williams",
              type: command.action,
              description: `Borrow changed to ${next}.`,
              reason: String(v.reason || ""),
            },
          ];
          if (a)
            a.status =
              command.action === "borrow.issue"
                ? "Borrowed"
                : command.action === "borrow.return" && next === "Returned"
                  ? b.damageFound
                    ? "Damaged"
                    : b.returnCondition === "Defective"
                      ? "Damaged"
                      : "Available"
                  : a.status;
          this.addMovement(
            command.action,
            a?.name || b.asset,
            b.assetCode,
            1,
            String(v.reason || next),
          );
          result = {
            ok: true,
            message: `${b.reference} changed to ${next}.`,
            entityId: b.id,
          };
          break;
        }
        case "repair.create": {
          const a = this.asset(command.entityId);
          if (
            ["Archived", "Disposed"].includes(a.status) ||
            this.state.repairs.some(
              (x) =>
                x.assetCode === a.code &&
                ![
                  "Completed",
                  "Returned to User",
                  "Unrepairable",
                  "Cancelled",
                  "Rejected",
                ].includes(x.status),
            )
          )
            throw new Error(
              "Asset is ineligible or already has an active repair.",
            );
          const repair: Repair = {
            id: id("rp", this.state.repairs.length),
            reference: `REP-2026-${String(this.state.repairs.length + 43).padStart(4, "0")}`,
            asset: a.name,
            assetName: a.name,
            assetId: a.id,
            assetCode: a.code,
            serialNumber: a.serialNumber,
            category: a.category,
            issue: String(v.issue || "Reported technical fault"),
            problemTitle: String(
              v.problemTitle || v.issue || "Technical fault",
            ),
            reportedBy: String(
              v.reportedBy || command.actor || "Naomi Williams",
            ),
            reportedAt: now(),
            priority: (v.priority || "Medium") as Repair["priority"],
            technician: String(v.technician || "Unassigned"),
            status: "Reported",
            received: today(),
            due: String(v.due || today()),
            warrantyRepair: String(v.warrantyRepair) === "true",
            safetyRisk: String(v.safetyRisk) === "true",
            notes: String(v.notes || ""),
            attachments: (v.attachments || []) as string[],
            beforePhotos: (v.beforePhotos || []) as string[],
            history: [
              {
                id: "h-1",
                at: now(),
                user: command.actor || "Naomi Williams",
                type: "Reported",
                description: "Repair reported.",
              },
            ],
            createdBy: command.actor || "Naomi Williams",
            createdAt: now(),
            lastUpdated: now(),
            previousAssetStatus: a.status,
            previousAssetCondition: a.condition,
          };
          a.status = "Under Repair";
          this.state.repairs = [repair, ...this.state.repairs];
          result = {
            ok: true,
            message: `Repair ${repair.reference} created.`,
            entityId: repair.id,
          };
          break;
        }
        case "repair.edit":
        case "repair.diagnose":
        case "repair.approve":
        case "repair.reject":
        case "repair.parts":
        case "repair.start":
        case "repair.external":
        case "repair.test":
        case "repair.complete":
        case "repair.unrepairable":
        case "repair.return":
        case "repair.cancel":
        case "repair.progress": {
          const r = this.repair(command.entityId);
          const next = (
            command.action === "repair.diagnose"
              ? String(v.status || "Diagnosing")
              : command.action === "repair.approve"
                ? "Approved"
                : command.action === "repair.reject"
                  ? "Rejected"
                  : command.action === "repair.parts"
                    ? "Waiting for Parts"
                    : command.action === "repair.start"
                      ? "In Repair"
                      : command.action === "repair.external"
                        ? "External Repair"
                        : command.action === "repair.test"
                          ? String(v.testResult) === "Failed"
                            ? "In Repair"
                            : "Testing"
                          : command.action === "repair.complete"
                            ? "Completed"
                            : command.action === "repair.unrepairable"
                              ? "Unrepairable"
                              : command.action === "repair.return"
                                ? "Returned to User"
                                : command.action === "repair.cancel"
                                  ? "Cancelled"
                                  : String(v.status || r.status)
          ) as Repair["status"];
          if (
            next !== r.status &&
            command.action !== "repair.complete" &&
            !canTransitionRepair(r.status, next)
          )
            throw new Error(
              `Invalid repair transition: ${r.status} to ${next}.`,
            );
          if (
            ["repair.reject", "repair.cancel"].includes(command.action) &&
            !String(v.reason || "").trim()
          )
            throw new Error("A reason is required.");
          if (
            command.action === "repair.unrepairable" &&
            !String(v.diagnosis || r.diagnosis || "").trim()
          )
            throw new Error(
              "Diagnosis is required for an unrepairable outcome.",
            );
          const previous = r.status;
          r.status = next;
          r.diagnosis = String(v.diagnosis || r.diagnosis || "");
          r.rootCause = String(v.rootCause || r.rootCause || "");
          r.externalCompany = String(
            v.externalCompany || r.externalCompany || "",
          );
          r.parts = String(v.parts || r.parts || "");
          r.testResult = String(v.testResult || r.testResult || "");
          r.outcome = String(v.outcome || r.outcome || "");
          if (Array.isArray(v.attachments))
            r.attachments = [
              ...(r.attachments || []),
              ...v.attachments,
            ] as string[];
          if (Array.isArray(v.afterPhotos))
            r.afterPhotos = [
              ...(r.afterPhotos || []),
              ...v.afterPhotos,
            ] as string[];
          r.history = [
            ...(r.history || []),
            {
              id: id("h", (r.history || []).length),
              at: now(),
              user: command.actor || "Naomi Williams",
              type: command.action,
              description: `Repair changed from ${previous} to ${next}.`,
              previous: { status: previous },
              next: { status: next },
              reason: String(v.reason || ""),
            },
          ];
          r.lastUpdated = now();
          const a = this.state.assets.find((x) => x.code === r.assetCode);
          if (a && command.action === "repair.complete") {
            if (!v.assetStatus || !v.condition)
              throw new Error(
                "Resulting asset status and condition are required.",
              );
            a.status = v.assetStatus as AssetStatus;
            a.condition = v.condition as typeof a.condition;
            r.finalAssetStatus = a.status;
            r.finalAssetCondition = a.condition;
            r.completedAt = now();
            r.completedBy = command.actor || "Naomi Williams";
          }
          if (a && command.action === "repair.return")
            a.location = String(v.returnLocation || a.location);
          result = {
            ok: true,
            message: `${r.reference} changed to ${r.status}.`,
            entityId: r.id,
          };
          break;
        }
        case "maintenance.create": {
          const a = this.asset(command.entityId);
          const frequency = String(v.frequency || "Annual"),
            customDays = Number(v.customDays || 0),
            nextDate = String(v.nextDate || today());
          if (!validMaintenanceSchedule(nextDate, frequency, customDays))
            throw new Error("Maintenance schedule is invalid.");
          const m: Maintenance = {
            id: id("mt", this.state.maintenance.length),
            reference: `MNT-${today().slice(0, 4)}-${String(this.state.maintenance.length + 1).padStart(4, "0")}`,
            asset: a.name,
            assetCode: a.code,
            assetId: a.id,
            category: a.category,
            location: a.location,
            department: a.department,
            type: String(v.type || "Preventive inspection"),
            frequency,
            nextDate,
            assignee: String(v.assignee || "Naomi Williams"),
            status: "Scheduled",
            checklist: String(
              v.checklist ||
                "Visual inspection,Functional test,Clean equipment",
            )
              .split(",")
              .map((value) => value.trim()),
            completedItems: [],
            notes: String(v.notes || ""),
            customDays,
            history: [
              {
                id: "h-1",
                at: now(),
                user: command.actor || "Naomi Williams",
                type: "Schedule",
                description: "Maintenance scheduled.",
              },
            ],
            active: true,
            createdBy: command.actor || "Naomi Williams",
            createdAt: now(),
            lastUpdated: now(),
          };
          this.state.maintenance = [m, ...this.state.maintenance];
          result = {
            ok: true,
            message: `Maintenance scheduled for ${a.code}.`,
            entityId: m.id,
          };
          break;
        }
        case "maintenance.edit":
        case "maintenance.start":
        case "maintenance.pause":
        case "maintenance.resume":
        case "maintenance.reschedule":
        case "maintenance.skip":
        case "maintenance.cancel":
        case "maintenance.remind":
        case "maintenance.escalate":
        case "maintenance.complete": {
          const m = this.maintenance(command.entityId);
          if (
            command.action === "maintenance.remind" ||
            command.action === "maintenance.escalate"
          ) {
            m.reminderAt = now();
            if (command.action === "maintenance.escalate")
              m.escalationLevel = (m.escalationLevel || 0) + 1;
            result = {
              ok: true,
              message: `${m.reference || m.id} follow-up recorded.`,
              entityId: m.id,
            };
            break;
          }
          const next = (
            command.action === "maintenance.start"
              ? "In Progress"
              : command.action === "maintenance.pause"
                ? "Paused"
                : command.action === "maintenance.resume"
                  ? "In Progress"
                  : command.action === "maintenance.skip"
                    ? "Skipped"
                    : command.action === "maintenance.cancel"
                      ? "Cancelled"
                      : command.action === "maintenance.complete"
                        ? "Completed"
                        : m.status
          ) as Maintenance["status"];
          if (next !== m.status && !canTransitionMaintenance(m.status, next))
            throw new Error(
              `Invalid maintenance transition: ${m.status} to ${next}.`,
            );
          if (
            [
              "maintenance.skip",
              "maintenance.cancel",
              "maintenance.reschedule",
            ].includes(command.action) &&
            !String(v.reason || "").trim()
          )
            throw new Error("A reason is required.");
          const previous = m.status;
          m.status = next;
          m.notes = String(v.notes || m.notes || "");
          if (command.action === "maintenance.reschedule")
            m.nextDate = String(v.nextDate || m.nextDate);
          if (command.action === "maintenance.complete") {
            if (
              (m.checklist || []).length &&
              String(v.allowIncomplete) !== "true" &&
              v.completedItems &&
              String(v.completedItems).split(",").length <
                (m.checklist || []).length
            )
              throw new Error("Complete every required checklist item.");
            m.completedItems = [...(m.checklist || [])];
            m.lastCompletedAt = now();
            m.nextDate = String(
              v.nextDate ||
                this.nextDate(m.nextDate, m.frequency, m.customDays),
            );
            const asset = this.state.assets.find(
              (value) => value.code === m.assetCode,
            );
            if (asset) {
              asset.status = (v.assetStatus || "Available") as AssetStatus;
              if (v.condition)
                asset.condition = v.condition as Asset["condition"];
            }
          }
          m.history = [
            ...(m.history || []),
            {
              id: id("h", (m.history || []).length),
              at: now(),
              user: command.actor || "Naomi Williams",
              type: command.action,
              description: `Maintenance changed from ${previous} to ${next}.`,
              previous: { status: previous },
              next: { status: next },
              reason: String(v.reason || ""),
            },
          ];
          m.lastUpdated = now();
          result = {
            ok: true,
            message: `Maintenance changed to ${m.status}; next date ${m.nextDate}.`,
            entityId: m.id,
          };
          break;
        }
        case "movement.create": {
          const quantity = Number(v.quantity || 1),
            from = String(v.from || ""),
            to = String(v.to || "");
          if (!validMovement(quantity, from, to))
            throw new Error(
              "Movement quantity, source and destination are invalid.",
            );
          const movement = this.addMovement(
            String(v.type || "Transfer"),
            String(v.asset || "Inventory item"),
            String(v.assetCode || "N/A"),
            quantity,
            String(v.reason || ""),
            from,
            to,
            String(v.approvedBy || ""),
          );
          movement.sourceLocationId =
            String(v.sourceLocationId || "") || undefined;
          movement.destinationLocationId =
            String(v.destinationLocationId || "") || undefined;
          movement.locationId =
            movement.destinationLocationId || movement.sourceLocationId;
          movement.immutable = true;
          movement.relatedType = String(v.relatedType || "Manual");
          movement.relatedId = String(v.relatedId || "");
          result = {
            ok: true,
            message: `Movement ${movement.reference} recorded.`,
            entityId: movement.id,
          };
          break;
        }
        case "movement.correct": {
          const original = this.state.movements.find(
            (x) => x.id === command.entityId,
          );
          if (!original) throw new Error("Original movement not found.");
          if (!String(v.reason || "").trim())
            throw new Error("A correction reason is required.");
          const quantity = Number(v.quantity || original.quantity);
          if (quantity < 0)
            throw new Error("Correction cannot create negative quantity.");
          const correction = this.addMovement(
            `Correction: ${String(v.correctionType || "Reversal")}`,
            original.asset,
            original.assetCode,
            quantity,
            String(v.reason),
            original.to,
            original.from,
            String(v.approvedBy || ""),
          );
          correction.correctsMovementId = original.id;
          correction.correctionType = String(
            v.correctionType || "Full reversal",
          );
          correction.immutable = true;
          result = {
            ok: true,
            message: `Compensating movement ${correction.reference} recorded.`,
            entityId: correction.id,
          };
          break;
        }
        case "movement.approve":
        case "movement.complete": {
          const movement = this.state.movements.find(
            (x) => x.id === command.entityId,
          );
          if (!movement) throw new Error("Movement not found.");
          movement.approvedBy = String(
            v.approvedBy || command.actor || "Naomi Williams",
          );
          result = {
            ok: true,
            message: `${movement.reference} ${command.action.split(".")[1]}.`,
            entityId: movement.id,
          };
          break;
        }
        case "audit.create": {
          const audit: Audit = {
            id: id("au", this.state.audits.length),
            reference: `AUD-2026-${String(this.state.audits.length + 28).padStart(4, "0")}`,
            name: String(v.name || "Inventory audit"),
            description: String(v.description || ""),
            auditType: String(v.auditType || "Random sample audit"),
            scope: String(v.scope || "Mixed inventory"),
            assignee: String(v.assignee || command.actor || "Naomi Williams"),
            assignedAuditors: String(
              v.assignee || command.actor || "Naomi Williams",
            )
              .split(",")
              .map((x) => x.trim()),
            reviewer: String(v.reviewer || ""),
            approver: String(v.approver || ""),
            responsibleDepartment: String(v.department || "ICT"),
            scheduledStart: String(v.startDate || today()),
            deadline: String(v.deadline || today()),
            frequency: String(v.frequency || "One time"),
            progress: 0,
            verified: 0,
            discrepancies: 0,
            status: v.startDate ? "Scheduled" : "Draft",
            selectionMode: String(v.selectionMode || "Mixed"),
            sampleMethod: (v.sampleMethod ||
              "Fixed count") as Audit["sampleMethod"],
            sampleValue: Number(v.count || v.percentage || 5),
            randomSeed: String(v.seed || `KCS-${Date.now()}`),
            sampleFrozen: false,
            results: {},
            correctiveActions: [],
            history: [
              {
                id: "h-1",
                at: now(),
                user: command.actor || "Naomi Williams",
                type: "Creation",
                description: "Audit configuration created.",
              },
            ],
            createdBy: command.actor || "Naomi Williams",
            createdAt: now(),
            lastUpdated: now(),
          };
          this.state.audits = [audit, ...this.state.audits];
          result = {
            ok: true,
            message: `${audit.reference} created as ${audit.status}.`,
            entityId: audit.id,
          };
          break;
        }
        case "audit.generate": {
          let audit = command.entityId
            ? this.audit(command.entityId)
            : undefined;
          if (audit?.sampleFrozen)
            throw new Error("The audit sample is already frozen.");
          const population = [...this.state.assets]
            .filter((asset) => !v.category || asset.category === v.category)
            .filter((asset) => !v.location || asset.location === v.location)
            .filter(
              (asset) => !v.department || asset.department === v.department,
            );
          const method = (v.sampleMethod ||
            (v.percentage ? "Percentage" : "Fixed count")) as
            "Fixed count" | "Percentage" | "Full audit";
          const seed = String(v.seed || audit?.randomSeed || "KCS-AUDIT-SEED");
          const selected = deterministicAuditSelection(population, {
            seed,
            method,
            value: Number(v.percentage || v.count || audit?.sampleValue || 5),
          });
          if (!audit) {
            audit = {
              id: id("au", this.state.audits.length),
              reference: `AUD-2026-${String(this.state.audits.length + 28).padStart(4, "0")}`,
              name: String(v.name || "Random inventory audit"),
              scope: `${selected.length} deterministic random candidates`,
              assignee: String(v.assignee || "Naomi Williams"),
              assignedAuditors: String(v.assignee || "Naomi Williams").split(
                ",",
              ),
              deadline: String(v.deadline || today()),
              progress: 0,
              verified: 0,
              discrepancies: 0,
              status: "Draft",
              selectionMode: String(v.selectionMode || "Mixed"),
              sampleMethod: method,
              sampleValue: Number(v.percentage || v.count || 5),
              results: {},
              correctiveActions: [],
              history: [],
            };
            this.state.audits = [audit, ...this.state.audits];
          }
          audit.randomSeed = seed;
          audit.strategyVersion = "seeded-fisher-yates-v1";
          audit.generatedBy = command.actor || "Naomi Williams";
          audit.generatedAt = now();
          audit.frozenItemIds = selected.map((asset) => asset.id);
          audit.sampleItems = selected.map((asset, index) => ({
            id: `${audit!.id}-item-${index + 1}`,
            recordId: asset.id,
            recordType: "asset",
            code: asset.code,
            name: asset.name,
            category: asset.category,
            location: asset.location,
            department: asset.department,
            expectedStatus: asset.status,
            expectedCondition: asset.condition,
            history: [],
          }));
          audit.status = "Sample Generated";
          audit.history = [
            ...(audit.history || []),
            {
              id: id("h", (audit.history || []).length),
              at: now(),
              user: command.actor || "Naomi Williams",
              type: "Sample generation",
              description: `Generated ${selected.length} items with seed ${seed}.`,
            },
          ];
          result = {
            ok: true,
            message: `${audit.reference} generated with ${selected.length} fixed items.`,
            entityId: audit.id,
          };
          break;
        }
        case "audit.freeze":
        case "audit.prepare":
        case "audit.start":
        case "audit.pause":
        case "audit.resume":
        case "audit.review":
        case "audit.complete":
        case "audit.close":
        case "audit.cancel":
        case "audit.edit": {
          const audit = this.audit(command.entityId);
          if (
            command.action === "audit.edit" &&
            ["Completed", "Closed"].includes(audit.status)
          )
            throw new Error("Finalized audits are immutable.");
          if (command.action === "audit.freeze") {
            if (!audit.sampleItems?.length)
              throw new Error("Generate a sample before freezing.");
            audit.sampleFrozen = true;
          }
          const next = (
            command.action === "audit.freeze"
              ? "Sample Generated"
              : command.action === "audit.prepare"
                ? "Prepared"
                : command.action === "audit.start"
                  ? "In Progress"
                  : command.action === "audit.pause"
                    ? "Paused"
                    : command.action === "audit.resume"
                      ? "In Progress"
                      : command.action === "audit.review"
                        ? "Review Required"
                        : command.action === "audit.complete"
                          ? "Completed"
                          : command.action === "audit.close"
                            ? "Closed"
                            : command.action === "audit.cancel"
                              ? "Cancelled"
                              : audit.status
          ) as Audit["status"];
          if (next !== audit.status && !canTransitionAudit(audit.status, next))
            throw new Error(
              `Invalid audit transition: ${audit.status} to ${next}.`,
            );
          if (
            command.action === "audit.cancel" &&
            !String(v.reason || "").trim()
          )
            throw new Error("Cancellation requires a reason.");
          if (
            command.action === "audit.complete" &&
            !auditCompletionEligible(audit)
          )
            throw new Error(
              "Every required audit item must be resolved before completion.",
            );
          const previous = audit.status;
          audit.status = next;
          if (next === "In Progress" && !audit.actualStart)
            audit.actualStart = now();
          if (next === "Completed") audit.completedAt = now();
          if (next === "Closed") audit.closedAt = now();
          audit.history = [
            ...(audit.history || []),
            {
              id: id("h", (audit.history || []).length),
              at: now(),
              user: command.actor || "Naomi Williams",
              type: command.action,
              description: `Audit changed from ${previous} to ${next}.`,
              previous: { status: previous },
              next: { status: next },
              reason: String(v.reason || ""),
            },
          ];
          result = {
            ok: true,
            message: `${audit.reference} changed to ${next}.`,
            entityId: audit.id,
          };
          break;
        }
        case "audit.verify":
        case "audit.discrepancy": {
          const audit = this.audit(command.entityId);
          const code = String(v.scannedCode || "");
          const item =
            audit.sampleItems?.find((x) => x.code === code && !x.result) ||
            audit.sampleItems?.find((x) => !x.result);
          if (!item) {
            audit.progress = Math.min(100, audit.progress + 10);
            if (command.action === "audit.verify") audit.verified++;
            else audit.discrepancies++;
            result = {
              ok: true,
              message: `Audit result recorded at ${audit.progress}% completion.`,
              entityId: audit.id,
            };
            break;
          }
          const outcome = String(v.outcome || "Verified");
          item.result = outcome;
          item.auditor = command.actor || "Naomi Williams";
          item.verifiedAt = now();
          item.notes = String(v.notes || "");
          if (v.countedQuantity !== undefined) {
            item.countedQuantity = Number(v.countedQuantity);
            item.variance = item.countedQuantity - (item.expectedQuantity || 0);
          }
          const progress = auditProgress(audit.sampleItems || []);
          Object.assign(audit, {
            progress: progress.percentage,
            verified: progress.verified,
            discrepancies: progress.discrepancies,
          });
          audit.results = {
            ...(audit.results || {}),
            [item.recordId]: outcome,
          };
          if (outcome !== "Verified") {
            const discrepancy: AuditDiscrepancy = {
              id: id("dsc", this.state.auditDiscrepancies.length),
              reference: `DSC-${today().slice(0, 4)}-${String(this.state.auditDiscrepancies.length + 1).padStart(4, "0")}`,
              auditId: audit.id,
              auditItemId: item.id,
              recordId: item.recordId,
              recordName: item.name,
              type: outcome,
              severity: discrepancySeverity(
                outcome,
                item.variance,
              ) as AuditDiscrepancy["severity"],
              expectedValue:
                item.expectedQuantity === undefined
                  ? item.location
                  : String(item.expectedQuantity),
              observedValue:
                item.countedQuantity === undefined
                  ? String(v.observedLocation || "Not confirmed")
                  : String(item.countedQuantity),
              variance: item.variance,
              detectedBy: command.actor || "Naomi Williams",
              detectedAt: now(),
              evidence: [],
              notes: item.notes,
              department: item.department,
              status: "Open",
              history: [],
            };
            this.state.auditDiscrepancies = [
              discrepancy,
              ...this.state.auditDiscrepancies,
            ];
          }
          if (audit.progress === 100)
            audit.status = audit.discrepancies
              ? "Review Required"
              : "Review Required";
          result = {
            ok: true,
            message: `Audit result recorded at ${audit.progress}% completion.`,
            entityId: audit.id,
          };
          break;
        }
        case "discrepancy.assign":
        case "discrepancy.recount":
        case "discrepancy.reclassify":
        case "discrepancy.resolve":
        case "discrepancy.escalate":
        case "discrepancy.close": {
          const discrepancy = this.state.auditDiscrepancies.find(
            (x) => x.id === command.entityId,
          );
          if (!discrepancy) throw new Error("Discrepancy not found.");
          if (
            command.action === "discrepancy.reclassify" &&
            !String(v.reason || "").trim()
          )
            throw new Error("Reclassification requires a reason.");
          discrepancy.status =
            command.action === "discrepancy.assign"
              ? "Assigned"
              : command.action === "discrepancy.recount"
                ? "Recount Required"
                : command.action === "discrepancy.resolve"
                  ? "Resolved"
                  : command.action === "discrepancy.escalate"
                    ? "Escalated"
                    : command.action === "discrepancy.close"
                      ? "Closed"
                      : discrepancy.status;
          discrepancy.assignedTo = String(
            v.assignedTo || discrepancy.assignedTo || "Naomi Williams",
          );
          discrepancy.resolution = String(
            v.resolution || discrepancy.resolution || "",
          );
          result = {
            ok: true,
            message: `${discrepancy.reference} changed to ${discrepancy.status}.`,
            entityId: discrepancy.id,
          };
          break;
        }
        case "corrective.create": {
          const discrepancy = this.state.auditDiscrepancies.find(
            (x) => x.id === command.entityId,
          );
          if (!discrepancy) throw new Error("Discrepancy not found.");
          const action: CorrectiveAction = {
            id: id("ca", this.state.correctiveActions.length),
            reference: `CA-${today().slice(0, 4)}-${String(this.state.correctiveActions.length + 1).padStart(4, "0")}`,
            auditId: discrepancy.auditId,
            discrepancyId: discrepancy.id,
            type: String(v.type || "Correct record"),
            description: String(v.description || "Resolve audit discrepancy"),
            owner: String(v.owner || "Naomi Williams"),
            dueDate: String(v.dueDate || today()),
            priority: String(v.priority || discrepancy.severity),
            approvalRequired: String(v.approvalRequired) === "true",
            status: "Assigned",
            history: [],
          };
          this.state.correctiveActions = [
            action,
            ...this.state.correctiveActions,
          ];
          result = {
            ok: true,
            message: `${action.reference} created.`,
            entityId: action.id,
          };
          break;
        }
        case "corrective.assign":
        case "corrective.start":
        case "corrective.approve":
        case "corrective.reject":
        case "corrective.complete":
        case "corrective.verify":
        case "corrective.reopen": {
          const action = this.state.correctiveActions.find(
            (x) => x.id === command.entityId,
          );
          if (!action) throw new Error("Corrective action not found.");
          const next = (
            command.action === "corrective.assign"
              ? "Assigned"
              : command.action === "corrective.start"
                ? "In Progress"
                : command.action === "corrective.approve"
                  ? "Approved"
                  : command.action === "corrective.reject"
                    ? "Rejected"
                    : command.action === "corrective.complete"
                      ? action.approvalRequired
                        ? "Pending Approval"
                        : "Completed"
                      : command.action === "corrective.verify"
                        ? "Verified"
                        : "In Progress"
          ) as CorrectiveAction["status"];
          if (
            next !== action.status &&
            !canTransitionCorrectiveAction(action.status, next) &&
            command.action !== "corrective.reopen"
          )
            throw new Error(
              `Invalid corrective-action transition: ${action.status} to ${next}.`,
            );
          action.status = next;
          action.result = String(v.result || action.result || "");
          action.verifiedBy =
            next === "Verified"
              ? command.actor || "Naomi Williams"
              : action.verifiedBy;
          result = {
            ok: true,
            message: `${action.reference} changed to ${next}.`,
            entityId: action.id,
          };
          break;
        }
        case "disposal.create": {
          const a = this.asset(command.entityId);
          if (
            this.state.borrows.some(
              (b) => b.assetCode === a.code && b.status === "Issued",
            )
          )
            throw new Error(
              "An asset with an active loan cannot enter disposal.",
            );
          const d: Disposal = {
            id: id("dsp", this.state.disposals.length),
            assetId: a.id,
            assetCode: a.code,
            assetName: a.name,
            reason: String(
              v.reason || "End of useful life assessment requested",
            ),
            status: "Requested",
            requestedBy: String(
              v.requestedBy || command.actor || "Naomi Williams",
            ),
            requestedAt: today(),
            technicalAssessment: String(v.technicalAssessment || ""),
            estimatedValue: Number(v.estimatedValue || 0),
            method: String(v.method || ""),
            inspectionNotes: String(v.notes || ""),
            attachments: (v.attachments || []) as string[],
          };
          a.status = "Reserved";
          a.lastUpdated = today();
          a.lastModifiedBy = command.actor || "Naomi Williams";
          this.state.disposals = [d, ...this.state.disposals];
          result = {
            ok: true,
            message: `Disposal request created for ${a.code}.`,
            entityId: d.id,
          };
          break;
        }
        case "disposal.inspect":
        case "disposal.approve":
        case "disposal.reject":
        case "disposal.method":
        case "disposal.complete":
        case "disposal.archive": {
          const d = this.disposal(command.entityId);
          const status: Disposal["status"] =
            command.action === "disposal.inspect"
              ? "Inspected"
              : command.action === "disposal.approve"
                ? "Approved"
                : command.action === "disposal.reject"
                  ? "Rejected"
                  : command.action === "disposal.method"
                    ? "Method Selected"
                    : command.action === "disposal.complete"
                      ? "Completed"
                      : "Permanently Archived";
          if (status === "Approved" && d.status !== "Inspected")
            throw new Error("Inspection is required before approval.");
          if (status === "Method Selected" && d.status !== "Approved")
            throw new Error(
              "Approval is required before selecting a disposal method.",
            );
          if (status === "Completed" && d.status !== "Method Selected")
            throw new Error("A disposal method is required before completion.");
          if (status === "Permanently Archived" && d.status !== "Completed")
            throw new Error("Completion is required before permanent archive.");
          d.status = status;
          d.inspectionNotes = String(
            v.notes || d.inspectionNotes || "Inspection recorded.",
          );
          d.decisionReason = String(
            v.reason || d.decisionReason || "Authorized lifecycle decision.",
          );
          d.method = String(v.method || d.method || "Other authorized method");
          d.technicalAssessment = String(
            v.technicalAssessment || d.technicalAssessment || "",
          );
          d.estimatedValue = Number(v.estimatedValue || d.estimatedValue || 0);
          if (status === "Completed") {
            const asset = this.asset(d.assetId);
            asset.status = "Disposed";
            d.completionDate = today();
            d.finalHandler = String(v.finalHandler || "Authorized handler");
            this.addMovement("Disposal", asset.name, asset.code, 1, d.reason);
          }
          if (status === "Permanently Archived")
            this.asset(d.assetId).status = "Archived";
          result = {
            ok: true,
            message: `Disposal ${d.id} changed to ${status}.`,
            entityId: d.id,
          };
          break;
        }
        case "reference.create": {
          const kind = (v.kind || "category") as ReferenceRecord["kind"],
            name = String(v.name || "New reference").trim(),
            parentLocationId =
              String(
                v.containerLocationId || v.parentLocationId || v.parentId || "",
              ) || null;
          if (
            kind === "location" &&
            this.state.references.some(
              (x) =>
                x.kind === "location" &&
                x.status === "Active" &&
                x.name.trim().toLowerCase() === name.toLowerCase() &&
                (x.containerLocationId ||
                  x.parentLocationId ||
                  x.parentId ||
                  null) === parentLocationId,
            )
          )
            throw new Error(
              "An active location with this name and parent already exists.",
            );
          const record: ReferenceRecord = {
            id: id(String(kind).slice(0, 3), this.state.references.length),
            kind,
            name,
            type: String(v.type || "General"),
            typeId: String(v.typeId || "") || undefined,
            parent: String(v.parent || "") || undefined,
            parentId: parentLocationId || undefined,
            parentLocationId,
            mainLocationId: String(v.mainLocationId || "") || null,
            containerLocationId: parentLocationId,
            managerId: String(v.managerId || "") || null,
            managerUserId: String(v.managerUserId || v.managerId || "") || null,
            status: ([
              "Active",
              "Inactive",
              "Temporarily closed",
              "Archived",
            ].includes(String(v.status))
              ? v.status
              : "Active") as ReferenceRecord["status"],
            relatedCount: 0,
            details: (v.details || {}) as ReferenceRecord["details"],
            createdAt: now(),
            updatedAt: now(),
            createdBy: command.actor || "Naomi Williams",
            updatedBy: command.actor || "Naomi Williams",
          };
          this.state.references = [record, ...this.state.references];
          result = {
            ok: true,
            message: `${record.name} was created.`,
            entityId: record.id,
          };
          break;
        }
        case "reference.edit": {
          const record = this.reference(command.entityId),
            parentLocationId =
              String(
                v.containerLocationId ??
                  v.parentLocationId ??
                  v.parentId ??
                  record.parentLocationId ??
                  "",
              ) || null;
          if (
            record.kind === "location" &&
            !validateLocationMove(
              record.id,
              parentLocationId || undefined,
              this.state.references
                .filter((x) => x.kind === "location")
                .map((x) => ({
                  id: x.id,
                  parent:
                    x.containerLocationId || x.parentLocationId || x.parentId,
                })),
            )
          )
            throw new Error(
              "A location cannot be its own parent or be moved beneath a descendant.",
            );
          if (
            record.kind === "location" &&
            this.state.references.some(
              (x) =>
                x.id !== record.id &&
                x.kind === "location" &&
                x.status === "Active" &&
                x.name.trim().toLowerCase() ===
                  String(v.name ?? record.name)
                    .trim()
                    .toLowerCase() &&
                (x.containerLocationId ||
                  x.parentLocationId ||
                  x.parentId ||
                  null) === parentLocationId,
            )
          )
            throw new Error(
              "An active location with this name and parent already exists.",
            );
          Object.assign(record, v, {
            parentId: parentLocationId || undefined,
            parentLocationId,
            containerLocationId: parentLocationId,
            updatedAt: now(),
            updatedBy: command.actor || "Naomi Williams",
          });
          result = {
            ok: true,
            message: `${record.name} was updated.`,
            entityId: record.id,
          };
          break;
        }
        case "reference.delete":
        case "reference.archive":
        case "reference.restore": {
          const record = this.reference(command.entityId);
          if (
            command.action === "reference.delete" &&
            record.kind === "location"
          ) {
            const activeAssets = this.state.assets.filter(
              (asset) =>
                (asset.currentLocationId === record.id ||
                  (!asset.currentLocationId &&
                    asset.location === record.name)) &&
                !["Disposed", "Archived"].includes(asset.status),
            ).length;
            const activeChildren = this.state.references.filter(
              (item) =>
                item.kind === "location" &&
                item.status === "Active" &&
                item.containerLocationId === record.id,
            ).length;
            const assetCodes = new Set(
              this.state.assets
                .filter((asset) => asset.currentLocationId === record.id)
                .map((asset) => asset.code),
            );
            const tasks =
              this.state.maintenance.filter(
                (task) =>
                  task.status !== "Completed" &&
                  (task.locationId === record.id ||
                    assetCodes.has(task.assetCode)),
              ).length +
              this.state.repairs.filter(
                (task) =>
                  task.status !== "Completed" && assetCodes.has(task.assetCode),
              ).length;
            if (activeAssets || activeChildren || tasks)
              throw new Error(
                `This location cannot be archived because it still contains ${activeAssets} active assets, ${activeChildren} active sub-locations, and ${tasks} open tasks. Transfer or resolve these records before archiving the location.`,
              );
          } else if (
            command.action === "reference.delete" &&
            record.relatedCount > 0
          )
            throw new Error("Resolve active related records before archiving.");
          if (command.action === "reference.delete") {
            this.state.references = this.state.references.filter(
              (item) => item.id !== record.id,
            );
            result = {
              ok: true,
              message: `${record.name} was permanently deleted.`,
              entityId: record.id,
            };
            break;
          }
          record.status =
            command.action === "reference.archive" ? "Archived" : "Active";
          result = {
            ok: true,
            message: `${record.name} was ${record.status.toLowerCase()}.`,
            entityId: record.id,
          };
          break;
        }
        case "locationType.create": {
          const name = String(v.name || "").trim(),
            code = String(v.code || "")
              .trim()
              .toUpperCase();
          if (!name || !code) throw new Error("Name and code are required.");
          if (
            this.state.locationTypes.some(
              (x) =>
                x.name.toLowerCase() === name.toLowerCase() || x.code === code,
            )
          )
            throw new Error("Location type name and code must be unique.");
          const type: LocationType = {
            id: id("lt", this.state.locationTypes.length),
            name,
            code,
            description: String(v.description || ""),
            isActive: true,
            sortOrder: this.state.locationTypes.length + 1,
            allowedParentTypeIds: (v.allowedParentTypeIds || []) as string[],
            createdAt: now(),
            updatedAt: now(),
          };
          this.state.locationTypes = [...this.state.locationTypes, type];
          result = {
            ok: true,
            message: `${type.name} was created.`,
            entityId: type.id,
          };
          break;
        }
        case "locationType.edit": {
          const type = this.locationType(command.entityId);
          const code = String(v.code ?? type.code)
              .trim()
              .toUpperCase(),
            name = String(v.name ?? type.name).trim();
          if (
            this.state.locationTypes.some(
              (x) =>
                x.id !== type.id &&
                (x.code === code ||
                  x.name.toLowerCase() === name.toLowerCase()),
            )
          )
            throw new Error("Location type name and code must be unique.");
          Object.assign(type, v, { name, code, updatedAt: now() });
          result = {
            ok: true,
            message: `${type.name} was updated.`,
            entityId: type.id,
          };
          break;
        }
        case "locationType.activate":
        case "locationType.deactivate": {
          const type = this.locationType(command.entityId);
          type.isActive = command.action === "locationType.activate";
          type.updatedAt = now();
          result = {
            ok: true,
            message: `${type.name} was ${type.isActive ? "activated" : "deactivated"}.`,
            entityId: type.id,
          };
          break;
        }
        case "locationType.reorder": {
          const type = this.locationType(command.entityId),
            direction = Number(v.direction || 0),
            ordered = [...this.state.locationTypes].sort(
              (a, b) => a.sortOrder - b.sortOrder,
            ),
            index = ordered.findIndex((x) => x.id === type.id),
            swap = ordered[index + direction];
          if (swap) {
            [type.sortOrder, swap.sortOrder] = [swap.sortOrder, type.sortOrder];
            type.updatedAt = now();
            swap.updatedAt = now();
          }
          result = {
            ok: true,
            message: "Location type order updated.",
            entityId: type.id,
          };
          break;
        }
        case "locationType.delete": {
          const type = this.locationType(command.entityId);
          if (
            this.state.references.some(
              (x) =>
                x.kind === "location" &&
                (x.typeId === type.id || (!x.typeId && x.type === type.name)),
            )
          )
            throw new Error(
              "This type is used by a location. Deactivate it instead.",
            );
          this.state.locationTypes = this.state.locationTypes.filter(
            (x) => x.id !== type.id,
          );
          result = {
            ok: true,
            message: `${type.name} was deleted.`,
            entityId: type.id,
          };
          break;
        }
        case "codeGroup.create": {
          const name = String(v.name || "").trim(),
            prefix = String(v.prefix || "")
              .trim()
              .toUpperCase(),
            minimumNumber = Number(v.minimumNumber),
            maximumNumber = Number(v.maximumNumber),
            nextAvailableNumber = Number(v.nextAvailableNumber);
          if (!name || !prefix)
            throw new Error("Name and prefix are required.");
          if (
            minimumNumber < 0 ||
            maximumNumber < minimumNumber ||
            nextAvailableNumber < minimumNumber ||
            nextAvailableNumber > maximumNumber
          )
            throw new Error(
              "Number range and next available number are invalid.",
            );
          if (
            this.state.codeGroups.some(
              (x) =>
                x.prefix === prefix ||
                x.name.toLowerCase() === name.toLowerCase(),
            )
          )
            throw new Error("Code group name and prefix must be unique.");
          const group: CodeGroup = {
            id: id("cg", this.state.codeGroups.length),
            name,
            prefix,
            minimumNumber,
            maximumNumber,
            nextAvailableNumber,
            isActive: true,
            sortOrder: this.state.codeGroups.length + 1,
            createdAt: now(),
            updatedAt: now(),
          };
          this.state.codeGroups = [...this.state.codeGroups, group];
          result = {
            ok: true,
            message: `${group.name} was created.`,
            entityId: group.id,
          };
          break;
        }
        case "codeGroup.edit": {
          const group = this.codeGroup(command.entityId),
            name = String(v.name ?? group.name).trim(),
            prefix = String(v.prefix ?? group.prefix)
              .trim()
              .toUpperCase(),
            minimumNumber = Number(v.minimumNumber ?? group.minimumNumber),
            maximumNumber = Number(v.maximumNumber ?? group.maximumNumber),
            nextAvailableNumber = Number(
              v.nextAvailableNumber ?? group.nextAvailableNumber,
            );
          if (
            minimumNumber < 0 ||
            maximumNumber < minimumNumber ||
            nextAvailableNumber < minimumNumber ||
            nextAvailableNumber > maximumNumber
          )
            throw new Error(
              "Number range and next available number are invalid.",
            );
          if (
            this.state.codeGroups.some(
              (x) =>
                x.id !== group.id &&
                (x.prefix === prefix ||
                  x.name.toLowerCase() === name.toLowerCase()),
            )
          )
            throw new Error("Code group name and prefix must be unique.");
          Object.assign(group, {
            name,
            prefix,
            minimumNumber,
            maximumNumber,
            nextAvailableNumber,
            updatedAt: now(),
          });
          result = {
            ok: true,
            message: `${group.name} was updated.`,
            entityId: group.id,
          };
          break;
        }
        case "codeGroup.activate":
        case "codeGroup.deactivate": {
          const group = this.codeGroup(command.entityId);
          group.isActive = command.action === "codeGroup.activate";
          group.updatedAt = now();
          result = {
            ok: true,
            message: `${group.name} was ${group.isActive ? "activated" : "deactivated"}.`,
            entityId: group.id,
          };
          break;
        }
        case "codeGroup.reorder": {
          const group = this.codeGroup(command.entityId),
            direction = Number(v.direction || 0),
            ordered = [...this.state.codeGroups].sort(
              (a, b) => a.sortOrder - b.sortOrder,
            ),
            index = ordered.findIndex((x) => x.id === group.id),
            swap = ordered[index + direction];
          if (swap) {
            [group.sortOrder, swap.sortOrder] = [
              swap.sortOrder,
              group.sortOrder,
            ];
            group.updatedAt = now();
            swap.updatedAt = now();
          }
          result = {
            ok: true,
            message: "Code group order updated.",
            entityId: group.id,
          };
          break;
        }
        case "codeGroup.delete": {
          const group = this.codeGroup(command.entityId);
          group.archived = true;
          group.isActive = false;
          group.deletionReason = String(v.reason || "").trim();
          group.updatedAt = now();
          result = {
            ok: true,
            message: `${group.name} was moved to the recycle bin.`,
            entityId: group.id,
          };
          break;
        }
        case "codeGroup.restore": {
          const group = this.codeGroup(command.entityId);
          group.archived = false;
          group.isActive = true;
          group.deletionReason = undefined;
          group.updatedAt = now();
          result = {
            ok: true,
            message: `${group.name} was restored.`,
            entityId: group.id,
          };
          break;
        }
        case "user.create": {
          const user: SystemUser = {
            id: id("usr", this.state.users.length),
            name: String(v.name || "New user"),
            email: String(v.email || ""),
            role: String(v.role || "Warehouse Staff"),
            department: String(v.department || "Warehouse"),
            status: "Active",
            lastLogin: "Never",
          };
          if (!user.email.includes("@"))
            throw new Error("A valid email address is required.");
          this.state.users = [user, ...this.state.users];
          result = {
            ok: true,
            message: `${user.name} was created.`,
            entityId: user.id,
          };
          break;
        }
        case "user.edit": {
          const user = this.user(command.entityId);
          Object.assign(user, v);
          result = {
            ok: true,
            message: `${user.name} was updated.`,
            entityId: user.id,
          };
          break;
        }
        case "user.activate":
        case "user.deactivate": {
          const user = this.user(command.entityId);
          user.status =
            command.action === "user.activate" ? "Active" : "Inactive";
          result = {
            ok: true,
            message: `${user.name} is now ${user.status.toLowerCase()}.`,
            entityId: user.id,
          };
          break;
        }
        case "role.create": {
          const role: RoleRecord = {
            id: id("role", this.state.roles.length),
            name: String(v.name || "Custom role"),
            description: String(v.description || ""),
            permissions: (v.permissions || []) as string[],
            system: false,
          };
          this.state.roles = [role, ...this.state.roles];
          result = {
            ok: true,
            message: `Role ${role.name} was created.`,
            entityId: role.id,
          };
          break;
        }
        case "role.edit": {
          const role = this.role(command.entityId);
          if (role.system)
            throw new Error(
              "System roles cannot be edited in the mock environment.",
            );
          Object.assign(role, v);
          result = {
            ok: true,
            message: `Role ${role.name} was updated.`,
            entityId: role.id,
          };
          break;
        }
        case "report.create": {
          const report: ReportDefinition = {
            id: id("repdef", this.state.reports.length),
            name: String(v.name || "Custom report"),
            description: String(v.description || ""),
            reportType: String(v.reportType || "Custom"),
            category: String(v.category || "Custom"),
            version: 1,
            frequency: "On demand",
            format: String(v.format || "CSV"),
            scheduled: false,
            columns: String(v.columns || "code,name,status")
              .split(",")
              .map((x) => x.trim()),
            filters: {},
            metrics: String(v.metrics || "recordCount").split(","),
            exportFormats: ["CSV", "Excel", "Print"],
            requiredPermissions: ["reports.view"],
            shared: String(v.shared) === "true",
            createdBy: command.actor || "Naomi Williams",
            createdAt: now(),
            lastUpdated: now(),
          };
          this.state.reports = [report, ...this.state.reports];
          result = {
            ok: true,
            message: `${report.name} definition saved.`,
            entityId: report.id,
          };
          break;
        }
        case "report.edit":
        case "report.archive":
        case "report.restore": {
          const report = this.state.reports.find(
            (x) => x.id === command.entityId,
          );
          if (!report) throw new Error("Report definition not found.");
          if (command.action === "report.edit") {
            report.name = String(v.name || report.name);
            report.version = (report.version || 1) + 1;
            report.lastUpdated = now();
          } else report.archived = command.action === "report.archive";
          result = {
            ok: true,
            message: `${report.name} updated.`,
            entityId: report.id,
          };
          break;
        }
        case "report.generate": {
          const report =
            this.state.reports.find((value) => value.id === command.entityId) ||
            this.state.reports[0];
          if (!report) throw new Error("Report not found.");
          const rows = this.reportRows(
            String(report.category || report.reportType || "Assets"),
          );
          const generatedAt = now();
          const generated: ReportResult = {
            id: id("result", this.state.reportResults.length),
            definitionId: report.id,
            reportType: String(report.reportType || report.category),
            title: report.name,
            parameters: v,
            filters: report.filters || {},
            grouping: report.grouping,
            snapshotAt: generatedAt,
            generatedBy: command.actor || "Naomi Williams",
            generatedAt,
            recordCount: rows.length,
            metrics: {
              recordCount: rows.length,
              assets: this.state.assets.length,
              inventoryItems: this.state.inventory.length,
            },
            chartData: { status: [] },
            rows,
            warnings: ["Mock repository snapshot; not trusted backend data."],
            missingData: [],
            permissionExclusions: [],
            formats: report.exportFormats || ["CSV", "Excel", "Print"],
            status: "Completed with Warnings",
          };
          this.state.reportResults = [generated, ...this.state.reportResults];
          report.lastGenerated = generatedAt;
          result = {
            ok: true,
            message: `${report.name} preview generated with ${rows.length} records.`,
            entityId: generated.id,
          };
          break;
        }
        case "report.export":
        case "report.print": {
          const generated = this.state.reportResults.find(
            (x) => x.id === command.entityId,
          );
          if (!generated) throw new Error("Generated report not found.");
          if (!generated.rows.length)
            throw new Error("Empty reports cannot be exported.");
          result = {
            ok: true,
            message: `${generated.title} ${command.action === "report.print" ? "print preview prepared" : "export prepared"}.`,
            entityId: generated.id,
          };
          break;
        }
        case "report.schedule.create": {
          const schedule: ScheduledReport = {
            id: id("schedule", this.state.scheduledReports.length),
            definitionId: String(v.definitionId || command.entityId || ""),
            name: String(v.name || "Scheduled report"),
            recurrence: (v.recurrence ||
              "Monthly") as ScheduledReport["recurrence"],
            nextRun: String(
              v.nextRun ||
                nextScheduledRun(
                  today(),
                  (v.recurrence || "Monthly") as ScheduledReport["recurrence"],
                ),
            ),
            timeZone: String(v.timeZone || "America/Cayenne"),
            recipients: String(v.recipients || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
            active: true,
            createdBy: command.actor || "Naomi Williams",
          };
          if (!schedule.recipients.length)
            throw new Error("At least one valid recipient is required.");
          this.state.scheduledReports = [
            schedule,
            ...this.state.scheduledReports,
          ];
          result = {
            ok: true,
            message: `${schedule.name} scheduled; no real delivery will occur.`,
            entityId: schedule.id,
          };
          break;
        }
        case "report.schedule.edit":
        case "report.schedule.pause":
        case "report.schedule.resume":
        case "report.schedule.run": {
          const schedule = this.state.scheduledReports.find(
            (x) => x.id === command.entityId,
          );
          if (!schedule) throw new Error("Scheduled report not found.");
          if (command.action === "report.schedule.pause")
            schedule.active = false;
          if (command.action === "report.schedule.resume")
            schedule.active = true;
          if (command.action === "report.schedule.run") {
            schedule.lastRun = now();
            schedule.nextRun = nextScheduledRun(
              schedule.nextRun,
              schedule.recurrence,
            );
          }
          result = {
            ok: true,
            message: `${schedule.name} updated; no real delivery occurred.`,
            entityId: schedule.id,
          };
          break;
        }
        case "notification.create": {
          const sourceEventId = String(
              v.sourceEventId ||
                command.entityId ||
                id("event", this.state.notifications.length),
            ),
            recipient = String(v.recipient || "current-user"),
            type = String(v.type || "Operational"),
            relatedId = String(v.relatedId || "");
          const key = notificationKey(
            sourceEventId,
            recipient,
            type,
            relatedId,
          );
          if (
            this.state.notifications.some(
              (item) =>
                notificationKey(
                  item.sourceEventId || item.id,
                  item.recipient || "current-user",
                  item.type || "Operational",
                  item.relatedId || "",
                ) === key,
            )
          )
            throw new Error("Duplicate notification suppressed.");
          const notification = {
            id: id("n", this.state.notifications.length),
            title: String(v.title || type),
            message: String(v.message || "Operational notification"),
            category: (v.category || "info") as "info",
            time: "Now",
            read: false,
            type,
            sourceEventId,
            recipient,
            relatedId,
            severity: (v.severity || "Informational") as "Informational",
            createdAt: now(),
            dismissed: false,
          };
          this.state.notifications = [
            notification,
            ...this.state.notifications,
          ];
          result = {
            ok: true,
            message: "Notification created.",
            entityId: notification.id,
          };
          break;
        }
        case "notification.read":
        case "notification.unread":
        case "notification.dismiss":
        case "notification.restore":
        case "notification.escalate":
        case "notification.resolve": {
          const n = this.state.notifications.find(
            (x) => x.id === command.entityId,
          );
          if (!n) throw new Error("Notification not found.");
          if (command.action === "notification.read") {
            n.read = true;
            n.acknowledgedAt = now();
          }
          if (command.action === "notification.unread") n.read = false;
          if (command.action === "notification.dismiss") n.dismissed = true;
          if (command.action === "notification.restore") n.dismissed = false;
          if (command.action === "notification.escalate")
            n.escalationLevel = (n.escalationLevel || 0) + 1;
          if (command.action === "notification.resolve") {
            n.read = true;
            n.dismissed = true;
          }
          result = {
            ok: true,
            message: "Notification updated.",
            entityId: n.id,
          };
          break;
        }
        case "notification.readAll": {
          this.state.notifications.forEach(
            (notification) => (notification.read = true),
          );
          result = {
            ok: true,
            message: "All notifications marked as read.",
            entityId: "notifications",
          };
          break;
        }
        case "settings.appearance":
          result = {
            ok: true,
            message: "Appearance preference saved locally.",
            entityId: "appearance",
          };
          break;
        case "settings.hierarchyValidation": {
          const mode = String(v.mode);
          if (!["strict", "warning", "disabled"].includes(mode))
            throw new Error("Invalid hierarchy validation mode.");
          this.state.systemSettings.hierarchyValidationMode = mode as
            "strict" | "warning" | "disabled";
          result = {
            ok: true,
            message: "Hierarchy validation mode updated.",
            entityId: "hierarchyValidation",
          };
          break;
        }
      }
      if (result.ok && command.action === "assignment.create") {
        const assignment = this.state.assignments.find(
          (item) => item.id === result.entityId,
        );
        if (assignment) {
          const asset = this.asset(assignment.assetId);
          asset.status = "Assigned";
          asset.condition = "Good";
        }
      }
      if (
        result.ok &&
        ["repair.create", "repair.start"].includes(command.action)
      ) {
        const repair = this.state.repairs.find(
          (item) => item.id === result.entityId || item.id === command.entityId,
        );
        if (repair) {
          const asset = this.state.assets.find(
            (item) => item.code === repair.assetCode,
          );
          if (asset) {
            asset.status = "Under Repair";
            asset.condition = "Good";
          }
        }
      }
      if (result.ok && command.action === "asset.archive") {
        const asset = this.asset(command.entityId);
        asset.condition = "Good";
      }
      if (result.ok && command.action === "disposal.archive") {
        const disposal = this.state.disposals.find(
          (item) => item.id === command.entityId,
        );
        if (disposal) this.asset(disposal.assetId).condition = "Good";
      }
      this.recordAutomaticHistory(command, result, historyBefore);
    } catch (error) {
      result = {
        ok: false,
        message: error instanceof Error ? error.message : "Operation failed.",
        entityId: command.entityId,
      };
    }
    return this.finish(command, result);
  }
  private asset(entityId?: string) {
    const value = this.state.assets.find(
      (x) => x.id === (entityId || this.state.assets[0]?.id),
    );
    if (!value) throw new Error("Asset not found.");
    return value;
  }
  private locationType(entityId?: string) {
    const value = this.state.locationTypes.find((x) => x.id === entityId);
    if (!value) throw new Error("Location type not found.");
    return value;
  }
  private codeGroup(entityId?: string) {
    const value = this.state.codeGroups.find((x) => x.id === entityId);
    if (!value) throw new Error("Code group not found.");
    return value;
  }
  private item(entityId?: string) {
    const value = this.state.inventory.find(
      (x) => x.id === (entityId || this.state.inventory[0]?.id),
    );
    if (!value) throw new Error("Inventory item not found.");
    return value;
  }
  private assignment(entityId?: string) {
    const value = this.state.assignments.find((x) => x.id === entityId);
    if (!value) throw new Error("Assignment not found.");
    return value;
  }
  private reservation(entityId?: string) {
    const value = this.state.reservations.find((x) => x.id === entityId);
    if (!value) throw new Error("Reservation not found.");
    return value;
  }
  private borrow(entityId?: string) {
    const value = this.state.borrows.find(
      (x) => x.id === (entityId || this.state.borrows[0]?.id),
    );
    if (!value) throw new Error("Borrow record not found.");
    return value;
  }
  private repair(entityId?: string) {
    const value = this.state.repairs.find(
      (x) => x.id === (entityId || this.state.repairs[0]?.id),
    );
    if (!value) throw new Error("Repair not found.");
    return value;
  }
  private maintenance(entityId?: string) {
    const value = this.state.maintenance.find(
      (x) => x.id === (entityId || this.state.maintenance[0]?.id),
    );
    if (!value) throw new Error("Maintenance record not found.");
    return value;
  }
  private audit(entityId?: string) {
    const value = this.state.audits.find(
      (x) => x.id === (entityId || this.state.audits[0]?.id),
    );
    if (!value) throw new Error("Audit not found.");
    return value;
  }
  private disposal(entityId?: string) {
    const value = this.state.disposals.find(
      (x) => x.id === (entityId || this.state.disposals[0]?.id),
    );
    if (!value) throw new Error("Disposal request not found.");
    return value;
  }
  private reference(entityId?: string) {
    const value = this.state.references.find((x) => x.id === entityId);
    if (!value) throw new Error("Reference record not found.");
    return value;
  }
  private user(entityId?: string) {
    const value = this.state.users.find((x) => x.id === entityId);
    if (!value) throw new Error("User not found.");
    return value;
  }
  private role(entityId?: string) {
    const value = this.state.roles.find((x) => x.id === entityId);
    if (!value) throw new Error("Role not found.");
    return value;
  }
  private reportRows(category: string): Record<string, unknown>[] {
    const key = category.toLowerCase();
    if (key.includes("inventory") || key.includes("stock"))
      return this.state.inventory.map((item) => ({ ...item }));
    if (key.includes("borrow"))
      return this.state.borrows.map((item) => ({ ...item }));
    if (key.includes("repair"))
      return this.state.repairs.map((item) => ({ ...item }));
    if (key.includes("maintenance"))
      return this.state.maintenance.map((item) => ({ ...item }));
    if (key.includes("movement"))
      return this.state.movements.map((item) => ({ ...item }));
    if (key.includes("audit"))
      return this.state.audits.map((item) => ({ ...item }));
    if (key.includes("disposal"))
      return this.state.disposals.map((item) => ({ ...item }));
    return this.state.assets.map((item) => ({ ...item }));
  }
  private addMovement(
    type: string,
    asset: string,
    assetCode: string,
    quantity: number,
    reason = "",
    from = "Current location",
    to = "Destination",
    approvedBy = "",
    attachments: string[] = [],
  ) {
    const movement: Movement = {
      id: id("mv", this.state.movements.length),
      reference: `MOV-${today().replaceAll("-", "")}-${this.state.movements.length + 1}`,
      type,
      asset,
      assetCode,
      from,
      to,
      by: "Naomi Williams",
      date: now(),
      quantity,
      reason,
      approvedBy,
      attachments,
    };
    this.state.movements = [movement, ...this.state.movements];
    return movement;
  }
  private addInventoryMovement(
    type: string,
    item: InventoryItem,
    quantity: number,
    previousQuantity: number,
    newQuantity: number,
    reason: string,
    source?: string,
    destination?: string,
  ) {
    const movement: InventoryMovement = {
      id: id("imv", this.state.inventoryMovements.length),
      reference: `IMV-${today().replaceAll("-", "")}-${this.state.inventoryMovements.length + 1}`,
      type,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      quantity,
      previousQuantity,
      newQuantity,
      source,
      destination,
      reason,
      date: now(),
      performedBy: "Naomi Williams",
    };
    this.state.inventoryMovements = [
      movement,
      ...this.state.inventoryMovements,
    ];
    return movement;
  }
  private nextDate(date: string, frequency: string, customDays = 0) {
    const d = new Date(date);
    if (frequency === "Weekly") d.setDate(d.getDate() + 7);
    else if (frequency === "Custom interval" && customDays)
      d.setDate(d.getDate() + customDays);
    else {
      const months =
        frequency === "Monthly"
          ? 1
          : frequency === "Quarterly"
            ? 3
            : frequency.includes("six")
              ? 6
              : 12;
      d.setMonth(d.getMonth() + months);
    }
    return d.toISOString().slice(0, 10);
  }
}

export class MockInventoryRepository extends WorkflowRepositoryEngine {
  private currentActor?: string;

  setActor(actor?: string) {
    this.currentActor = actor;
  }

  override execute(command: WorkflowCommand) {
    return super.execute({
      ...command,
      actor: command.actor || this.currentActor || "Unknown user",
    });
  }
}

const repository = new MockInventoryRepository();
export function MockRepositoryProvider({ children }: { children: ReactNode }) {
  const { user } = useApp();
  repository.setActor(user?.name || user?.email);
  return (
    <RepositoryProvider repository={repository}>{children}</RepositoryProvider>
  );
}
