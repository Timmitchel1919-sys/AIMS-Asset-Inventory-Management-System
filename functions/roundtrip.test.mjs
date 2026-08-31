import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWorkbook } from "./sheetsExport.js";
import { planImport } from "./sheetsImport.js";

/**
 * Export -> import must be the identity: a sheet that was just exported from
 * AIMS plans to zero changes when imported back. Fixtures use only the fields
 * whose export path and import path line up (manager/parent id-vs-name mapping
 * is a known asymmetry handled elsewhere).
 */
const collections = () => ({
  assets: [
    {
      id: "ast-1", code: "KCSL-0013", name: "ThinkPad T440p", category: "Laptop",
      brand: "LENOVO", model: "THINKPAD T44P", serialNumber: "PB024U9H",
      status: "Available", condition: "Good", location: "ICT", department: "ICT",
      notes: "spare", syncVersion: 3, updatedBy: "u",
    },
  ],
  inventoryItems: [
    {
      id: "inv-1", code: "HDMI", name: "HDMI cable", itemType: "Consumable",
      onHand: 24, reserved: 0, minimum: 10, notes: "", syncVersion: 1,
    },
  ],
  locations: [
    { id: "loc-1", name: "ICT", type: "Office", status: "Active", details: { notes: "3rd floor" }, syncVersion: 0 },
  ],
  departments: [
    { id: "dep-1", name: "ICT", status: "Active", details: { notes: "" }, syncVersion: 0 },
  ],
  categories: [
    { id: "cat-1", name: "Laptop", status: "Active", details: { notes: "" }, syncVersion: 0 },
  ],
  codeGroups: [
    {
      id: "cg-1", name: "Laptops", prefix: "KCSL", minimumNumber: 1,
      maximumNumber: 500, nextAvailableNumber: 80, isActive: true, sortOrder: 1,
      syncVersion: 0,
    },
  ],
  assetHistoryEvents: [],
});

test("a freshly exported workbook imports back as zero changes", () => {
  const current = collections();
  const workbook = buildWorkbook(current, { syncedAt: "2026-09-01T00:00:00.000Z" });
  const plan = planImport({ workbook, current });
  assert.deepEqual(plan.summary, {
    updates: 0, creates: 0, trashes: 0, restores: 0,
    conflicts: 0, corrections: 0, needsAimsCreate: 0, errors: 0,
  });
});

test("editing one apply-field cell produces exactly one update", () => {
  const current = collections();
  const workbook = buildWorkbook(current, { syncedAt: "2026-09-01T00:00:00.000Z" });
  const deptHeader = workbook["Departments"][0];
  workbook["Departments"][1][deptHeader.indexOf("Notes")] = "second floor";
  const plan = planImport({ workbook, current });
  assert.equal(plan.summary.updates, 1);
  assert.equal(plan.summary.conflicts, 0);
  assert.deepEqual(plan.updates[0].patch, { details: { notes: "second floor" } });
});

test("editing an identifier cell produces exactly one conflict", () => {
  const current = collections();
  const workbook = buildWorkbook(current, { syncedAt: "2026-09-01T00:00:00.000Z" });
  const h = workbook["Master Inventory"][0];
  workbook["Master Inventory"][1][h.indexOf("Serial Number")] = "TAMPERED";
  const plan = planImport({ workbook, current });
  assert.equal(plan.summary.updates, 0);
  assert.equal(plan.summary.conflicts, 1);
  assert.equal(plan.conflicts[0].reason, "protected-field");
});

test("setting a Status cell to Archived produces exactly one trash", () => {
  const current = collections();
  const workbook = buildWorkbook(current, { syncedAt: "2026-09-01T00:00:00.000Z" });
  const h = workbook["Master Inventory"][0];
  workbook["Master Inventory"][1][h.indexOf("Status")] = "Archived";
  const plan = planImport({ workbook, current });
  assert.equal(plan.summary.trashes, 1);
  assert.equal(plan.summary.conflicts, 0);
});
