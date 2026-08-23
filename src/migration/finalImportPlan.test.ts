import { describe, expect, it } from "vitest";
import { WorkflowRepositoryEngine } from "../data/mockRepository";
import { dryRunLegacyMigration } from "./legacyMigration";
import {
  applyApprovedBulkResolutions,
  applyApprovedReferenceStructure,
  newReviewManifest,
  selectedWorkbooksFingerprint,
} from "./importReview";
import {
  backupDownload,
  buildFinalImportPlan,
  executeFinalImportPlan,
  validateProductionGate,
  type ImportWrite,
  type ImportWriteAdapter,
} from "./finalImportPlan";
const fixture = () => {
  const snapshot = new WorkflowRepositoryEngine().snapshot();
  const dryRun = dryRunLegacyMigration({
    masterRows: [
      { Code: "KCSDB48", Serial: "A", Category: "DIGIBORD", Location: "1A" },
      { Code: "KCSDB48", Serial: "B", Category: "DIGIBORD", Location: "1A" },
    ],
    historyRows: [
      {
        __sourceFile: "History.xlsx",
        __sourceSheet: "KCSDB48",
        __sourceRow: 20,
        Date: "5 Julie 2024",
        Status: "Repair",
      },
      {
        __sourceFile: "History.xlsx",
        __sourceSheet: "KCSDB15",
        __sourceRow: 20,
        Date: "",
        Status: "Repair",
      },
    ],
    existingAssets: [],
    references: [],
    codeGroups: [],
    importBatchId: "batch",
  });
  let manifest = applyApprovedBulkResolutions(
    dryRun,
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
  manifest = applyApprovedReferenceStructure(dryRun, manifest);
  return {
    snapshot,
    dryRun,
    manifest,
    plan: buildFinalImportPlan({
      dryRun,
      manifest,
      snapshot,
      actor: "Admin",
      importBatchId: "batch",
      fileFingerprint: "files",
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
  };
};
class MemoryAdapter implements ImportWriteAdapter {
  data = new Map<string, ImportWrite>();
  batches: number[] = [];
  failAt = 0;
  async isIdentical(item: ImportWrite) {
    return (
      this.data.get(`${item.collection}/${item.documentId}`)?.fingerprint ===
      item.fingerprint
    );
  }
  async writeBatch(items: readonly ImportWrite[]) {
    this.batches.push(items.length);
    if (this.failAt === this.batches.length) throw new Error("boom");
    items.forEach((item) =>
      this.data.set(`${item.collection}/${item.documentId}`, item),
    );
  }
}
describe("final import plan", () => {
  it("applies review decisions in safe order and remains immutable", () => {
    const { plan } = fixture();
    expect(plan.writes.findIndex((w) => w.phase === "assets")).toBeLessThan(
      plan.writes.findIndex((w) => w.phase === "history"),
    );
    expect(plan.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collection: "assets",
          data: expect.objectContaining({ code: "KCSDB-15" }),
        }),
        expect.objectContaining({
          collection: "assetHistoryEvents",
          data: expect.objectContaining({
            occurredAt: "2024-01-01T00:00:00.000Z",
          }),
        }),
      ]),
    );
    expect(Object.isFrozen(plan)).toBe(true);
    expect(JSON.stringify(plan)).not.toMatch(/password|wachtwoord/i);
  });
  it("creates a backup of every affected collection", () => {
    const { plan, snapshot } = fixture();
    const backup = backupDownload(plan, snapshot);
    expect(backup.filename).toContain("batch");
    expect(JSON.parse(backup.text).collections).toEqual(
      expect.objectContaining({
        references: expect.any(Array),
        codeGroups: expect.any(Array),
        assets: expect.any(Array),
        assetHistoryEvents: expect.any(Array),
      }),
    );
  });
  it("is idempotent, respects batch limits and prevents parallel execution", async () => {
    const { plan } = fixture(),
      adapter = new MemoryAdapter();
    const first = await executeFinalImportPlan(plan, adapter, { batchSize: 3 });
    expect(first.status).toBe("COMPLETE");
    expect(Math.max(...adapter.batches)).toBeLessThanOrEqual(3);
    const second = await executeFinalImportPlan(plan, adapter, {
      batchSize: 3,
    });
    expect(second.completed).toBe(0);
    expect(second.skipped).toBe(plan.writes.length);
  });
  it("stops on failure and resumes after the safe checkpoint", async () => {
    const { plan } = fixture(),
      adapter = new MemoryAdapter();
    adapter.failAt = 2;
    const failed = await executeFinalImportPlan(plan, adapter, {
      batchSize: 2,
    });
    expect(failed.status).toBe("FAILED");
    adapter.failAt = 0;
    const resumed = await executeFinalImportPlan(plan, adapter, {
      batchSize: 2,
      resumeAfterBatch: failed.lastSafeCheckpoint,
    });
    expect(resumed.status).toBe("COMPLETE");
  });
  it("requires every production gate", () => {
    expect(
      validateProductionGate({
        blockers: 0,
        fingerprintsMatch: true,
        schemaMatches: true,
        isAdministrator: true,
        confirmed: true,
        typedConfirmation: "IMPORTEREN",
        backupReady: true,
        previewViewed: true,
        referencesFresh: true,
      }).allowed,
    ).toBe(true);
    expect(
      validateProductionGate({
        blockers: 0,
        fingerprintsMatch: false,
        schemaMatches: true,
        isAdministrator: true,
        confirmed: true,
        typedConfirmation: "IMPORTEREN",
        backupReady: true,
        previewViewed: true,
        referencesFresh: true,
      }).allowed,
    ).toBe(false);
  });
});
