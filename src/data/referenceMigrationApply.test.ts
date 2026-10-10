import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetPlan, FieldPlan, ReferenceField } from "../domain/referenceMigration";

const store = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown> | null>(),
  updates: [] as { id: string; data: Record<string, unknown> }[],
  logs: [] as Record<string, unknown>[],
  failFor: new Set<string>(),
}));

vi.mock("../lib/firebase", () => ({ firestore: {} }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  doc: (target: unknown, ...rest: string[]) =>
    rest.length ? { id: rest[rest.length - 1] } : { id: `new-${Math.random()}`, log: true, target },
  serverTimestamp: () => "SERVER_TS",
  writeBatch: () => ({
    set: (_ref: unknown, data: Record<string, unknown>) => store.logs.push(data),
    commit: async () => undefined,
  }),
  runTransaction: async (_db: unknown, fn: (t: unknown) => Promise<unknown>) =>
    fn({
      get: async (ref: { id: string }) => {
        if (store.failFor.has(ref.id)) throw new Error("boom");
        const data = store.docs.get(ref.id);
        return { exists: () => !!data, data: () => data };
      },
      update: (ref: { id: string }, data: Record<string, unknown>) => store.updates.push({ id: ref.id, data }),
    }),
}));

import { applyReferenceMigration } from "./referenceMigrationApply";

const fill = (field: ReferenceField, id: string): [ReferenceField, FieldPlan] => [field, { outcome: "will-fill", id }];
const plan = (assetId: string, entries: [ReferenceField, FieldPlan][]): AssetPlan => {
  const none: FieldPlan = { outcome: "not-applicable" };
  return {
    assetId,
    code: `CODE-${assetId}`,
    missingLocation: false,
    fields: {
      categoryId: none, assetTypeId: none, codeGroupId: none, departmentId: none, assignedUserId: none,
      ...Object.fromEntries(entries),
    } as AssetPlan["fields"],
  };
};

beforeEach(() => {
  store.docs.clear();
  store.updates.length = 0;
  store.logs.length = 0;
  store.failFor.clear();
});

describe("applyReferenceMigration", () => {
  it("writes only proposed fields plus audit metadata, never other fields", async () => {
    store.docs.set("a1", { code: "KCSL-001", category: "Laptops" });
    const result = await applyReferenceMigration([plan("a1", [fill("categoryId", "c1"), fill("codeGroupId", "g1")])], { uid: "owner", name: "Owner" });
    expect(result).toMatchObject({ updated: 1, fieldsWritten: 2, skippedChanged: 0 });
    expect(store.updates).toHaveLength(1);
    expect(Object.keys(store.updates[0].data).sort()).toEqual(["categoryId", "codeGroupId", "updatedAt", "updatedBy"]);
    expect(store.updates[0].data).toMatchObject({ categoryId: "c1", codeGroupId: "g1", updatedBy: "owner" });
  });

  it("never overwrites a field that was filled after the report was made", async () => {
    store.docs.set("a1", { categoryId: "set-by-someone", departmentId: null });
    const result = await applyReferenceMigration([plan("a1", [fill("categoryId", "c1"), fill("departmentId", "d1")])], { uid: "owner" });
    expect(result.fieldsWritten).toBe(1);
    expect(store.updates[0].data.departmentId).toBe("d1");
    expect(store.updates[0].data).not.toHaveProperty("categoryId");
  });

  it("skips fully-changed and deleted assets without writing", async () => {
    store.docs.set("a1", { categoryId: "x" });
    store.docs.set("a2", null);
    const result = await applyReferenceMigration([plan("a1", [fill("categoryId", "c1")]), plan("a2", [fill("categoryId", "c1")])], { uid: "owner" });
    expect(result).toMatchObject({ updated: 0, skippedChanged: 1, skippedMissing: 1 });
    expect(store.updates).toHaveLength(0);
  });

  it("ignores plans with nothing to write and reports failures per chunk, still auditing the run", async () => {
    store.docs.set("a1", {});
    store.failFor.add("a1");
    const result = await applyReferenceMigration([plan("a0", []), plan("a1", [fill("assetTypeId", "serialized")])], { uid: "owner", name: "Owner" });
    expect(result.failedAssets).toEqual(["CODE-a1"]);
    expect(result.updated).toBe(0);
    expect(store.logs).toHaveLength(1);
    expect(store.logs[0]).toMatchObject({ action: "ASSET_REFERENCES_MIGRATED", result: "Failure", createdBy: "owner" });
  });

  it("processes large runs in chunks of 100 transactions", async () => {
    const plans = Array.from({ length: 250 }, (_, i) => {
      store.docs.set(`b${i}`, {});
      return plan(`b${i}`, [fill("assetTypeId", "serialized")]);
    });
    const progress: number[] = [];
    const result = await applyReferenceMigration(plans, { uid: "owner" }, (done) => progress.push(done));
    expect(result.updated).toBe(250);
    expect(progress).toEqual([100, 200, 250]);
  });
});
