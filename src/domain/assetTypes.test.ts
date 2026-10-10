import { describe, expect, it } from "vitest";
import {
  ASSET_TYPE_ERRORS,
  DEFAULT_ASSET_TYPES,
  assetTypeId,
  validateAssetType,
} from "./assetTypes";

describe("asset type ids and validation", () => {
  it("normalises whitespace, case and accents into one id", () => {
    expect(assetTypeId("  Bulk   Items ")).toBe("bulk-items");
    expect(assetTypeId("bulk items")).toBe("bulk-items");
    expect(assetTypeId("Café-Gear")).toBe("cafe-gear");
  });
  it("blocks duplicates that differ only by spacing or case", () => {
    expect(validateAssetType({ name: " SERIALIZED ", behavior: "SERIALIZED" }, ["serialized"])).toBe("duplicate");
    expect(validateAssetType({ name: "Serialized  ", behavior: "SERIALIZED" }, [])).toBeNull();
  });
  it("allows keeping a record's own name when editing", () => {
    expect(validateAssetType({ name: "Bulk", behavior: "BULK" }, ["bulk"], "bulk")).toBeNull();
  });
  it("rejects empty names, symbol-only names and unknown behaviors", () => {
    expect(validateAssetType({ name: " ", behavior: "BULK" }, [])).toBe("name-required");
    expect(validateAssetType({ name: "!!", behavior: "BULK" }, [])).toBe("name-required");
    expect(validateAssetType({ name: "Thing", behavior: "LEASED" }, [])).toBe("bad-behavior");
    expect(validateAssetType({ name: "x".repeat(81), behavior: "BULK" }, [])).toBe("name-too-long");
  });
  it("ships the three specified behaviors with valid, unique ids and bilingual errors", () => {
    expect(DEFAULT_ASSET_TYPES.map((t) => t.behavior)).toEqual(["SERIALIZED", "BULK", "CONSUMABLE"]);
    expect(new Set(DEFAULT_ASSET_TYPES.map((t) => assetTypeId(t.name))).size).toBe(3);
    expect(ASSET_TYPE_ERRORS.nl.duplicate).toBe("Deze naam bestaat al.");
    expect(ASSET_TYPE_ERRORS.en.duplicate).toBe("This name already exists.");
  });
});
