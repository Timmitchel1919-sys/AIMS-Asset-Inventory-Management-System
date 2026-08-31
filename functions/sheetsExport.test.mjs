import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWorkbook, TAB_HEADERS, TAB_ORDER, iso } from "./sheetsExport.js";

const SYNCED_AT = "2026-09-01T00:00:00.000Z";

function fixture() {
  return {
    assets: [
      {
        id: "ast-0001",
        code: "KCSL-0013",
        name: "Lenovo ThinkPad T440p",
        category: "Laptop",
        brand: "LENOVO",
        model: "THINKPAD T44P",
        serialNumber: "PB024U9H",
        status: "Available",
        condition: "Good",
        location: "ICT",
        department: "ICT",
        updatedAt: SYNCED_AT,
        updatedBy: "uid-admin",
        technicalSpecifications: {
          CPU: "i5-4200M",
          "Admin Password": "hunter2",
          wifiKey: "topsecret",
        },
        remoteAccess: { anydeskId: "814653245", teamviewerId: "784424591" },
        sourceData: { "Admin Passw": "should-never-appear" },
        previousCodes: ["KCSL13"],
      },
      {
        id: "ast-0002",
        code: "KCSL-0099",
        name: "Dead laptop",
        status: "Archived",
        archivedAt: SYNCED_AT,
        archivedBy: "uid-admin",
        deletionReason: "Beyond repair",
      },
    ],
    inventoryItems: [
      {
        id: "inv-1",
        code: "HDMI",
        name: "HDMI cable",
        itemType: "Consumable",
        onHand: 24,
        reserved: 0,
        minimum: 10,
        updatedAt: SYNCED_AT,
      },
    ],
    assetHistoryEvents: [
      {
        id: "ahe-0001",
        assetId: "ast-0001",
        assetCode: "KCSL-0013",
        occurredAt: SYNCED_AT,
        eventType: "service",
        title: "Windows updates",
        description: "Ran cumulative updates and malware scan.",
        source: "legacy_import",
        originalLegacyText: "13 August 0224 | SERVICE UPDATE",
        createdBy: "legacy_migration",
      },
    ],
    locations: [
      { id: "loc-0001", name: "ICT", type: "Office", status: "Active", directAssetCount: 3 },
    ],
    departments: [{ id: "dep-0001", name: "ICT", status: "Active", relatedCount: 5 }],
    categories: [{ id: "cat-0001", name: "Laptop", status: "Active", relatedCount: 62 }],
    codeGroups: [
      {
        id: "cg-0001",
        name: "Laptops",
        prefix: "KCSL",
        minimumNumber: 1,
        maximumNumber: 500,
        nextAvailableNumber: 80,
        isActive: true,
        sortOrder: 1,
      },
    ],
  };
}

test("every tab is present, in order, with the exact spec header", () => {
  const wb = buildWorkbook(fixture(), { syncedAt: SYNCED_AT });
  assert.deepEqual(Object.keys(wb), TAB_ORDER);
  for (const tab of TAB_ORDER) {
    assert.deepEqual(wb[tab][0], TAB_HEADERS[tab], `${tab} header`);
  }
});

test("archived rows are excluded from data tabs and listed in Trash", () => {
  const wb = buildWorkbook(fixture(), { syncedAt: SYNCED_AT });
  const master = wb["Master Inventory"];
  assert.equal(master.length, 2, "1 header + 1 active asset");
  assert.equal(master[1][0], "Lenovo ThinkPad T440p");

  const trash = wb["Trash"];
  assert.equal(trash.length, 2, "1 header + 1 archived asset");
  assert.equal(trash[1][0], "Asset");
  assert.equal(trash[1][1], "ast-0002");
  assert.equal(trash[1][8], "TRASHED");
});

test("every data row has exactly the header width", () => {
  const wb = buildWorkbook(fixture(), { syncedAt: SYNCED_AT });
  for (const tab of TAB_ORDER) {
    const width = wb[tab][0].length;
    for (let r = 1; r < wb[tab].length; r++) {
      assert.equal(wb[tab][r].length, width, `${tab} row ${r} width`);
    }
  }
});

test("credentials and restricted metadata never reach the sheet", () => {
  const wb = buildWorkbook(fixture(), { syncedAt: SYNCED_AT });
  const blob = JSON.stringify(wb);
  for (const forbidden of [
    "hunter2",
    "topsecret",
    "should-never-appear",
    "814653245", // anydesk
    "784424591", // teamviewer
  ]) {
    assert.ok(!blob.includes(forbidden), `leaked: ${forbidden}`);
  }
  // The non-sensitive spec value is still exported.
  assert.ok(blob.includes("i5-4200M"));
});

test("system block: SYNCED / AIMS / version 0 / stamped Last Synced At", () => {
  const wb = buildWorkbook(fixture(), { syncedAt: SYNCED_AT });
  const header = wb["Master Inventory"][0];
  const row = wb["Master Inventory"][1];
  assert.equal(row[header.indexOf("Sync Version")], "0");
  assert.equal(row[header.indexOf("Sync Status")], "SYNCED");
  assert.equal(row[header.indexOf("Source")], "AIMS");
  assert.equal(row[header.indexOf("Last Synced At")], SYNCED_AT);
  assert.equal(row[header.indexOf("Record ID")], "ast-0001");
  assert.equal(row[header.indexOf("Previous Codes")], "KCSL13");
  assert.notEqual(row[header.indexOf("Row Hash")], "");
});

test("iso() normalises Timestamp-like, Date, and string inputs", () => {
  assert.equal(iso({ _seconds: 0, _nanoseconds: 0 }), "1970-01-01T00:00:00.000Z");
  assert.equal(iso(new Date("2026-01-02T03:04:05Z")), "2026-01-02T03:04:05.000Z");
  assert.equal(iso("2026-01-02"), "2026-01-02T00:00:00.000Z");
  assert.equal(iso(""), "");
  assert.equal(
    iso({ toDate: () => new Date("2026-05-05T00:00:00Z") }),
    "2026-05-05T00:00:00.000Z",
  );
});
