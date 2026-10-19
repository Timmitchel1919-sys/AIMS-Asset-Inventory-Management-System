import { describe, expect, it } from "vitest";
import {
  buildAssetCandidate,
  buildHistoryDocument,
  chooseCanonicalAsset,
  classifySheet,
  extractHistoryRows,
  parseLegacyDate,
  proposedCode,
  UNKNOWN_OCCURRED_AT,
} from "./history-log-import-lib.mjs";

describe("History Log production importer", () => {
  it("maps every requested category and stable generated code", () => {
    expect(classifySheet("KCSPW01", { item: "MODULE" })).toBe("Module");
    expect(classifySheet("KCSDB01", { item: "DIGIBORD" })).toBe("Digiboard");
    expect(classifySheet("KCSDB39", { item: "DIGIBORD INCL MODULE" })).toBe("Digiboard");
    expect(classifySheet("SCANNER CONFERENCE ROOM", { item: "SCANNER" })).toBe("Scanner");
    expect(proposedCode("TELEFOON FACILITAIR", {})).toBe("KCSMOB-08");
    expect(proposedCode("TABLET-4", {})).toBe("TAB-04");
    expect(proposedCode("KCSDESKK-02", { "device name": "FIN04 nu KCSDESK-02" })).toBe("KCSDESK-02");
    expect(proposedCode("KCSDESK- 23", {})).toBe("KCSDESK-23");
  });

  it("merges undated continuation rows without losing content", () => {
    const rows = [
      ["DATE:", "STATUS", "ISSUE", "SOLUTION", "OPMERKINGEN"],
      ["24 Juni 2024", "Fixed", "Port stuck", "Cable replaced", ""],
      ["", "Monitor", "", "Observe", "Follow-up"],
    ];
    const events = extractHistoryRows(rows);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("Fixed | Monitor");
    expect(events[0].solution).toBe("Cable replaced | Observe");
    expect(events[0].sourceRows).toEqual([2, 3]);
  });

  it("parses Dutch and short numeric dates", () => {
    expect(parseLegacyDate("24 Juli 2024")).toBe("2024-07-24T00:00:00.000Z");
    expect(parseLegacyDate("28/8/26")).toBe("2026-08-28T00:00:00.000Z");
  });

  it("does not map passwords or remote-access credentials into assets", () => {
    const rows = [
      ["Device Name", "KCSPW01"], ["Item", "MODULE"], ["Brand", "Prowise"],
      ["PASSWORD", "secret"], ["AnyDesk", "123456"],
      ["DATE:", "STATUS", "ISSUE", "SOLUTION"],
    ];
    const candidate = buildAssetCandidate("KCSPW01", rows);
    expect(JSON.stringify(candidate)).not.toContain("secret");
    expect(JSON.stringify(candidate)).not.toContain("123456");
  });

  it("uses the original ast record as canonical when production contains duplicate codes", () => {
    const chosen = chooseCanonicalAsset([
      { id: "random", status: "Available", createdAt: "2026-09-29" },
      { id: "ast-0075", status: "Assigned", createdAt: "2026-09-28" },
    ]);
    expect(chosen.id).toBe("ast-0075");
  });

  it("keeps undated legacy events visible with an explicit sentinel and warning", () => {
    const doc = buildHistoryDocument(
      { rawDate: "", status: "Out of order", issue: "Broken hinge", solution: "", notes: "", sourceRows: [20] },
      { fileHash: "abc", sheetName: "KCSL01", assetId: "asset-1", assetCode: "KCSL-01", importBatchId: "batch" },
    );
    expect(doc.data.occurredAt).toBe(UNKNOWN_OCCURRED_AT);
    expect(doc.data.notes).toContain("Legacy date unavailable");
  });
});
