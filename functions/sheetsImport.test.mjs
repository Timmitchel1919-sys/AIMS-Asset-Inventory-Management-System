import { test } from "node:test";
import assert from "node:assert/strict";
import { planImport, forcePatch, FIELD_SPECS } from "./sheetsImport.js";

// Build a tab grid from a header list + row objects.
function grid(tab, rows) {
  const header = [
    ...Object.keys(FIELD_SPECS[tab]?.fields || {}),
    "Record ID", "Business Code", "Sync Version", "Sync Status", "Source",
    "Updated At", "Updated By", "Last Synced At", "Deleted At", "Row Hash",
  ];
  const body = rows.map((r) => header.map((h) => (h in r ? String(r[h]) : "")));
  return [header, ...body];
}

test("unchanged row produces no update", () => {
  const plan = planImport({
    workbook: {
      Departments: grid("Departments", [
        { Name: "ICT", Status: "Active", "Record ID": "dep-1", "Sync Version": "0" },
      ]),
    },
    current: { departments: [{ id: "dep-1", name: "ICT", status: "Active", syncVersion: 0 }] },
  });
  assert.equal(plan.summary.updates, 0);
  assert.equal(plan.summary.conflicts, 0);
});

test("apply-field edit becomes an update with a patch", () => {
  const plan = planImport({
    workbook: {
      Departments: grid("Departments", [
        { Name: "ICT & Media", Status: "Active", "Record ID": "dep-1", "Sync Version": "0" },
      ]),
    },
    current: { departments: [{ id: "dep-1", name: "ICT", status: "Active", syncVersion: 0 }] },
  });
  assert.equal(plan.summary.updates, 1);
  assert.deepEqual(plan.updates[0].patch, { name: "ICT & Media" });
  assert.equal(plan.updates[0].baseVersion, 0);
});

test("changing an identifier field is a conflict, never a patch", () => {
  const plan = planImport({
    workbook: {
      "Code Groups": grid("Code Groups", [
        { Name: "Laptops", Prefix: "KCSX", "Minimum Number": "1", "Maximum Number": "500",
          "Next Available Number": "80", Active: "TRUE", "Sort Order": "1",
          "Record ID": "cg-1", "Sync Version": "0" },
      ]),
    },
    current: {
      codeGroups: [{
        id: "cg-1", name: "Laptops", prefix: "KCSL", minimumNumber: 1,
        maximumNumber: 500, nextAvailableNumber: 80, isActive: true, sortOrder: 1,
        syncVersion: 0,
      }],
    },
  });
  assert.equal(plan.summary.updates, 0);
  assert.equal(plan.summary.conflicts, 1);
  assert.equal(plan.conflicts[0].reason, "protected-field");
  assert.deepEqual(plan.conflicts[0].fields, ["Prefix"]);
});

test("changing a manual field (asset Status) is a conflict", () => {
  const plan = planImport({
    workbook: {
      "Master Inventory": grid("Master Inventory", [
        { Name: "Laptop 13", Status: "Disposed", Condition: "Good",
          "Record ID": "ast-1", "Sync Version": "3" },
      ]),
    },
    current: {
      assets: [{ id: "ast-1", name: "Laptop 13", status: "Available", condition: "Good", syncVersion: 3 }],
    },
  });
  assert.equal(plan.summary.conflicts, 1);
  assert.equal(plan.conflicts[0].reason, "protected-field");
  assert.deepEqual(plan.conflicts[0].fields, ["Status"]);
});

test("stale Sync Version blocks an otherwise-valid edit", () => {
  const plan = planImport({
    workbook: {
      Categories: grid("Categories", [
        { Name: "Laptops renamed", Status: "Active", "Record ID": "cat-1", "Sync Version": "2" },
      ]),
    },
    current: { categories: [{ id: "cat-1", name: "Laptops", status: "Active", syncVersion: 5 }] },
  });
  assert.equal(plan.summary.updates, 0);
  assert.equal(plan.conflicts[0].reason, "stale-version");
});

test("unknown Record ID is a conflict", () => {
  const plan = planImport({
    workbook: {
      Departments: grid("Departments", [
        { Name: "Ghost", "Record ID": "dep-999", "Sync Version": "0" },
      ]),
    },
    current: { departments: [] },
  });
  assert.equal(plan.conflicts[0].reason, "unknown-record");
});

test("blank Record ID on a creatable tab yields a create; validation catches bad prefix", () => {
  const ok = planImport({
    workbook: {
      Locations: grid("Locations", [{ Name: "Room 12", Type: "Classroom", Status: "Active" }]),
    },
    current: { locations: [] },
  });
  assert.equal(ok.summary.creates, 1);
  assert.equal(ok.creates[0].collection, "locations");
  assert.equal(ok.creates[0].kind, "location");
  assert.equal(ok.creates[0].data.name, "Room 12");

  const bad = planImport({
    workbook: {
      "Code Groups": grid("Code Groups", [
        { Name: "Bad", Prefix: "kcs-l", "Minimum Number": "1", "Maximum Number": "10" },
      ]),
    },
    current: { codeGroups: [] },
  });
  assert.equal(bad.summary.creates, 0);
  assert.equal(bad.summary.errors, 1);
  assert.match(bad.errors[0].message, /Prefix/);
});

test("blank Record ID on Master Inventory is reported, not created", () => {
  const plan = planImport({
    workbook: {
      "Master Inventory": grid("Master Inventory", [{ Name: "New laptop", Category: "Laptop" }]),
    },
    current: { assets: [] },
  });
  assert.equal(plan.summary.creates, 0);
  assert.equal(plan.summary.needsAimsCreate, 1);
  assert.equal(plan.needsAimsCreate[0].preview.name, "New laptop");
});

test("non-numeric value in a number field is an error, not a write", () => {
  const plan = planImport({
    workbook: {
      "Inventory Stock": (() => {
        const g = grid("Inventory Stock", [
          { "Item Name": "HDMI", Minimum: "lots", "Record ID": "inv-1", "Sync Version": "0" },
        ]);
        return g;
      })(),
    },
    current: { inventoryItems: [{ id: "inv-1", name: "HDMI", minimum: 5, syncVersion: 0 }] },
  });
  assert.equal(plan.summary.updates, 0);
  assert.equal(plan.summary.errors, 1);
});

test("History Log Correction cell becomes a correction entry", () => {
  const plan = planImport({
    workbook: {
      "History Log": [
        ["Asset Code", "Asset Record ID", "Occurred At", "Correction", "Record ID"],
        ["KCSL-0013", "ast-1", "2026-01-01", "Serial was mistyped, should end 9H", "ahe-1"],
        ["KCSL-0014", "ast-2", "2026-01-02", "", "ahe-2"],
      ],
    },
    current: {},
  });
  assert.equal(plan.summary.corrections, 1);
  assert.equal(plan.corrections[0].assetId, "ast-1");
  assert.match(plan.corrections[0].text, /mistyped/);
});

const trashGrid = (rows) => [
  ["Entity", "Record ID", "Business Code", "Name", "Trashed At", "Trashed By", "Reason", "Restore", "Sync Status"],
  ...rows.map((r) => [
    r.Entity ?? "", r["Record ID"] ?? "", "", r.Name ?? "", "", "", "",
    r.Restore ?? "", r["Sync Status"] ?? "TRASHED",
  ]),
];

test("Status = Archived on a data tab is a trash intent, not a field conflict", () => {
  const plan = planImport({
    workbook: {
      "Master Inventory": grid("Master Inventory", [
        { Name: "Old laptop", Status: "Archived", "Record ID": "ast-9", "Sync Version": "2" },
      ]),
    },
    current: { assets: [{ id: "ast-9", name: "Old laptop", status: "Available", syncVersion: 2 }] },
  });
  assert.equal(plan.summary.trashes, 1);
  assert.equal(plan.summary.conflicts, 0);
  assert.equal(plan.trashes[0].recordId, "ast-9");
  assert.equal(plan.trashes[0].baseVersion, 2);
});

test("Status = Archived on an already-archived record is a no-op", () => {
  const plan = planImport({
    workbook: {
      Categories: grid("Categories", [
        { Name: "Dead", Status: "Archived", "Record ID": "cat-9", "Sync Version": "0" },
      ]),
    },
    current: { categories: [{ id: "cat-9", name: "Dead", status: "Archived", syncVersion: 0 }] },
  });
  assert.equal(plan.summary.trashes, 0);
  assert.equal(plan.summary.conflicts, 0);
  assert.equal(plan.summary.updates, 0);
});

test("a data-tab row for a record archived in AIMS is a conflict", () => {
  const plan = planImport({
    workbook: {
      Departments: grid("Departments", [
        { Name: "Zombie", Status: "Active", "Record ID": "dep-9", "Sync Version": "0" },
      ]),
    },
    current: { departments: [{ id: "dep-9", name: "Zombie", status: "Archived", syncVersion: 0 }] },
  });
  assert.equal(plan.conflicts[0].reason, "record-archived");
});

test("Trash tab Restore = RESTORE on an archived record queues a restore", () => {
  const plan = planImport({
    workbook: {
      Trash: trashGrid([{ Entity: "Asset", "Record ID": "ast-7", Restore: "RESTORE" }]),
    },
    current: { assets: [{ id: "ast-7", name: "x", status: "Archived" }] },
  });
  assert.equal(plan.summary.restores, 1);
  assert.equal(plan.restores[0].collection, "assets");
  assert.equal(plan.restores[0].alreadyActive, false);
});

test("Restore of a record that is already active only clears the cell", () => {
  const plan = planImport({
    workbook: {
      Trash: trashGrid([{ Entity: "Location", "Record ID": "loc-7", Restore: "RESTORE" }]),
    },
    current: { locations: [{ id: "loc-7", name: "Room", status: "Active" }] },
  });
  assert.equal(plan.summary.restores, 1);
  assert.equal(plan.restores[0].alreadyActive, true);
});

test("Restore with an unknown Record ID is a conflict; unknown Entity is an error", () => {
  const plan = planImport({
    workbook: {
      Trash: trashGrid([
        { Entity: "Asset", "Record ID": "ast-nope", Restore: "RESTORE" },
        { Entity: "Widget", "Record ID": "w-1", Restore: "RESTORE" },
      ]),
    },
    current: { assets: [] },
  });
  assert.equal(plan.conflicts.filter((c) => c.reason === "unknown-record").length, 1);
  assert.equal(plan.summary.errors, 1);
});

test("trash on a data tab AND restore on the Trash tab for one record is a conflict", () => {
  const plan = planImport({
    workbook: {
      "Master Inventory": grid("Master Inventory", [
        { Name: "Contested", Status: "Archived", "Record ID": "ast-5", "Sync Version": "0" },
      ]),
      Trash: trashGrid([{ Entity: "Asset", "Record ID": "ast-5", Restore: "RESTORE" }]),
    },
    current: { assets: [{ id: "ast-5", name: "Contested", status: "Available", syncVersion: 0 }] },
  });
  assert.equal(plan.conflicts.some((c) => c.reason === "contradictory"), true);
  assert.equal(plan.summary.trashes, 0);
  assert.equal(plan.summary.restores, 0);
});

/* -------- Phase 6: forcePatch (conflict resolution) -------- */

const forceArgs = (tab, rowObj, doc, fields) => {
  const [header, row] = grid(tab, [rowObj]);
  return { tab, header, row, doc, fields };
};

test("forcePatch applies a held manual field (asset Status)", () => {
  const out = forcePatch(
    forceArgs("Master Inventory",
      { Name: "L", Status: "Under Repair", "Record ID": "ast-1", "Sync Version": "4" },
      { id: "ast-1", name: "L", status: "Available", syncVersion: 4 },
      ["Status"]),
  );
  assert.deepEqual(out.errors, []);
  assert.equal(out.baseVersion, 4);
  assert.deepEqual(out.patch, { status: "Under Repair" });
  assert.deepEqual(out.changes.Status, { from: "Available", to: "Under Repair" });
});

test("forcePatch refuses identifier fields", () => {
  const out = forcePatch(
    forceArgs("Master Inventory",
      { Name: "L", "Serial Number": "NEW123", "Record ID": "ast-1", "Sync Version": "0" },
      { id: "ast-1", name: "L", serialNumber: "OLD", syncVersion: 0 },
      ["Serial Number"]),
  );
  assert.equal(Object.keys(out.patch).length, 0);
  assert.match(out.errors[0], /identifier/i);
});

test("forcePatch validates enums", () => {
  const out = forcePatch(
    forceArgs("Master Inventory",
      { Name: "L", Status: "Sold", "Record ID": "ast-1", "Sync Version": "0" },
      { id: "ast-1", name: "L", status: "Available", syncVersion: 0 },
      ["Status"]),
  );
  assert.match(out.errors[0], /not a valid asset status/);
});

test("forcePatch reports a no-op when the sheet already matches", () => {
  const out = forcePatch(
    forceArgs("Categories",
      { Name: "L", Status: "Active", "Record ID": "cat-1", "Sync Version": "0" },
      { id: "cat-1", name: "L", status: "Active", syncVersion: 0 },
      ["Status"]),
  );
  assert.deepEqual(out.patch, {});
  assert.deepEqual(out.noop, ["Status"]);
});

test("nested details.notes edit patches the nested object", () => {
  const plan = planImport({
    workbook: {
      Departments: grid("Departments", [
        { Name: "ICT", Status: "Active", Notes: "3rd floor",
          "Record ID": "dep-1", "Sync Version": "0" },
      ]),
    },
    current: {
      departments: [{ id: "dep-1", name: "ICT", status: "Active", details: { foo: "bar" }, syncVersion: 0 }],
    },
  });
  assert.equal(plan.summary.updates, 1);
  assert.deepEqual(plan.updates[0].patch, { details: { foo: "bar", notes: "3rd floor" } });
});
