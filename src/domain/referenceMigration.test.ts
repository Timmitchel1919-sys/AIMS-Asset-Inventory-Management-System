import { describe, expect, it } from "vitest";
import { assets as seedAssets } from "../data/mock";
import type { CodeGroup, ReferenceRecord, SystemUser } from "../data/contracts";
import type { AssetTypeRecord } from "./assetTypes";
import {
  changesOf,
  planReferenceMigration,
  reportToCsv,
  type MigrationInput,
} from "./referenceMigration";
import type { Asset } from "./types";

const ref = (over: Partial<ReferenceRecord>): ReferenceRecord =>
  ({
    id: "r",
    kind: "category",
    name: "x",
    type: "Hierarchy",
    status: "Active",
    relatedCount: 0,
    details: {},
    ...over,
  }) as ReferenceRecord;
const group = (over: Partial<CodeGroup>): CodeGroup =>
  ({
    id: "g",
    name: "G",
    prefix: "G",
    minimumNumber: 1,
    maximumNumber: 1e9,
    nextAvailableNumber: 1,
    isActive: true,
    sortOrder: 1,
    createdAt: "",
    updatedAt: "",
    ...over,
  }) as CodeGroup;
const user = (id: string, name: string, email: string): SystemUser =>
  ({ id, name, email, role: "ict-staff", department: "", status: "Active", lastLogin: "" }) as SystemUser;
const serialized: AssetTypeRecord = {
  id: "serialized",
  name: "Serialized",
  description: "",
  behavior: "SERIALIZED",
  status: "Active",
};
const asset = (over: Partial<Asset>): Asset =>
  ({
    ...seedAssets[0],
    id: "a1",
    code: "KCSL-001",
    codePrefix: "KCSL",
    category: "Laptops",
    department: "ICT",
    assignedTo: "Ann Lee",
    mainLocationId: "loc1",
    categoryId: undefined,
    assetTypeId: undefined,
    codeGroupId: undefined,
    departmentId: undefined,
    assignedUserId: undefined,
    ...over,
  }) as Asset;

const base = (over: Partial<MigrationInput> = {}): MigrationInput => ({
  assets: [asset({})],
  references: [
    ref({ id: "cat-top", name: "Computers", details: { level: "category" } }),
    ref({ id: "cat-laptops", name: "Laptops", details: { level: "asset_name", categoryId: "cat-top" } }),
    ref({ id: "dept-ict", kind: "department", name: "ICT", mainLocationId: "loc1" }),
  ],
  codeGroups: [group({ id: "cg-l", name: "Laptops", prefix: "KCSL" })],
  users: [user("u1", "Ann Lee", "ann@kangoeroeschool.com")],
  assetTypes: [serialized],
  ...over,
});
const plan = (input: MigrationInput) => planReferenceMigration(input).plans[0].fields;

describe("reference migration planner", () => {
  it("proposes every id on exact, unique matches", () => {
    const f = plan(base());
    expect(f.categoryId).toEqual({ outcome: "will-fill", id: "cat-laptops" });
    expect(f.assetTypeId).toEqual({ outcome: "will-fill", id: "serialized" });
    expect(f.codeGroupId).toEqual({ outcome: "will-fill", id: "cg-l" });
    expect(f.departmentId).toEqual({ outcome: "will-fill", id: "dept-ict" });
    expect(f.assignedUserId).toEqual({ outcome: "will-fill", id: "u1" });
  });

  it("matches ignoring case and extra whitespace, and by e-mail for the assignee", () => {
    const f = plan(base({ assets: [asset({ category: "  laptops ", assignedTo: "ANN@kangoeroeschool.com", department: "ict" })] }));
    expect(f.categoryId.id).toBe("cat-laptops");
    expect(f.assignedUserId.id).toBe("u1");
    expect(f.departmentId.id).toBe("dept-ict");
  });

  it("never overwrites an existing id, even if the text now disagrees", () => {
    const f = plan(base({ assets: [asset({ categoryId: "cat-top", codeGroupId: "cg-l", assignedUserId: "someone-else" })] }));
    expect(f.categoryId).toEqual({ outcome: "conflict", id: "cat-top" });
    expect(f.codeGroupId).toEqual({ outcome: "already-set", id: "cg-l" });
    expect(f.assignedUserId).toEqual({ outcome: "conflict", id: "someone-else" });
    expect(changesOf(planReferenceMigration(base({ assets: [asset({ categoryId: "cat-top" })] })).plans[0]).some((c) => c.field === "categoryId")).toBe(false);
  });

  it("is idempotent: a second run over migrated assets proposes nothing", () => {
    const first = planReferenceMigration(base());
    const migrated = asset(Object.fromEntries(changesOf(first.plans[0]).map((c) => [c.field, c.id])));
    const second = planReferenceMigration(base({ assets: [migrated] }));
    expect(changesOf(second.plans[0])).toEqual([]);
    expect(second.summary.assetsWithChanges).toBe(0);
  });

  it("leaves ambiguous matches empty and reports the candidates", () => {
    const input = base({
      references: [
        ...base().references,
        ref({ id: "dept-ict-2", kind: "department", name: "ICT", mainLocationId: "loc2" }),
      ],
      users: [...base().users, user("u2", "Ann Lee", "ann.lee2@kangoeroeschool.com")],
    });
    const f = plan(input);
    // Same department name, but the Hoofdlocatie breaks the tie.
    expect(f.departmentId).toEqual({ outcome: "will-fill", id: "dept-ict" });
    // Two users with the same name cannot be resolved safely.
    expect(f.assignedUserId.outcome).toBe("ambiguous");
    expect(f.assignedUserId.note).toContain("ann.lee2@kangoeroeschool.com");
    const tie = plan({ ...input, assets: [asset({ mainLocationId: "loc9" })] });
    expect(tie.departmentId.outcome).toBe("ambiguous");
  });

  it("reports unmatched text instead of guessing", () => {
    const report = planReferenceMigration(
      base({ assets: [asset({ category: "Hoverboards", codePrefix: "ZZ", department: "Unknown", assignedTo: "Nobody" })] }),
    );
    const f = report.plans[0].fields;
    expect(f.categoryId.outcome).toBe("no-match");
    expect(f.codeGroupId.outcome).toBe("no-match");
    expect(f.departmentId.outcome).toBe("no-match");
    expect(f.assignedUserId.outcome).toBe("no-match");
    expect(report.unmatched.categoryId).toEqual([{ value: "Hoverboards", count: 1 }]);
    expect(changesOf(report.plans[0]).map((c) => c.field)).toEqual(["assetTypeId"]);
  });

  it("treats blank department/assignee as not applicable and a missing default type as blocked", () => {
    const f = plan(base({ assets: [asset({ department: "", assignedTo: "" })], assetTypes: [] }));
    expect(f.departmentId.outcome).toBe("not-applicable");
    expect(f.assignedUserId.outcome).toBe("not-applicable");
    expect(f.assetTypeId.outcome).toBe("blocked");
    expect(plan(base({ assetTypes: [{ ...serialized, status: "Archived" }] })).assetTypeId.outcome).toBe("blocked");
  });

  it("ignores archived categories/departments but still maps archived code groups (historic codes)", () => {
    const input = base({
      references: base().references.map((r) => (r.id === "cat-laptops" ? { ...r, status: "Archived" as const } : r)),
      codeGroups: [group({ id: "cg-old", prefix: "KCSL", archived: true })],
    });
    const f = plan(input);
    expect(f.categoryId.outcome).toBe("no-match");
    expect(f.codeGroupId).toEqual({ outcome: "will-fill", id: "cg-old" });
  });

  it("summarises counts and flags assets without any location reference", () => {
    const report = planReferenceMigration(
      base({ assets: [asset({}), asset({ id: "a2", code: "KCSL-002", mainLocationId: undefined, currentLocationId: undefined, assignedTo: "" })] }),
    );
    expect(report.summary.totalAssets).toBe(2);
    expect(report.summary.assetsWithChanges).toBe(2);
    expect(report.summary.missingLocation).toBe(1);
    expect(report.summary.perField.assignedUserId["will-fill"]).toBe(1);
    expect(report.summary.perField.assignedUserId["not-applicable"]).toBe(1);
  });

  it("exports the issues as CSV with quoting, skipping fine rows", () => {
    const csv = reportToCsv(planReferenceMigration(base({ assets: [asset({ category: 'Say "hi"' })] })));
    expect(csv.split("\n")[0]).toBe('"Inv.code","Field","Outcome","Proposed/current id","Note"');
    expect(csv).toContain('"KCSL-001","categoryId","no-match"');
    expect(csv).not.toContain("not-applicable");
  });
});

import { resolveAssetReferences } from "./referenceMigration";

describe("resolveAssetReferences (live sync after a user action)", () => {
  const lookups = () => {
    const { assets: _a, assetTypes: _t, ...rest } = base();
    return rest;
  };
  it("derives ids from the asset text", () => {
    expect(resolveAssetReferences(asset({}), lookups())).toEqual({
      categoryId: "cat-laptops",
      codeGroupId: "cg-l",
      departmentId: "dept-ict",
      assignedUserId: "u1",
    });
  });
  it("keeps a still-valid id, replaces a stale one, clears unmatched or emptied text", () => {
    expect(resolveAssetReferences(asset({ assignedUserId: "u1" }), lookups()).assignedUserId).toBe("u1");
    // The user reassigned the asset to someone else: the old id must not linger.
    const moved = asset({ assignedUserId: "u1", assignedTo: "Bob Roe" });
    const withBob = { ...lookups(), users: [...lookups().users, user("u2", "Bob Roe", "bob@kangoeroeschool.com")] };
    expect(resolveAssetReferences(moved, withBob).assignedUserId).toBe("u2");
    expect(resolveAssetReferences(moved, lookups()).assignedUserId).toBeNull();
    // Returned / unassigned: id cleared.
    expect(resolveAssetReferences(asset({ assignedUserId: "u1", assignedTo: undefined }), lookups()).assignedUserId).toBeNull();
  });
  it("does not guess when the text is ambiguous", () => {
    const dup = { ...lookups(), users: [...lookups().users, user("u9", "Ann Lee", "other@kangoeroeschool.com")] };
    expect(resolveAssetReferences(asset({}), dup).assignedUserId).toBeNull();
    expect(resolveAssetReferences(asset({ assignedUserId: "u1" }), dup).assignedUserId).toBe("u1");
  });
});
