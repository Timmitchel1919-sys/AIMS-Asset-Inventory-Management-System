import { describe, expect, it } from "vitest";
import type { CodeGroup, ReferenceRecord } from "../data/contracts";
import {
  assetTypeAllowed,
  effectiveCategoryRelations,
  findCategoryRecord,
  readAllowedAssetTypeIds,
} from "./categoryRelations";

const ref = (over: Partial<ReferenceRecord>): ReferenceRecord =>
  ({ id: "r", kind: "category", name: "x", type: "Serialized", status: "Active", relatedCount: 0, details: {}, ...over }) as ReferenceRecord;
const group = (over: Partial<CodeGroup>): CodeGroup =>
  ({ id: "g", name: "G", prefix: "G", minimumNumber: 1, maximumNumber: 1e9, nextAvailableNumber: 1, isActive: true, sortOrder: 1, createdAt: "", updatedAt: "", ...over }) as CodeGroup;

const groups = [group({ id: "cg-l", name: "Laptops", prefix: "KCSL" }), group({ id: "cg-b", name: "Boards", prefix: "KCSDB" })];
const refs = [
  ref({ id: "top", name: "Computers", details: { level: "category", codeGroupId: "cg-b", allowedAssetTypeIds: ["serialized"] } }),
  ref({ id: "laptops", name: "Laptops", details: { level: "asset_name", categoryId: "top", codeGroupId: "cg-l" } }),
  ref({ id: "legacy", name: "Tablets", details: { level: "asset_name", categoryId: "top", codeGroup: "KCSL" } }),
  ref({ id: "cables", name: "HDMI cables", details: { level: "asset_name", allowedAssetTypeIds: ["bulk", "consumable"] } }),
];

describe("category relations", () => {
  it("reads the default code group by stable id", () => {
    expect(effectiveCategoryRelations("Laptops", refs, groups).codeGroup?.id).toBe("cg-l");
  });
  it("falls back to the legacy prefix when no id is stored", () => {
    expect(effectiveCategoryRelations("tablets ", refs, groups).codeGroup?.id).toBe("cg-l");
  });
  it("inherits missing relations from the parent category", () => {
    const r = effectiveCategoryRelations("Tablets", refs, groups);
    expect(r.allowedAssetTypeIds).toEqual(["serialized"]);
    // Own definition wins over the parent.
    expect(effectiveCategoryRelations("Laptops", refs, groups).codeGroup?.id).toBe("cg-l");
  });
  it("does not use an archived or unknown code group", () => {
    const archived = [group({ id: "cg-l", prefix: "KCSL", archived: true })];
    expect(effectiveCategoryRelations("Laptops", refs, archived).codeGroup).toBeUndefined();
    expect(effectiveCategoryRelations("Nothing", refs, groups)).toEqual({ allowedAssetTypeIds: [] });
  });
  it("treats an empty allowed list as 'any' and enforces a configured one", () => {
    expect(assetTypeAllowed("bulk", { allowedAssetTypeIds: [] })).toBe(true);
    expect(assetTypeAllowed("bulk", { allowedAssetTypeIds: ["serialized"] })).toBe(false);
    expect(assetTypeAllowed("serialized", { allowedAssetTypeIds: ["serialized"] })).toBe(true);
    expect(assetTypeAllowed("", { allowedAssetTypeIds: ["serialized"] })).toBe(true);
    expect(assetTypeAllowed(null, { allowedAssetTypeIds: ["serialized"] })).toBe(true);
  });
  it("returns a category only when it is unambiguous, preferring the asset level", () => {
    expect(findCategoryRecord("HDMI Cables", refs)?.id).toBe("cables");
    const dup = [...refs, ref({ id: "laptops2", name: "Laptops", details: { level: "asset_name" } })];
    expect(findCategoryRecord("Laptops", dup)).toBeUndefined();
    const sameName = [ref({ id: "t", name: "Same", details: { level: "category" } }), ref({ id: "a", name: "Same", details: { level: "asset_name" } })];
    expect(findCategoryRecord("Same", sameName)?.id).toBe("a");
  });
  it("ignores malformed allowed lists", () => {
    expect(readAllowedAssetTypeIds(ref({ details: { allowedAssetTypeIds: "bulk" as unknown as string[] } }))).toEqual([]);
    expect(readAllowedAssetTypeIds(ref({ details: { allowedAssetTypeIds: ["a", "a", ""] } }))).toEqual(["a"]);
  });
});
