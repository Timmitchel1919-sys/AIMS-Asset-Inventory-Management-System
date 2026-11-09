import { describe, expect, it } from "vitest";
import { MockInventoryRepository } from "../data/mockRepository";
import { executeListQuery } from "../data/listQuery";
import { buildGlobalSearchIndex, filterGlobalSearchResults } from "../hooks/useGlobalSearch";
import { can } from "../auth/permissions";

const snapshot = new MockInventoryRepository().snapshot();
const asset = snapshot.assets.find((item) => item.code === "KCSMD-147")!;

describe("Global Search uses the shared normalization engine", () => {
  const index = buildGlobalSearchIndex(snapshot, "administrator");
  it.each(["KCSMD-147", "kcsmd-147", "KCSMD147", "kcsmd147", "KCSMD 147", "kcsmd_147", "KCSMD/147", "KCSMD.147", "  kcsmd   147  "])(
    "finds KCSMD-147 for %s",
    (query) => {
      expect(filterGlobalSearchResults(index, query).some((r) => r.code === "KCSMD-147")).toBe(true);
    },
  );

  it("finds serial numbers regardless of separators", () => {
    const compact = asset.serialNumber!.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    expect(filterGlobalSearchResults(index, compact).some((r) => r.code === "KCSMD-147")).toBe(true);
  });

  it("finds inventory movements and borrow records", () => {
    const movement = snapshot.movements[0];
    expect(filterGlobalSearchResults(index, movement.reference).some((r) => r.type === "movement")).toBe(true);
    const borrow = snapshot.borrows[0];
    if (borrow) expect(filterGlobalSearchResults(index, borrow.reference).some((r) => r.type === "borrow")).toBe(true);
  });

  it("keeps the displayed values canonical", () => {
    const hit = filterGlobalSearchResults(index, "kcsmd147").find((r) => r.code === "KCSMD-147")!;
    expect(hit.code).toBe("KCSMD-147");
    expect(asset.code).toBe("KCSMD-147");
  });

  it("never returns record types the role is not authorized for", () => {
    for (const role of ["warehouse-staff", "auditor", "management", "ict-staff"] as const) {
      const results = buildGlobalSearchIndex(snapshot, role);
      if (!can(role, "movements.view")) expect(results.some((r) => r.type === "movement")).toBe(false);
      if (!can(role, "borrow.manage")) expect(results.some((r) => r.type === "borrow")).toBe(false);
      if (!can(role, "users.manage")) expect(results.some((r) => r.type === "user")).toBe(false);
    }
  });
});

describe("module list search uses the same engine", () => {
  const adapter = {
    searchable: ["code", "name", "serialNumber"],
    value: (row: (typeof snapshot.assets)[number], field: string) => (row as unknown as Record<string, unknown>)[field],
  };
  it.each(["kcsmd147", "KCSMD 147", "KCSMD_147", "md147"])("ICT list finds KCSMD-147 for %s", (search) => {
    const result = executeListQuery(snapshot.assets, { search, pageSize: 100 }, adapter);
    expect(result.items.some((row) => row.code === "KCSMD-147")).toBe(true);
  });
});
