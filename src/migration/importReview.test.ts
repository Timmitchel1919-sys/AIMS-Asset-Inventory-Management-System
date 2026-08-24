import { describe, expect, it } from "vitest";
import { WorkflowRepositoryEngine } from "../data/mockRepository";
import { dryRunLegacyMigration } from "./legacyMigration";
import {
  applyApprovedBulkResolutions,
  applyApprovedReferenceStructure,
  applyWorksheetDecision,
  loadReviewManifest,
  newReviewManifest,
  reviewBlockers,
  reviewCreatedAssets,
  safeManifestText,
  saveReviewManifest,
} from "./importReview";
const context = () => {
  const snapshot = new WorkflowRepositoryEngine().snapshot();
  return {
    existingAssets: snapshot.assets,
    references: snapshot.references,
    codeGroups: snapshot.codeGroups,
    importBatchId: "review-test",
  };
};
describe("migration review manifest", () => {
  it("matches all KCSL01 worksheet events to one normalized Master asset", () => {
    const run = dryRunLegacyMigration({
      ...context(),
      masterRows: [
        {
          Code: "KCSL01",
          Serial: "NEW-KCSL01",
          Category: "Laptops",
          Location: "ICT Store",
        },
      ],
      historyRows: [
        { __sourceSheet: "KCSL01", Date: "01-01-2025", Status: "A" },
        { __sourceSheet: "KCSL01", Date: "02-01-2025", Status: "B" },
      ],
    });
    expect(run.historyReview.map((row) => row.assetCode)).toEqual([
      "KCSL-01",
      "KCSL-01",
    ]);
    expect(
      run.historyReview.every((row) => row.status === "AUTO_MATCHED_BY_CODE"),
    ).toBe(true);
  });
  it("marks a valid asset without events as informational", () => {
    const run = dryRunLegacyMigration({
      ...context(),
      masterRows: [
        {
          Code: "KCSL498",
          Serial: "NEW-498",
          Category: "Laptops",
          Location: "ICT Store",
        },
      ],
      historyRows: [],
    });
    expect(run.assetsWithoutLegacyHistory).toEqual(["KCSL-498"]);
  });
  it("applies one worksheet decision to every blocking row", () => {
    const run = dryRunLegacyMigration({
      ...context(),
      masterRows: [],
      historyRows: [
        { __sourceSheet: "UNKNOWN", Date: "01-01-2025" },
        { __sourceSheet: "UNKNOWN", Date: "02-01-2025" },
      ],
    });
    const manifest = applyWorksheetDecision(
      newReviewManifest("files"),
      run,
      "UNKNOWN",
      {
        decision: "USER_MATCHED_WORKSHEET",
        assetCode: "KCSL-01",
        reason: "review",
      },
    );
    expect(Object.keys(manifest.historyDecisions)).toHaveLength(2);
    expect(reviewBlockers(run, manifest).history).toBe(0);
  });
  it("blocks duplicate, date and reference proposals until reviewed", () => {
    const existing = context().existingAssets[0];
    const run = dryRunLegacyMigration({
      ...context(),
      masterRows: [
        {
          Code: existing.code,
          Serial: existing.serialNumber,
          Category: "New Cat",
          Location: "New Place",
        },
      ],
      historyRows: [{ Code: existing.code, Date: "2025", Status: "Repair" }],
    });
    const blockers = reviewBlockers(run, newReviewManifest("files"));
    expect(blockers.duplicates).toBe(1);
    expect(blockers.dates).toBe(1);
    expect(blockers.references).toBeGreaterThan(0);
  });
  it("persists decisions without password-shaped values", () => {
    const values = new Map<string, string>(),
      storage = {
        getItem: (key: string) => values.get(key) || null,
        setItem: (key: string, value: string) => {
          values.set(key, value);
        },
      };
    const manifest = newReviewManifest("same-files");
    manifest.historyDecisions.x = {
      decision: "SKIPPED_BY_USER",
      reason: "confirmed",
    };
    saveReviewManifest(storage, manifest);
    expect(
      loadReviewManifest(storage, "same-files").historyDecisions.x.reason,
    ).toBe("confirmed");
    expect(
      safeManifestText({
        ...manifest,
        administratorPassword: "secret",
      } as never),
    ).not.toContain("secret");
  });
  it("ignores reviewdata from an older parser schema", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          version: 2,
          fileFingerprint: "same-files",
          historyDecisions: { old: { decision: "SKIPPED_BY_USER" } },
        }),
    };
    const manifest = loadReviewManifest(storage, "same-files");
    expect(manifest.version).toBe(6);
    expect(manifest.historyDecisions).toEqual({});
  });
  it("maps the approved location hierarchy and deduplicates supplemental code groups", () => {
    const run = dryRunLegacyMigration({
      ...context(),
      masterRows: [
        { Code: "KCSDB01", Location: "1A" },
        { Code: "KCSDB02", Location: "7D" },
        { Code: "KCSDB03", Location: "Lokaal 15" },
        { Code: "KCSDB04", Location: "Cabin 3" },
      ],
      historyRows: [],
    });
    const manifest = applyApprovedReferenceStructure(
      run,
      newReviewManifest("refs"),
    );
    expect(Object.values(manifest.referenceDecisions)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "Groep 1A", parent: "KCS Bovenbouw" }),
        expect.objectContaining({ value: "Groep 7D", parent: "KCS Onderbouw" }),
        expect.objectContaining({ value: "LOK 15", parent: "KH" }),
        expect.objectContaining({ value: "Cab 3", parent: "KH" }),
      ]),
    );
    expect(
      manifest.supplementalReferences.filter((item) => item.value === "KCSMD"),
    ).toHaveLength(1);
    expect(manifest.supplementalReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "UPS" }),
        expect.objectContaining({ value: "PR" }),
        expect.objectContaining({ value: "MON" }),
        expect.objectContaining({ value: "KB" }),
        expect.objectContaining({ value: "MW", description: "Mouse wired" }),
        expect.objectContaining({
          value: "MWS",
          description: "Mouse wireless",
        }),
      ]),
    );
  });
  it("applies approved bulk resolutions without writing data", () => {
    const run = dryRunLegacyMigration({
      ...context(),
      masterRows: [
        { Code: "KCSDB48", Serial: "A" },
        { Code: "KCSDB48", Serial: "B" },
      ],
      historyRows: [
        { __sourceSheet: "KCSDB48", Date: "5 Julie 2024", Status: "Repair" },
        { __sourceSheet: "KCSDB15", Date: "", Status: "Repair" },
      ],
    });
    const manifest = applyApprovedBulkResolutions(
      run,
      newReviewManifest("files"),
      {
        defaultDate: "2024-01-01",
        createAssetsBySheet: {
          KCSDB15: {
            assetCode: "KCSDB-15",
            name: "Digibord",
            category: "DIGIBORD",
          },
        },
      },
    );
    const blockers = reviewBlockers(run, manifest);
    expect(blockers.duplicates).toBe(0);
    expect(blockers.history).toBe(0);
    expect(blockers.dates).toBe(0);
    expect(reviewCreatedAssets(manifest)).toEqual([
      { assetCode: "KCSDB-15", name: "Digibord", category: "DIGIBORD" },
    ]);
    expect(
      Object.values(manifest.dateDecisions).some(
        (decision) => decision.date === "2024-01-01T00:00:00.000Z",
      ),
    ).toBe(true);
  });
});
