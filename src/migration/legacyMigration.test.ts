import { describe, expect, it } from "vitest";
import {
  analyzeLegacyDate,
  dryRunLegacyMigration,
  normalizeLegacyDate,
  sanitizeSourceRow,
} from "./legacyMigration";
import { WorkflowRepositoryEngine } from "../data/mockRepository";

const context = () => {
  const snapshot = new WorkflowRepositoryEngine().snapshot();
  return {
    existingAssets: snapshot.assets,
    references: snapshot.references,
    codeGroups: snapshot.codeGroups,
    importBatchId: "test-batch",
  };
};

describe("legacy migration dry run", () => {
  it("normalizes a valid asset and preserves supported remote IDs", () => {
    const result = dryRunLegacyMigration({
      ...context(),
      masterRows: [
        {
          "Asset Code": "KCSMD-490",
          Name: "Migration laptop",
          "Serial Number": "MIG-490",
          Category: "laptops",
          Location: "ict store",
          AnyDesk: "123456",
          TeamViewer: "654321",
        },
      ],
      historyRows: [],
    });
    expect(result.assets[0]).toMatchObject({
      code: "KCSMD-490",
      category: "Laptops",
      location: "ICT Store",
      remoteAccess: { anydeskId: "123456", teamviewerId: "654321" },
      status: "VALID",
    });
  });

  it("excludes administrator password fields without retaining their values", () => {
    const sanitized = sanitizeSourceRow({
      Name: "Device",
      "Admin Password": "must-never-survive",
      Notes: "Safe",
    });
    expect(sanitized).toEqual({ Name: "Device", Notes: "Safe" });
    expect(JSON.stringify(sanitized)).not.toContain("must-never-survive");
  });

  it("detects duplicate codes and serials", () => {
    const existing = context().existingAssets[0];
    const result = dryRunLegacyMigration({
      ...context(),
      masterRows: [
        {
          Code: existing.code,
          Name: "Duplicate",
          Serial: existing.serialNumber,
          Category: "Laptops",
          Location: "ICT Store",
        },
      ],
      historyRows: [],
    });
    expect(result.assets[0].status).toBe("DUPLICATE");
    expect(result.duplicates).toBe(1);
  });

  it("prepares missing locations and code groups but does not write them", () => {
    const result = dryRunLegacyMigration({
      ...context(),
      masterRows: [
        {
          Code: "KCSNEW-4",
          Name: "New group asset",
          Serial: "NEW-4",
          Category: "Laptops",
          Location: "New ICT Annex",
        },
      ],
      historyRows: [],
    });
    expect(result.locationsToCreate).toEqual(["New ICT Annex"]);
    expect(result.codeGroupsToCreate[0]?.prefix).toBe("KCSNEW");
    expect(result.mode).toBe("DRY_RUN");
  });

  it("preserves historical dates, classifies legacy events and is idempotent", () => {
    const input = {
      ...context(),
      masterRows: [
        {
          Code: "KCSMD-491",
          Name: "Legacy laptop",
          Serial: "MIG-491",
          Category: "Laptops",
          Location: "ICT Store",
        },
      ],
      historyRows: [
        {
          Code: "KCSMD-491",
          Date: "2024-03-04",
          Issue: "RAM defect",
          Solution: "RAM vervangen",
          Technician: "ICT",
        },
      ],
    };
    const first = dryRunLegacyMigration(input);
    const second = dryRunLegacyMigration(input);
    expect(first.historyEvents[0]).toMatchObject({
      eventType: "hardware_replaced",
      occurredAt: "2024-03-04T00:00:00.000Z",
      isLegacyImport: true,
    });
    expect(second.historyEvents[0].fingerprint).toBe(
      first.historyEvents[0].fingerprint,
    );
    expect(second.historyEvents[0].id).toBe(first.historyEvents[0].id);
  });

  it("classifies invalid dates as errors and unmatched history as ambiguous", () => {
    const result = dryRunLegacyMigration({
      ...context(),
      masterRows: [],
      historyRows: [
        { Code: "UNKNOWN-1", Date: "not-a-date", Status: "service" },
      ],
    });
    expect(result.errors).toBe(1);
    expect(result.ambiguous).toBe(1);
    expect(result.historyEvents).toEqual([]);
  });

  it("normalizes Dutch, English and Excel serial dates without inventing partial dates", () => {
    expect(normalizeLegacyDate("4 maart 2024")).toBe(
      "2024-03-04T00:00:00.000Z",
    );
    expect(normalizeLegacyDate("4 March 2024")).toBe(
      "2024-03-04T00:00:00.000Z",
    );
    expect(normalizeLegacyDate(45355)).toBe("2024-03-04T00:00:00.000Z");
    expect(normalizeLegacyDate("2024")).toBeUndefined();
    expect(normalizeLegacyDate("23 -01- 2024")).toBe(
      "2024-01-23T00:00:00.000Z",
    );
    expect(normalizeLegacyDate("22 OKT 25")).toBe("2025-10-22T00:00:00.000Z");
  });

  it("separates safe dates, typo confirmations and partial dates", () => {
    expect(analyzeLegacyDate("19-mei-26")).toMatchObject({
      status: "VALID_DATE",
      proposedDate: "2026-05-19T00:00:00.000Z",
    });
    expect(analyzeLegacyDate("5 Julie 2024")).toMatchObject({
      status: "TYPO_CONFIRMATION_REQUIRED",
      proposedDate: "2024-07-05T00:00:00.000Z",
    });
    expect(analyzeLegacyDate("31 mmart 2026").status).toBe(
      "TYPO_CONFIRMATION_REQUIRED",
    );
    expect(analyzeLegacyDate("maart 2026").status).toBe("PARTIAL_DATE");
  });

  it("keeps match status independent from date and import status", () => {
    const result = dryRunLegacyMigration({
      masterRows: [{ Code: "KCSL01", Serial: "S1" }],
      historyRows: [
        { __sourceSheet: "KCSL01", Date: "5 Julie 2024", Status: "Repair" },
      ],
      existingAssets: [],
      references: [],
      codeGroups: [],
      importBatchId: "dimensions",
    });
    expect(result.historyReview[0]).toMatchObject({
      matchStatus: "AUTO_MATCHED_BY_CODE",
      dateStatus: "TYPO_CONFIRMATION_REQUIRED",
      importStatus: "REVIEW_REQUIRED",
    });
    expect(result.historyEvents).toHaveLength(0);
  });

  it("keeps a uniquely coded asset without a serial and exposes an KSCL correction for review", () => {
    const result = dryRunLegacyMigration({
      ...context(),
      masterRows: [
        {
          "INV CODE": "KSCL40",
          "BRAND - MODEL": "Dell - Latitude",
          Category: "Laptops",
          Location: "ICT   kantoor",
        },
      ],
      historyRows: [
        { __sourceSheet: "KCSL40", Date: "19-02-2024", Status: "Service" },
      ],
    });
    expect(result.assets[0]).toMatchObject({
      code: "KCSL-40",
      serialNumber: "",
      name: "Dell - Latitude",
      brand: "Dell",
      model: "Latitude",
      status: "VALID_WITH_WARNING",
    });
    expect(result.assets[0].warnings.join(" ")).toContain("KSCL40");
    expect(result.historyEvents).toHaveLength(1);
  });

  it("matches history by Device Name before sheet name and groups unmatched rows per sheet", () => {
    const result = dryRunLegacyMigration({
      ...context(),
      masterRows: [
        {
          Code: "KCSDB-04",
          Serial: "SER-4",
          Category: "Desktops",
          Location: "Storage",
        },
      ],
      historyRows: [
        {
          __sourceSheet: "WRONG",
          "Device Name": "KCSDB04",
          Date: "15 maart 2024",
          Status: "Service",
        },
        { __sourceSheet: "UNKNOWN", Date: "2024-03-04", Status: "One" },
        { __sourceSheet: "UNKNOWN", Date: "2024-03-05", Status: "Two" },
      ],
    });
    expect(result.historyEvents).toHaveLength(1);
    const unmatched = result.issues.filter(
      (issue) => issue.type === "UNMATCHED_HISTORY",
    );
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0]).toMatchObject({ affectedCount: 2 });
  });

  it("canonicalizes locations and never proposes compound code fragments as locations", () => {
    const snapshot = context();
    const references = [
      ...snapshot.references,
      {
        ...snapshot.references[0],
        id: "loc-finance",
        kind: "location" as const,
        type: "Location",
        name: "FINANCE",
        active: true,
      },
    ];
    const result = dryRunLegacyMigration({
      ...snapshot,
      references,
      masterRows: [
        { Code: "KCSL-498", Category: "Laptops", Location: " Finance " },
        { Code: "KCSL-497", Category: "Laptops", Location: "ICT KCSDESK-09" },
      ],
      historyRows: [],
    });
    expect(result.assets[0].location).toBe("FINANCE");
    expect(result.locationsToCreate).not.toContain("Finance");
    expect(result.locationsToCreate).not.toContain("ICT KCSDESK-09");
    expect(result.assets[1].status).toBe("VALID_WITH_WARNING");
  });

  it("uses matching priority code, serial, then MAC and reports unmatched history", () => {
    const result = dryRunLegacyMigration({
      ...context(),
      masterRows: [
        {
          Code: "KCSL-499",
          Serial: "SER-499",
          "MAC Address": "AA:BB:CC:DD:EE:FF",
          Category: "Laptops",
          Location: "ICT Store",
        },
      ],
      historyRows: [
        {
          "MAC Address": "AA:BB:CC:DD:EE:FF",
          Date: "2024-03-04",
          Status: "Inspection",
        },
        { Code: "NO-MATCH", Date: "2024-03-04", Status: "Repair" },
      ],
    });
    expect(result.historyEvents).toHaveLength(1);
    expect(
      result.issues.some((issue) => issue.type === "UNMATCHED_HISTORY"),
    ).toBe(true);
  });

  it("imports a legacy event idempotently through the repository command layer", async () => {
    const repository = new WorkflowRepositoryEngine();
    const asset = repository.snapshot().assets[0];
    const command = {
      action: "history.legacy.import" as const,
      entityId: asset.id,
      actor: "Tester",
      values: {
        id: "legacy-event-fixed",
        assetId: asset.id,
        occurredAt: "2024-03-04",
        fingerprint: "fixed-fingerprint",
        title: "Repair",
        description: "Completed",
        importBatchId: "batch-1",
      },
    };
    expect((await repository.execute(command)).ok).toBe(true);
    expect((await repository.execute(command)).message).toContain("skipped");
    expect(
      repository
        .snapshot()
        .assetHistoryEvents.filter(
          (event) => event.fingerprint === "fixed-fingerprint",
        ),
    ).toHaveLength(1);
  });

  it("keeps KCSDB distinct from KCSDESK and supports non-KCS asset codes", () => {
    const result = dryRunLegacyMigration({
      masterRows: [
        { "Asset Code": "KCSDB01", Category: "DIGIBORD" },
        { "Asset Code": "KCSDESK-01", Category: "DESKTOP" },
        { "Asset Code": "MON-01", Category: "MONITOR" },
        { "Asset Code": "KB19", Category: "KEYBOARD" },
        { "Asset Code": "TL-01", Category: "TELEFOON" },
        { "Asset Code": "UPS012", Category: "UPS" },
      ],
      historyRows: [],
      existingAssets: [],
      references: [],
      codeGroups: [],
      importBatchId: "code-test",
    });
    expect(result.assets.map((asset) => asset.code)).toEqual([
      "KCSDB-01",
      "KCSDESK-01",
      "MON-01",
      "KB-19",
      "TL-01",
      "UPS-12",
    ]);
  });
});
