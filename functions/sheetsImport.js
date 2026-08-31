/**
 * Phase 4 — Sheets -> AIMS write-back PLANNER (pure).
 *
 * Given the sheet rows and the current Firestore docs, produce a plan of what
 * would change. It writes nothing. `applyImport.js` executes an approved plan.
 *
 * Policy (hybrid, per the Phase 2 spec §11):
 *   - identifier fields  -> a change is a CONFLICT, never applied
 *   - manual fields      -> a change is a CONFLICT, never applied (status /
 *                           location / assignment / reference links)
 *   - apply fields       -> free text / numbers; the sheet value wins
 * A row with ANY conflicting field is held whole — nothing on that row is
 * applied until a human resolves it.
 *
 * New rows (blank Record ID): Locations / Departments / Categories / Code Groups
 * are created; Master Inventory and Inventory Stock rows are only REPORTED
 * (needsAimsCreate) — asset-code allocation is deferred to a later phase.
 */

const ASSET_STATUS = new Set([
  "Available", "Assigned", "Borrowed", "Under Repair", "Under Maintenance",
  "Reserved", "Lost", "Missing", "Damaged", "Disposed", "Archived",
]);
const CONDITION = new Set([
  "New", "Excellent", "Good", "Fair", "Poor", "Defective", "Beyond Repair",
]);
const REF_STATUS = new Set([
  "Active", "Inactive", "Temporarily closed", "Archived",
]);

const str = (v) => (v === null || v === undefined ? "" : String(v).trim());
const isBlank = (v) => str(v) === "";

/** Parse a sheet cell to the value we would store. `kind` drives coercion. */
function coerce(kind, raw) {
  const value = str(raw);
  if (kind === "int") {
    if (value === "") return { ok: true, value: null };
    const n = Number(value);
    return Number.isInteger(n)
      ? { ok: true, value: n }
      : { ok: false, error: `"${value}" is not a whole number` };
  }
  if (kind === "number") {
    if (value === "") return { ok: true, value: null };
    const n = Number(value);
    return Number.isFinite(n)
      ? { ok: true, value: n }
      : { ok: false, error: `"${value}" is not a number` };
  }
  if (kind === "bool") {
    const t = value.toLowerCase();
    if (["true", "yes", "1", "ja"].includes(t)) return { ok: true, value: true };
    if (["false", "no", "0", "nee", ""].includes(t))
      return { ok: true, value: false };
    return { ok: false, error: `"${value}" is not true/false` };
  }
  if (kind === "date") {
    if (value === "") return { ok: true, value: "" };
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? { ok: false, error: `"${value}" is not a date` }
      : { ok: true, value: d.toISOString() };
  }
  return { ok: true, value };
}

/** How the current stored value should look as a trimmed string, for diffing. */
function currentAsString(kind, stored) {
  if (stored === null || stored === undefined) return "";
  if (kind === "bool") return stored ? "true" : "false";
  if (kind === "date") {
    const d = new Date(stored);
    return Number.isNaN(d.getTime()) ? String(stored) : d.toISOString();
  }
  return String(stored).trim();
}

const sheetAsCompare = (kind, raw) => {
  const c = coerce(kind, raw);
  if (!c.ok) return { bad: c.error };
  if (kind === "bool") return { text: c.value ? "true" : "false", value: c.value };
  if (kind === "int" || kind === "number")
    return { text: c.value === null ? "" : String(c.value), value: c.value };
  if (kind === "date") return { text: c.value || "", value: c.value || "" };
  return { text: c.value, value: c.value };
};

const get = (doc, path) =>
  path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), doc);

/**
 * Field maps: sheet header -> { path, policy, kind }
 *   policy: "apply" | "manual" | "identifier" | "ignore"
 *   kind:   "text" (default) | "int" | "number" | "bool" | "date"
 */
export const FIELD_SPECS = {
  "Master Inventory": {
    collection: "assets",
    canCreate: false,
    fields: {
      Name: { path: "name", policy: "apply" },
      Category: { path: "category", policy: "manual" },
      Subcategory: { path: "subcategory", policy: "apply" },
      Type: { path: "type", policy: "apply" },
      Brand: { path: "brand", policy: "apply" },
      Model: { path: "model", policy: "apply" },
      "Serial Number": { path: "serialNumber", policy: "identifier" },
      "MAC Address": { path: "macAddress", policy: "apply" },
      IMEI: { path: "imei", policy: "apply" },
      Location: { path: "location", policy: "manual" },
      Department: { path: "department", policy: "manual" },
      "Assigned To": { path: "assignedTo", policy: "manual" },
      "Responsible Employee": { path: "responsibleEmployee", policy: "apply" },
      Status: { path: "status", policy: "manual" },
      Condition: { path: "condition", policy: "manual" },
      "Purchase Date": { path: "purchaseDate", policy: "apply", kind: "date" },
      "Warranty Expiry": { path: "warrantyExpiry", policy: "apply", kind: "date" },
      Supplier: { path: "supplier", policy: "apply" },
      "Technical Specs": { path: "technicalSpecifications", policy: "ignore" },
      Notes: { path: "notes", policy: "apply" },
      "Previous Codes": { path: "previousCodes", policy: "ignore" },
      "Source Row": { path: "importMetadata", policy: "ignore" },
    },
  },
  "Inventory Stock": {
    collection: "inventoryItems",
    canCreate: false,
    fields: {
      "Item Name": { path: "name", policy: "apply" },
      "Item Type": { path: "itemType", policy: "apply" },
      Category: { path: "category", policy: "manual" },
      Brand: { path: "brand", policy: "apply" },
      Model: { path: "model", policy: "apply" },
      Manufacturer: { path: "manufacturer", policy: "apply" },
      Supplier: { path: "supplier", policy: "apply" },
      "Supplier Item Code": { path: "supplierItemCode", policy: "apply" },
      Unit: { path: "unit", policy: "apply" },
      "On Hand": { path: "onHand", policy: "identifier", kind: "int" },
      Reserved: { path: "reserved", policy: "identifier", kind: "int" },
      Minimum: { path: "minimum", policy: "apply", kind: "int" },
      "Reorder Level": { path: "reorderLevel", policy: "apply", kind: "int" },
      "Reorder Quantity": { path: "reorderQuantity", policy: "apply", kind: "int" },
      "Qty Ordered": { path: "qtyOrdered", policy: "apply", kind: "int" },
      "Order ID": { path: "orderId", policy: "apply" },
      "Order Placed": { path: "orderPlaced", policy: "apply", kind: "date" },
      "Expected Delivery": { path: "expectedDelivery", policy: "apply", kind: "date" },
      Warehouse: { path: "warehouse", policy: "apply" },
      "Storage Room": { path: "storageRoom", policy: "apply" },
      Shelf: { path: "shelf", policy: "apply" },
      Location: { path: "location", policy: "manual" },
      "Unit Cost": { path: "unitCost", policy: "apply", kind: "number" },
      Currency: { path: "currency", policy: "apply" },
      Notes: { path: "notes", policy: "apply" },
    },
  },
  Locations: {
    collection: "locations",
    canCreate: true,
    kind: "location",
    fields: {
      Name: { path: "name", policy: "apply" },
      Type: { path: "type", policy: "apply" },
      "Parent Location": { path: "parent", policy: "manual" },
      "Main Location": { path: "mainLocationName", policy: "manual" },
      Manager: { path: "managerName", policy: "manual" },
      Status: { path: "status", policy: "manual" },
      "Direct Asset Count": { path: "directAssetCount", policy: "ignore" },
      "Sub-Location Count": { path: "directSubLocationCount", policy: "ignore" },
      "Open Task Count": { path: "openTaskCount", policy: "ignore" },
      Notes: { path: "details.notes", policy: "apply" },
    },
  },
  Departments: {
    collection: "departments",
    canCreate: true,
    kind: "department",
    fields: {
      Name: { path: "name", policy: "apply" },
      Manager: { path: "managerName", policy: "manual" },
      Status: { path: "status", policy: "manual" },
      "Related Count": { path: "relatedCount", policy: "ignore" },
      Notes: { path: "details.notes", policy: "apply" },
    },
  },
  Categories: {
    collection: "categories",
    canCreate: true,
    kind: "category",
    fields: {
      Name: { path: "name", policy: "apply" },
      "Parent Category": { path: "parent", policy: "manual" },
      Status: { path: "status", policy: "manual" },
      "Related Count": { path: "relatedCount", policy: "ignore" },
      Notes: { path: "details.notes", policy: "apply" },
    },
  },
  "Code Groups": {
    collection: "codeGroups",
    canCreate: true,
    fields: {
      Name: { path: "name", policy: "apply" },
      Prefix: { path: "prefix", policy: "identifier" },
      "Minimum Number": { path: "minimumNumber", policy: "identifier", kind: "int" },
      "Maximum Number": { path: "maximumNumber", policy: "identifier", kind: "int" },
      "Next Available Number": {
        path: "nextAvailableNumber", policy: "identifier", kind: "int",
      },
      Active: { path: "isActive", policy: "apply", kind: "bool" },
      "Sort Order": { path: "sortOrder", policy: "apply", kind: "int" },
    },
  },
};

const IMPORT_TABS = Object.keys(FIELD_SPECS);

// Data tabs whose `Status` = "Archived" cell is read as a soft-delete intent.
const TRASH_VIA_STATUS = {
  "Master Inventory": "assets",
  Locations: "locations",
  Departments: "departments",
  Categories: "categories",
};
const ENTITY_COLLECTION = {
  Asset: "assets",
  "Inventory Item": "inventoryItems",
  Location: "locations",
  Department: "departments",
  Category: "categories",
  "Code Group": "codeGroups",
};
const docArchived = (d) =>
  !!d && (d.status === "Archived" || d.archived === true || d.isArchived === true);

function rowObject(header, row) {
  const obj = {};
  header.forEach((h, i) => {
    obj[h] = row[i] ?? "";
  });
  return obj;
}

function validateCreate(tab, spec, data, existingByPrefix) {
  const errors = [];
  if (isBlank(data.name)) errors.push("Name is required");
  if (data.name && String(data.name).length > 100)
    errors.push("Name exceeds 100 characters");
  if (data.status && !REF_STATUS.has(data.status))
    errors.push(`Status "${data.status}" is not valid`);
  if (tab === "Code Groups") {
    if (!/^[A-Z0-9]{1,16}$/.test(str(data.prefix)))
      errors.push("Prefix must be 1–16 chars, A–Z and 0–9 only");
    else if (existingByPrefix.has(str(data.prefix)))
      errors.push(`Prefix "${data.prefix}" already exists`);
    const min = data.minimumNumber, max = data.maximumNumber;
    if (!Number.isInteger(min) || min < 1) errors.push("Minimum Number must be an integer ≥ 1");
    if (!Number.isInteger(max) || max > 5000) errors.push("Maximum Number must be an integer ≤ 5000");
    if (Number.isInteger(min) && Number.isInteger(max) && max < min)
      errors.push("Maximum Number must be ≥ Minimum Number");
  }
  return errors;
}

/**
 * @param {object} input
 * @param {Record<string,string[][]>} input.workbook  tab -> [header, ...rows] (raw sheet values)
 * @param {Record<string,object[]>}   input.current   collection -> [{id,...doc}]
 * @param {{ syncedAt?: string }} [opts]
 */
export function planImport({ workbook, current }, opts = {}) {
  const syncedAt = opts.syncedAt || new Date().toISOString();
  const plan = {
    ok: true,
    applied: false,
    syncedAt,
    updates: [],
    creates: [],
    trashes: [],
    restores: [],
    conflicts: [],
    corrections: [],
    needsAimsCreate: [],
    errors: [],
  };

  const byId = {};
  for (const [coll, docs] of Object.entries(current || {})) {
    byId[coll] = new Map((docs || []).map((d) => [d.id, d]));
  }
  const codeGroupPrefixes = new Set(
    (current?.codeGroups || []).map((g) => str(g.prefix)),
  );

  for (const tab of IMPORT_TABS) {
    const grid = workbook[tab];
    if (!grid || grid.length < 2) continue;
    const spec = FIELD_SPECS[tab];
    const header = grid[0].map(str);
    const idCol = header.indexOf("Record ID");
    const verCol = header.indexOf("Sync Version");

    for (let r = 1; r < grid.length; r++) {
      const rawRow = grid[r];
      if (!rawRow || !rawRow.some((c) => str(c) !== "")) continue;
      const rowNum = r + 1; // 1-based sheet row (header is row 1)
      const obj = rowObject(header, rawRow);
      const recordId = idCol >= 0 ? str(rawRow[idCol]) : "";

      /* ---------- new row ---------- */
      if (!recordId) {
        if (!spec.canCreate) {
          plan.needsAimsCreate.push({
            tab, row: rowNum,
            preview: { name: str(obj.Name || obj["Item Name"]) },
          });
          continue;
        }
        const data = {};
        let coerceError = null;
        for (const [head, f] of Object.entries(spec.fields)) {
          if (f.policy === "ignore") continue;
          const c = coerce(f.kind || "text", obj[head]);
          if (!c.ok) { coerceError = `${head}: ${c.error}`; break; }
          if (f.path.includes(".")) {
            const [p0, p1] = f.path.split(".");
            data[p0] = data[p0] || {};
            data[p0][p1] = c.value;
          } else {
            data[f.path] = c.value;
          }
        }
        if (coerceError) {
          plan.errors.push({ tab, row: rowNum, message: coerceError });
          continue;
        }
        const errs = validateCreate(tab, spec, data, codeGroupPrefixes);
        if (errs.length) {
          plan.errors.push({ tab, row: rowNum, message: errs.join("; ") });
          continue;
        }
        if (tab === "Code Groups") codeGroupPrefixes.add(str(data.prefix));
        plan.creates.push({
          tab, row: rowNum, collection: spec.collection,
          kind: spec.kind || null, data,
        });
        continue;
      }

      /* ---------- existing row ---------- */
      const doc = byId[spec.collection]?.get(recordId);
      if (!doc) {
        plan.conflicts.push({
          tab, row: rowNum, recordId,
          reason: "unknown-record",
          detail: "No AIMS record with this Record ID (deleted or wrong id).",
        });
        continue;
      }

      const baseVersion = Number(verCol >= 0 ? str(rawRow[verCol]) : "0") || 0;
      const docVersion = Number(doc.syncVersion ?? 0) || 0;

      /* ---------- soft-delete intent: Status cell set to "Archived" ---------- */
      if (TRASH_VIA_STATUS[tab]) {
        const wantsArchive = str(obj.Status).toLowerCase() === "archived";
        if (docArchived(doc) && !wantsArchive) {
          plan.conflicts.push({
            tab, row: rowNum, recordId,
            reason: "record-archived",
            detail: "This record is archived in AIMS. Restore it from the Trash tab; don't edit a re-added row.",
          });
          continue;
        }
        if (wantsArchive) {
          if (docArchived(doc)) continue; // already trashed — no-op
          if (baseVersion !== docVersion) {
            plan.conflicts.push({
              tab, row: rowNum, recordId, reason: "stale-version",
              detail: `Sheet Sync Version ${baseVersion} ≠ AIMS ${docVersion}; re-export before trashing.`,
              fields: ["Status"],
            });
            continue;
          }
          plan.trashes.push({
            tab, row: rowNum, recordId,
            collection: spec.collection, baseVersion,
          });
          continue;
        }
      }

      const changes = {};
      const conflictFields = [];
      const patch = {};
      let badCell = null;
      for (const [head, f] of Object.entries(spec.fields)) {
        if (f.policy === "ignore") continue;
        const kind = f.kind || "text";
        const cmp = sheetAsCompare(kind, obj[head]);
        if (cmp.bad) { badCell = `${head}: ${cmp.bad}`; break; }
        const before = currentAsString(kind, get(doc, f.path));
        if (cmp.text === before) continue; // unchanged
        changes[head] = { from: before, to: cmp.text };
        if (f.policy === "identifier" || f.policy === "manual") {
          conflictFields.push(head);
        } else {
          if (f.path.includes(".")) {
            const [p0, p1] = f.path.split(".");
            patch[p0] = patch[p0] || { ...(doc[p0] || {}) };
            patch[p0][p1] = cmp.value;
          } else {
            patch[f.path] = cmp.value;
          }
        }
      }
      if (badCell) {
        plan.errors.push({ tab, row: rowNum, recordId, message: badCell });
        continue;
      }
      if (Object.keys(changes).length === 0) continue; // nothing to do

      if (baseVersion !== docVersion) {
        plan.conflicts.push({
          tab, row: rowNum, recordId,
          reason: "stale-version",
          detail: `Sheet Sync Version ${baseVersion} ≠ AIMS ${docVersion}; the record changed in AIMS since the last export. Re-export, re-apply your edit.`,
          fields: Object.keys(changes),
        });
        continue;
      }
      if (conflictFields.length) {
        plan.conflicts.push({
          tab, row: rowNum, recordId,
          reason: "protected-field",
          detail: `Held for manual review — these fields are AIMS-authoritative or need a human decision: ${conflictFields.join(", ")}.`,
          fields: conflictFields,
          changes,
        });
        continue;
      }
      plan.updates.push({
        tab, row: rowNum, recordId, collection: spec.collection,
        baseVersion, changes, patch,
      });
    }
  }

  /* ---------- History Log corrections ---------- */
  const hist = workbook["History Log"];
  if (hist && hist.length > 1) {
    const header = hist[0].map(str);
    const cCol = header.indexOf("Correction");
    const acCol = header.indexOf("Asset Code");
    const arCol = header.indexOf("Asset Record ID");
    for (let r = 1; r < hist.length; r++) {
      const row = hist[r] || [];
      const text = cCol >= 0 ? str(row[cCol]) : "";
      if (!text) continue;
      plan.corrections.push({
        row: r + 1,
        assetId: arCol >= 0 ? str(row[arCol]) : "",
        assetCode: acCol >= 0 ? str(row[acCol]) : "",
        text: text.slice(0, 2000),
      });
    }
  }

  /* ---------- Trash tab: Restore = "RESTORE" ---------- */
  const trashGrid = workbook["Trash"];
  if (trashGrid && trashGrid.length > 1) {
    const header = trashGrid[0].map(str);
    const eCol = header.indexOf("Entity");
    const idCol = header.indexOf("Record ID");
    const rCol = header.indexOf("Restore");
    for (let r = 1; r < trashGrid.length; r++) {
      const row = trashGrid[r] || [];
      if (rCol < 0 || str(row[rCol]).toUpperCase() !== "RESTORE") continue;
      const rowNum = r + 1;
      const entity = eCol >= 0 ? str(row[eCol]) : "";
      const recordId = idCol >= 0 ? str(row[idCol]) : "";
      const collection = ENTITY_COLLECTION[entity];
      if (!collection || !recordId) {
        plan.errors.push({
          tab: "Trash", row: rowNum,
          message: `Restore needs a known Entity and Record ID (got "${entity}" / "${recordId}").`,
        });
        continue;
      }
      const doc = byId[collection]?.get(recordId);
      if (!doc) {
        plan.conflicts.push({
          tab: "Trash", row: rowNum, recordId,
          reason: "unknown-record",
          detail: `No ${entity} in AIMS with this Record ID.`,
        });
        continue;
      }
      plan.restores.push({
        tab: "Trash", row: rowNum, recordId, collection, entity,
        alreadyActive: !docArchived(doc),
      });
    }
  }

  /* ---------- a record trashed AND restored in the same run ---------- */
  const restoreIds = new Set(plan.restores.map((x) => x.recordId));
  if (restoreIds.size) {
    plan.trashes = plan.trashes.filter((t) => {
      if (!restoreIds.has(t.recordId)) return true;
      plan.conflicts.push({
        tab: t.tab, row: t.row, recordId: t.recordId,
        reason: "contradictory",
        detail: "Same record is set to trash on a data tab and RESTORE on the Trash tab. Resolve one.",
      });
      return false;
    });
    plan.restores = plan.restores.filter((x) => {
      const clash = plan.conflicts.some(
        (c) => c.reason === "contradictory" && c.recordId === x.recordId,
      );
      return !clash;
    });
  }

  plan.summary = {
    updates: plan.updates.length,
    creates: plan.creates.length,
    trashes: plan.trashes.length,
    restores: plan.restores.length,
    conflicts: plan.conflicts.length,
    corrections: plan.corrections.length,
    needsAimsCreate: plan.needsAimsCreate.length,
    errors: plan.errors.length,
  };
  return plan;
}

/**
 * Phase 6 — build a patch that force-applies specific held fields for ONE row.
 * Used by `resolveSyncConflict` when an admin decides the sheet's value wins for
 * a `protected-field` (manual-policy) conflict. Identifier fields are refused.
 *
 * @param {{ tab: string, header: string[], row: string[], doc: object, fields: string[] }} args
 * @returns {{ collection: string, baseVersion: number, patch: object, changes: object, noop: string[], errors: string[] }}
 */
export function forcePatch({ tab, header, row, doc, fields }) {
  const spec = FIELD_SPECS[tab];
  const errors = [];
  if (!spec) return { collection: null, baseVersion: 0, patch: {}, changes: {}, noop: [], errors: [`Unknown tab "${tab}"`] };

  const obj = rowObject(header.map(str), row);
  const verCol = header.map(str).indexOf("Sync Version");
  const baseVersion = Number(verCol >= 0 ? str(row[verCol]) : "0") || 0;

  const patch = {};
  const changes = {};
  const noop = [];

  for (const field of fields || []) {
    const f = spec.fields[field];
    if (!f) { errors.push(`Unknown field "${field}"`); continue; }
    if (f.policy === "identifier") {
      errors.push(`"${field}" is an identifier field and cannot be force-applied here`);
      continue;
    }
    const c = coerce(f.kind || "text", obj[field]);
    if (!c.ok) { errors.push(`${field}: ${c.error}`); continue; }

    const v = c.value;
    if (field === "Status" && tab === "Master Inventory" && v && !ASSET_STATUS.has(v))
      { errors.push(`Status "${v}" is not a valid asset status`); continue; }
    if (field === "Condition" && v && !CONDITION.has(v))
      { errors.push(`Condition "${v}" is not valid`); continue; }
    if (field === "Status" && tab !== "Master Inventory" && v && !REF_STATUS.has(v))
      { errors.push(`Status "${v}" is not valid`); continue; }

    const before = currentAsString(f.kind || "text", get(doc, f.path));
    const after = f.kind === "bool" ? (v ? "true" : "false")
      : f.kind === "int" || f.kind === "number" ? (v === null ? "" : String(v))
      : f.kind === "date" ? (v || "")
      : v;
    if (before === after) { noop.push(field); continue; }

    if (f.path.includes(".")) {
      const [p0, p1] = f.path.split(".");
      patch[p0] = patch[p0] || { ...(doc[p0] || {}) };
      patch[p0][p1] = v;
    } else {
      patch[f.path] = v;
    }
    changes[field] = { from: before, to: after };
  }

  return { collection: spec.collection, baseVersion, patch, changes, noop, errors };
}

export const collectionForTab = (tab) => FIELD_SPECS[tab]?.collection || null;

export { IMPORT_TABS, ASSET_STATUS, CONDITION, REF_STATUS };
