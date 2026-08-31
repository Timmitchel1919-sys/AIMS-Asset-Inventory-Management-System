/**
 * Phase 3 — one-way export (Firestore -> Google Sheet).
 *
 * This module is PURE: it turns plain collection arrays into the exact
 * `{ tabName: string[][] }` matrix defined by the Phase 2 workbook spec.
 * It never reads Firestore, never calls the Sheets API, and never writes
 * anything back. All network work lives in ./sheetsClient.js.
 *
 * The tab order and every header row below are the contract the sheet is
 * built against — keep them byte-for-byte in step with the spec.
 */

import { createHash } from "node:crypto";

export const TAB_ORDER = [
  "Master Inventory",
  "Inventory Stock",
  "History Log",
  "Locations",
  "Departments",
  "Categories",
  "Code Groups",
  "Trash",
  "Sync Log",
];

export const TAB_HEADERS = {
  "Master Inventory": [
    "Name", "Category", "Subcategory", "Type", "Brand", "Model",
    "Serial Number", "MAC Address", "IMEI", "Location", "Department",
    "Assigned To", "Responsible Employee", "Status", "Condition",
    "Purchase Date", "Warranty Expiry", "Supplier", "Technical Specs",
    "Notes", "Previous Codes", "Source Row",
    "Record ID", "Business Code", "Sync Version", "Sync Status", "Source",
    "Updated At", "Updated By", "Last Synced At", "Deleted At", "Row Hash",
  ],
  "Inventory Stock": [
    "Item Name", "Item Type", "Category", "Brand", "Model", "Manufacturer",
    "Supplier", "Supplier Item Code", "Unit", "On Hand", "Reserved",
    "Minimum", "Reorder Level", "Reorder Quantity", "Qty Ordered", "Order ID",
    "Order Placed", "Expected Delivery", "Warehouse", "Storage Room", "Shelf",
    "Location", "Unit Cost", "Currency", "Notes",
    "Record ID", "Business Code", "Sync Version", "Sync Status", "Source",
    "Updated At", "Updated By", "Last Synced At", "Deleted At", "Row Hash",
  ],
  "History Log": [
    "Asset Code", "Asset Record ID", "Occurred At", "Event Type", "Category",
    "Title", "Description", "Issue", "Solution", "Notes", "Previous", "Next",
    "Performed By", "Source", "Import Batch", "Original Legacy Text",
    "Correction",
    "Record ID", "Sync Version", "Sync Status", "Updated At", "Updated By",
    "Last Synced At", "Row Hash",
  ],
  "Locations": [
    "Name", "Type", "Parent Location", "Main Location", "Manager", "Status",
    "Direct Asset Count", "Sub-Location Count", "Open Task Count", "Notes",
    "Record ID", "Business Code", "Sync Version", "Sync Status", "Source",
    "Updated At", "Updated By", "Last Synced At", "Deleted At", "Row Hash",
  ],
  "Departments": [
    "Name", "Manager", "Status", "Related Count", "Notes",
    "Record ID", "Business Code", "Sync Version", "Sync Status", "Source",
    "Updated At", "Updated By", "Last Synced At", "Deleted At", "Row Hash",
  ],
  "Categories": [
    "Name", "Parent Category", "Status", "Related Count", "Notes",
    "Record ID", "Business Code", "Sync Version", "Sync Status", "Source",
    "Updated At", "Updated By", "Last Synced At", "Deleted At", "Row Hash",
  ],
  "Code Groups": [
    "Name", "Prefix", "Minimum Number", "Maximum Number",
    "Next Available Number", "Active", "Sort Order",
    "Record ID", "Business Code", "Sync Version", "Sync Status", "Source",
    "Updated At", "Updated By", "Last Synced At", "Deleted At", "Row Hash",
  ],
  "Trash": [
    "Entity", "Record ID", "Business Code", "Name", "Trashed At", "Trashed By",
    "Reason", "Restore", "Sync Status",
  ],
  "Sync Log": [
    "Sync Event ID", "At", "Direction", "Entity", "Record ID", "Operation",
    "Result", "Sync Version", "Detail", "Attempts",
  ],
};

/* ------------------------------------------------------------------ helpers */

const SENSITIVE_KEY = /pass|pwd|wifi|wachtwoord|credential|secret|token|api[_-]?key/i;

const s = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

/** Firestore Timestamp | Date | ISO string | {_seconds} -> ISO 8601 (or ""). */
export const iso = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return "";
    }
  }
  const seconds = value._seconds ?? value.seconds;
  if (typeof seconds === "number") return new Date(seconds * 1000).toISOString();
  return "";
};

/** Flatten a spec map to "k: v; k: v", dropping credential-like keys. */
const flattenSpecs = (specs) => {
  if (!specs || typeof specs !== "object") return "";
  return Object.entries(specs)
    .filter(([key]) => !SENSITIVE_KEY.test(key))
    .map(([key, val]) => `${key}: ${s(val)}`.trim())
    .filter(Boolean)
    .join("; ");
};

const list = (value) => {
  if (Array.isArray(value)) return value.map(s).filter(Boolean).join(", ");
  return s(value);
};

const snippet = (value, max = 500) => {
  if (value === null || value === undefined || value === "") return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const rowHash = (cells) =>
  createHash("sha1").update(cells.map(s).join("␟")).digest("hex").slice(0, 16);

// System columns S3 (Sync Version) and S5 (Source). Phase 3 seeded 0 / "AIMS";
// once the Phase 4 write-back engine has touched a doc these reflect its state.
const syncVersionOf = (x) => s(x.syncVersion ?? 0);
const syncSourceOf = (x) => (x.syncSource === "SHEETS" ? "SHEETS" : "AIMS");

const isArchivedAsset = (a) =>
  a.status === "Archived" || a.isArchived === true || a.archived === true;
const isArchivedInventory = (i) => i.archived === true || i.isArchived === true;
const isArchivedRef = (r) =>
  r.status === "Archived" || r.isArchived === true || r.archived === true;
const isArchivedCodeGroup = (g) => g.archived === true || g.isArchived === true;

/* -------------------------------------------------------------- row builders */

function assetRow(a, syncedAt) {
  const editable = [
    a.name, a.category, a.subcategory, a.type, a.brand, a.model,
    a.serialNumber, a.barcode, "", a.location, a.department,
    a.assignedTo, a.responsibleEmployee, a.status, a.condition,
    iso(a.purchaseDate), iso(a.warrantyExpiry), a.supplier, flattenSpecs(a.technicalSpecifications),
    a.notes, list(a.previousCodes),
  ].map(s);
  // MAC / IMEI live in technicalSpecifications for most legacy rows; surface
  // them explicitly when present as first-class fields.
  editable[7] = s(a.macAddress || a.mac || "");
  editable[8] = s(a.imei || "");
  const sourceRow = a.importMetadata
    ? [a.importMetadata.sourceRecordCode, a.importMetadata.source].filter(Boolean).join(" @ ")
    : "";
  const system = [
    a.id,
    a.code || "",
    syncVersionOf(a),
    "SYNCED",
    syncSourceOf(a),
    iso(a.updatedAt || a.lastUpdated),
    s(a.updatedBy || a.lastModifiedBy),
    syncedAt,
    "",
  ];
  const cells = [...editable, sourceRow, ...system];
  cells.push(rowHash(editable));
  return cells;
}

function inventoryRow(i, syncedAt) {
  const editable = [
    i.name, i.itemType, i.category, i.brand, i.model, i.manufacturer,
    i.supplier, i.supplierItemCode, i.unit,
    i.onHand ?? 0, i.reserved ?? 0, i.minimum ?? 0,
    i.reorderLevel ?? "", i.reorderQuantity ?? "", i.qtyOrdered ?? "",
    i.orderId ?? "", iso(i.orderPlaced), iso(i.expectedDelivery),
    i.warehouse, i.storageRoom, i.shelf, i.location,
    i.unitCost ?? "", i.currency ?? "", i.notes,
  ].map(s);
  const system = [
    i.id,
    i.code || "",
    syncVersionOf(i),
    "SYNCED",
    syncSourceOf(i),
    iso(i.updatedAt || i.lastUpdated),
    s(i.updatedBy || i.modifiedBy),
    syncedAt,
    "",
  ];
  const cells = [...editable, ...system];
  cells.push(rowHash(editable));
  return cells;
}

function historyRow(e, syncedAt) {
  const editable = [
    e.assetCode, e.assetId, iso(e.occurredAt), e.eventType, e.category,
    e.title, snippet(e.description), e.issue, e.solution, e.notes,
    snippet(e.previous, 200), snippet(e.next, 200),
    e.performedBy || e.createdBy, e.source, e.importBatchId,
    snippet(e.originalLegacyText, 400),
    "", // Correction — always blank on export
  ].map(s);
  const system = [
    e.id,
    syncVersionOf(e),
    "SYNCED",
    iso(e.updatedAt || e.createdAt),
    s(e.updatedBy || e.createdBy),
    syncedAt,
  ];
  const cells = [...editable, ...system];
  cells.push(rowHash(editable));
  return cells;
}

function locationRow(r, syncedAt) {
  const editable = [
    r.name, r.type, r.parent || r.parentName || "", r.mainLocationName || "",
    r.managerName || r.managerId || "", r.status,
    r.directAssetCount ?? "", r.directSubLocationCount ?? "", r.openTaskCount ?? "",
    r.details?.notes || r.notes || "",
  ].map(s);
  const system = [
    r.id, "", syncVersionOf(r), "SYNCED", syncSourceOf(r),
    iso(r.updatedAt), s(r.updatedBy), syncedAt, "",
  ];
  const cells = [...editable, ...system];
  cells.push(rowHash(editable));
  return cells;
}

function departmentRow(r, syncedAt) {
  const editable = [
    r.name, r.managerName || r.managerId || "", r.status, r.relatedCount ?? "",
    r.details?.notes || r.notes || "",
  ].map(s);
  const system = [
    r.id, "", syncVersionOf(r), "SYNCED", syncSourceOf(r),
    iso(r.updatedAt), s(r.updatedBy), syncedAt, "",
  ];
  const cells = [...editable, ...system];
  cells.push(rowHash(editable));
  return cells;
}

function categoryRow(r, syncedAt) {
  const editable = [
    r.name, r.parent || r.parentName || "", r.status, r.relatedCount ?? "",
    r.details?.notes || r.notes || "",
  ].map(s);
  const system = [
    r.id, "", syncVersionOf(r), "SYNCED", syncSourceOf(r),
    iso(r.updatedAt), s(r.updatedBy), syncedAt, "",
  ];
  const cells = [...editable, ...system];
  cells.push(rowHash(editable));
  return cells;
}

function codeGroupRow(g, syncedAt) {
  const editable = [
    g.name, g.prefix, g.minimumNumber ?? "", g.maximumNumber ?? "",
    g.nextAvailableNumber ?? "", g.isActive === false ? "FALSE" : "TRUE",
    g.sortOrder ?? "",
  ].map(s);
  const system = [
    g.id, g.prefix || "", syncVersionOf(g), "SYNCED", syncSourceOf(g),
    iso(g.updatedAt), s(g.updatedBy), syncedAt, "",
  ];
  const cells = [...editable, ...system];
  cells.push(rowHash(editable));
  return cells;
}

function trashRow(entity, id, businessCode, name, at, by, reason) {
  return [entity, id, businessCode, name, iso(at), s(by), s(reason), "", "TRASHED"];
}

/* --------------------------------------------------------------- entry point */

/**
 * @param {object} collections plain arrays of `{ id, ...docData }`
 * @param {{ syncedAt?: string }} [opts]
 * @returns {Record<string, string[][]>} tab -> [headerRow, ...dataRows]
 */
export function buildWorkbook(collections, opts = {}) {
  const {
    assets = [],
    inventoryItems = [],
    assetHistoryEvents = [],
    locations = [],
    departments = [],
    categories = [],
    codeGroups = [],
  } = collections;
  const syncedAt = opts.syncedAt || new Date().toISOString();

  const out = {};
  for (const tab of TAB_ORDER) out[tab] = [TAB_HEADERS[tab].slice()];
  // Phase 3 writes with valueInputOption=RAW: every cell is a string so the
  // sheet contents are fully predictable. A later phase can promote numeric
  // columns to real numbers.
  const push = (tab, cells) => out[tab].push(cells.map(s));

  for (const a of assets) {
    if (isArchivedAsset(a)) continue;
    push("Master Inventory", assetRow(a, syncedAt));
  }
  for (const i of inventoryItems) {
    if (isArchivedInventory(i)) continue;
    push("Inventory Stock", inventoryRow(i, syncedAt));
  }
  for (const e of assetHistoryEvents) {
    if (e.isArchived === true) continue;
    push("History Log", historyRow(e, syncedAt));
  }
  for (const r of locations) {
    if (isArchivedRef(r)) continue;
    push("Locations", locationRow(r, syncedAt));
  }
  for (const r of departments) {
    if (isArchivedRef(r)) continue;
    push("Departments", departmentRow(r, syncedAt));
  }
  for (const r of categories) {
    if (isArchivedRef(r)) continue;
    push("Categories", categoryRow(r, syncedAt));
  }
  for (const g of codeGroups) {
    if (isArchivedCodeGroup(g)) continue;
    push("Code Groups", codeGroupRow(g, syncedAt));
  }

  for (const a of assets) {
    if (!isArchivedAsset(a)) continue;
    push("Trash", trashRow("Asset", a.id, a.code || "", a.name, a.archivedAt || a.updatedAt, a.archivedBy || a.updatedBy, a.deletionReason || a.archiveReason));
  }
  for (const i of inventoryItems) {
    if (!isArchivedInventory(i)) continue;
    push("Trash", trashRow("Inventory Item", i.id, i.code || "", i.name, i.archivedAt || i.updatedAt, i.archivedBy || i.updatedBy, i.archiveReason));
  }
  for (const r of locations) {
    if (!isArchivedRef(r)) continue;
    push("Trash", trashRow("Location", r.id, "", r.name, r.archivedAt || r.updatedAt, r.archivedBy || r.updatedBy, r.deletionReason));
  }
  for (const r of departments) {
    if (!isArchivedRef(r)) continue;
    push("Trash", trashRow("Department", r.id, "", r.name, r.archivedAt || r.updatedAt, r.archivedBy || r.updatedBy, r.deletionReason));
  }
  for (const r of categories) {
    if (!isArchivedRef(r)) continue;
    push("Trash", trashRow("Category", r.id, "", r.name, r.archivedAt || r.updatedAt, r.archivedBy || r.updatedBy, r.deletionReason));
  }
  for (const g of codeGroups) {
    if (!isArchivedCodeGroup(g)) continue;
    push("Trash", trashRow("Code Group", g.id, g.prefix || "", g.name, g.updatedAt, g.updatedBy, g.deletionReason));
  }

  // Sync Log: no engine yet in Phase 3 — header only.
  return out;
}
