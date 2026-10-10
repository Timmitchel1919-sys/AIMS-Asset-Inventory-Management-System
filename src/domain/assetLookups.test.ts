import { describe, expect, it } from "vitest";
import type { ReferenceRecord, SystemUser } from "../data/contracts";
import {
  assetAssigneeName,
  assetCategoryName,
  assetDepartmentName,
  assetInCategory,
  assetInDepartment,
} from "./assetLookups";
import type { Asset } from "./types";

const ref = (id: string, kind: ReferenceRecord["kind"], name: string) =>
  ({ id, kind, name, status: "Active", type: "", relatedCount: 0, details: {} }) as ReferenceRecord;
const user = (id: string, name: string) => ({ id, name, email: `${id}@x.com` }) as SystemUser;
const asset = (over: Partial<Asset>) =>
  ({ category: "Laptops", department: "ICT", assignedTo: "Ann Lee", ...over }) as Asset;

const refs = [ref("c1", "category", "Laptops v2"), ref("d1", "department", "IT Services"), ref("d2", "department", "Admin")];
const users = [user("u1", "Ann Lee-Smith")];

describe("asset lookups through ids", () => {
  it("shows the current record name when the id resolves (renames propagate)", () => {
    expect(assetCategoryName(asset({ categoryId: "c1" }), refs)).toBe("Laptops v2");
    expect(assetDepartmentName(asset({ departmentId: "d1" }), refs)).toBe("IT Services");
    expect(assetAssigneeName(asset({ assignedUserId: "u1" }), users)).toBe("Ann Lee-Smith");
  });
  it("falls back to the stored text when there is no id or it no longer resolves", () => {
    expect(assetCategoryName(asset({}), refs)).toBe("Laptops");
    expect(assetDepartmentName(asset({ departmentId: "gone" }), refs)).toBe("ICT");
    expect(assetAssigneeName(asset({ assignedUserId: "gone" }), users)).toBe("Ann Lee");
    expect(assetAssigneeName(asset({ assignedTo: undefined }), users)).toBe("");
  });
  it("ignores a reference of the wrong kind", () => {
    expect(assetCategoryName(asset({ categoryId: "d1" }), refs)).toBe("Laptops");
  });
  it("counts membership by id once set, otherwise by name", () => {
    const dept = { id: "d1", name: "IT Services" };
    expect(assetInDepartment(asset({ departmentId: "d1", department: "Old name" }), dept)).toBe(true);
    expect(assetInDepartment(asset({ departmentId: "d2", department: "IT Services" }), dept)).toBe(false);
    expect(assetInDepartment(asset({ department: "IT Services" }), dept)).toBe(true);
    expect(assetInDepartment(asset({ department: "ICT" }), dept)).toBe(false);
    const cat = { id: "c1", name: "Laptops v2" };
    expect(assetInCategory(asset({ categoryId: "c1", category: "Laptops" }), cat)).toBe(true);
    expect(assetInCategory(asset({ category: "Laptops v2" }), cat)).toBe(true);
    expect(assetInCategory(asset({ categoryId: "c9", category: "Laptops v2" }), cat)).toBe(false);
  });
});
