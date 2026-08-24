import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { WorkflowRepositoryEngine } from "../data/mockRepository";
import { parseCombinedWorkbooks } from "./combinedWorkbookImport";
import { buildFinalImportPlan } from "./finalImportPlan";
import { dryRunLegacyMigration } from "./legacyMigration";
import {
  applyApprovedBulkResolutions,
  applyApprovedReferenceStructure,
  newReviewManifest,
  reviewBlockers,
} from "./importReview";

const masterPath = process.env.AIMS_MASTER_XLSX;
const historyPath = process.env.AIMS_HISTORY_XLSX;
const enabled = Boolean(masterPath && historyPath);

describe.skipIf(!enabled)("real approved AIMS import plan", () => {
  it("builds an immutable, blocker-free plan from the original workbooks", async () => {
    const [masterBytes, historyBytes] = await Promise.all([
      readFile(masterPath!),
      readFile(historyPath!),
    ]);
    const source = await parseCombinedWorkbooks(
      new File([masterBytes], "MASTER INVENTORY 2026.xlsx"),
      new File([historyBytes], "History Log .xlsx"),
    );
    const snapshot = new WorkflowRepositoryEngine().snapshot();
    const dryRun = dryRunLegacyMigration({
      masterRows: source.master.rows,
      historyRows: source.history.rows,
      existingAssets: snapshot.assets,
      references: snapshot.references,
      codeGroups: snapshot.codeGroups,
      importBatchId: "real-verification",
    });
    dryRun.excludedSensitiveFields =
      source.master.excludedSensitiveFields +
      source.history.excludedSensitiveFields;
    let manifest = applyApprovedBulkResolutions(
      dryRun,
      newReviewManifest("original-files"),
      {
        defaultDate: "2024-01-01",
        createAssetsBySheet: {
          KCSDB15: {
            assetCode: "KCSDB-15",
            name: "Digibord KCSDB15",
            category: "DIGIBORD",
          },
          "KYOCERA ECOSYS - ADMIN": {
            assetCode: "PR-10",
            name: "KYOCERA ECOSYS - ADMIN",
            category: "PRINTERSCANNER",
          },
        },
      },
    );
    manifest = applyApprovedReferenceStructure(dryRun, manifest);
    const blockers = reviewBlockers(dryRun, manifest);
    const plan = buildFinalImportPlan({
      dryRun,
      manifest,
      snapshot,
      actor: "verification-admin",
      importBatchId: "real-verification",
      fileFingerprint: "original-files",
      createdAt: "2026-08-23T00:00:00.000Z",
    });
    const result = {
      dryRun: {
        masterAssets: dryRun.assets.length,
        historyRows: dryRun.historyReview.length,
        sensitiveValuesRemoved: dryRun.excludedSensitiveFields,
      },
      blockers,
      planCounts: plan.counts,
      totalWrites: plan.writes.length,
      skips: plan.skips.length,
      collections: [...new Set(plan.writes.map((write) => write.collection))],
    };
    console.info("AIMS_REAL_IMPORT_PLAN", JSON.stringify(result));
    expect(blockers.total).toBe(0);
    expect(Object.isFrozen(plan)).toBe(true);
    const keys: string[] = [];
    const collectKeys = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(collectKeys);
      if (value && typeof value === "object")
        Object.entries(value).forEach(([key, item]) => {
          keys.push(key);
          collectKeys(item);
        });
    };
    collectKeys(plan);
    expect(keys.join(" ")).not.toMatch(/password|wachtwoord|adminpass/i);
  }, 15_000);
});
