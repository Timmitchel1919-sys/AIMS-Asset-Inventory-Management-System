import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPlan } from "./applyImport.js";
import { makeFakeFirestore, FieldValue } from "./testUtils.mjs";

const emptyPlan = () => ({
  updates: [],
  creates: [],
  trashes: [],
  restores: [],
  corrections: [],
});

test("update applies the patch and bumps syncVersion", async () => {
  const db = makeFakeFirestore({
    departments: [{ id: "dep-1", name: "ICT", status: "Active", syncVersion: 2 }],
  });
  const res = await applyPlan(db, FieldValue, {
    ...emptyPlan(),
    updates: [
      {
        tab: "Departments", row: 2, recordId: "dep-1",
        collection: "departments", baseVersion: 2,
        patch: { name: "ICT & Media" },
      },
    ],
  });
  assert.equal(res.updated.length, 1);
  assert.equal(res.updated[0].syncVersion, 3);
  const doc = db.__dump("departments")["dep-1"];
  assert.equal(doc.name, "ICT & Media");
  assert.equal(doc.syncVersion, 3);
  assert.equal(doc.syncSource, "SHEETS");
  assert.equal(res.writeBack[0].cells["Sync Version"], "3");
});

test("update on a version race is skipped, not overwritten", async () => {
  const db = makeFakeFirestore({
    departments: [{ id: "dep-1", name: "ICT", syncVersion: 9 }],
  });
  const res = await applyPlan(db, FieldValue, {
    ...emptyPlan(),
    updates: [
      {
        tab: "Departments", row: 2, recordId: "dep-1",
        collection: "departments", baseVersion: 2, patch: { name: "stale" },
      },
    ],
  });
  assert.equal(res.updated.length, 0);
  assert.equal(res.skipped.length, 1);
  assert.match(res.skipped[0].reason, /changed in AIMS/);
  assert.equal(db.__dump("departments")["dep-1"].name, "ICT");
});

test("running the same update plan twice is idempotent (second run skips)", async () => {
  const db = makeFakeFirestore({
    categories: [{ id: "cat-1", name: "Laptops", syncVersion: 0 }],
  });
  const plan = {
    ...emptyPlan(),
    updates: [
      {
        tab: "Categories", row: 2, recordId: "cat-1",
        collection: "categories", baseVersion: 0, patch: { name: "Notebooks" },
      },
    ],
  };
  const first = await applyPlan(db, FieldValue, plan);
  const second = await applyPlan(db, FieldValue, plan);
  assert.equal(first.updated.length, 1);
  assert.equal(second.updated.length, 0);
  assert.equal(second.skipped.length, 1);
});

test("create a reference generates an id and the write-back carries it", async () => {
  const db = makeFakeFirestore({});
  const res = await applyPlan(db, FieldValue, {
    ...emptyPlan(),
    creates: [
      {
        tab: "Locations", row: 5, collection: "locations", kind: "location",
        data: { name: "Room 12", type: "Classroom", details: { notes: "" } },
      },
    ],
  });
  assert.equal(res.created.length, 1);
  const id = res.created[0].recordId;
  const doc = db.__dump("locations")[id];
  assert.equal(doc.name, "Room 12");
  assert.equal(doc.kind, "location");
  assert.equal(doc.status, "Active");
  assert.equal(doc.parentLocationId, null);
  assert.equal(doc.syncVersion, 1);
  assert.equal(res.writeBack.find((w) => w.row === 5).cells["Record ID"], id);
});

test("code-group create is refused when the prefix already exists", async () => {
  const db = makeFakeFirestore({
    codeGroups: [{ id: "cg-1", name: "Laptops", prefix: "KCSL" }],
  });
  const res = await applyPlan(db, FieldValue, {
    ...emptyPlan(),
    creates: [
      {
        tab: "Code Groups", row: 3, collection: "codeGroups", kind: null,
        data: { name: "Dup", prefix: "KCSL", minimumNumber: 1, maximumNumber: 10 },
      },
    ],
  });
  assert.equal(res.created.length, 0);
  assert.equal(res.skipped.length, 1);
  assert.match(res.skipped[0].reason, /prefix taken/);
});

test("trash sets Archived + isArchived and bumps version", async () => {
  const db = makeFakeFirestore({
    assets: [{ id: "ast-1", name: "L", status: "Available", syncVersion: 4 }],
  });
  const res = await applyPlan(db, FieldValue, {
    ...emptyPlan(),
    trashes: [
      { tab: "Master Inventory", row: 2, recordId: "ast-1", collection: "assets", baseVersion: 4 },
    ],
  });
  assert.equal(res.trashed.length, 1);
  const doc = db.__dump("assets")["ast-1"];
  assert.equal(doc.status, "Archived");
  assert.equal(doc.isArchived, true);
  assert.equal(doc.syncVersion, 5);
  assert.equal(res.writeBack[0].cells["Sync Status"], "TRASHED");
});

test("restore un-archives; already-active only clears the cell", async () => {
  const db = makeFakeFirestore({
    assets: [{ id: "ast-1", name: "L", status: "Archived", isArchived: true, syncVersion: 1 }],
    locations: [{ id: "loc-1", name: "R", status: "Active" }],
  });
  const res = await applyPlan(db, FieldValue, {
    ...emptyPlan(),
    restores: [
      { tab: "Trash", row: 2, recordId: "ast-1", collection: "assets", entity: "Asset", alreadyActive: false },
      { tab: "Trash", row: 3, recordId: "loc-1", collection: "locations", entity: "Location", alreadyActive: true },
    ],
  });
  assert.equal(res.restored.length, 1);
  const a = db.__dump("assets")["ast-1"];
  assert.equal(a.status, "Available");
  assert.equal(a.isArchived, false);
  assert.equal(a.archivedAt, undefined);
  const clears = res.writeBack.filter((w) => w.cells.Restore === "");
  assert.equal(clears.length, 2);
});

test("history correction appends a new event, never touching the original", async () => {
  const db = makeFakeFirestore({ assetHistoryEvents: [] });
  const res = await applyPlan(db, FieldValue, {
    ...emptyPlan(),
    corrections: [
      { row: 4, assetId: "ast-1", assetCode: "KCSL-0013", text: "serial mistyped" },
    ],
  });
  assert.equal(res.corrected.length, 1);
  const events = Object.values(db.__dump("assetHistoryEvents"));
  assert.equal(events.length, 1);
  assert.equal(events[0].source, "correction");
  assert.equal(events[0].assetId, "ast-1");
  assert.equal(res.writeBack[0].cells.Correction, "");
});
