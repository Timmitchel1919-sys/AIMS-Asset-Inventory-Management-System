import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  exportWorkbook,
  readTabs,
  writeCells,
  __setTokenProvider,
} from "./sheetsClient.js";
import { installFakeSheets } from "./testUtils.mjs";

let fake;
beforeEach(() => {
  __setTokenProvider(async () => "fake-token");
});
afterEach(() => {
  fake?.restore();
  fake = undefined;
  __setTokenProvider(null);
});

test("exportWorkbook creates missing tabs and replaces their values", async () => {
  fake = installFakeSheets({ sheets: ["Master Inventory"] });
  const summary = await exportWorkbook("sheet-1", {
    "Master Inventory": [["Name"], ["Laptop A"], ["Laptop B"]],
    Locations: [["Name"], ["ICT"]],
  });
  assert.deepEqual(summary, { "Master Inventory": 2, Locations: 1 });
  assert.ok(fake.state.sheets.has("Locations")); // created
  assert.deepEqual(fake.state.values["Locations"], [["Name"], ["ICT"]]);
});

test("Sheets API 429s are retried transparently", async () => {
  fake = installFakeSheets({ sheets: ["A"], failFirst: 2, failStatus: 429 });
  const summary = await exportWorkbook("sheet-1", { A: [["h"], ["r1"]] });
  assert.deepEqual(summary, { A: 1 });
  // first two calls failed and were retried
  assert.ok(fake.state.calls.length >= 3);
});

test("readTabs returns a tab -> grid map", async () => {
  fake = installFakeSheets({
    values: {
      Departments: [
        ["Name", "Record ID"],
        ["ICT", "dep-1"],
      ],
    },
  });
  const wb = await readTabs("sheet-1", ["Departments", "Categories"]);
  assert.deepEqual(wb["Departments"], [
    ["Name", "Record ID"],
    ["ICT", "dep-1"],
  ]);
  assert.deepEqual(wb["Categories"], []);
});

test("writeCells targets the right A1 cells from the header", async () => {
  fake = installFakeSheets({
    values: { Departments: [["Name", "Record ID", "Sync Version", "Sync Status"], ["ICT", "dep-1", "0", "SYNCED"]] },
  });
  await writeCells(
    "sheet-1",
    [{ tab: "Departments", row: 2, cells: { "Sync Version": "1", "Sync Status": "PENDING" } }],
    { Departments: ["Name", "Record ID", "Sync Version", "Sync Status"] },
  );
  const row = fake.state.values["Departments"][1];
  assert.equal(row[2], "1"); // column C = Sync Version
  assert.equal(row[3], "PENDING"); // column D = Sync Status
  assert.equal(row[0], "ICT"); // untouched
});
