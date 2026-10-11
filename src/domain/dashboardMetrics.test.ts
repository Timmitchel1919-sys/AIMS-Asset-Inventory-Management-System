import { describe, expect, it } from "vitest";
import { assetStatusBreakdown } from "./dashboardMetrics";
import type { AssetStatus } from "./types";

const assets = (...statuses: AssetStatus[]) => statuses.map((status) => ({ status }));

describe("dashboard status breakdown", () => {
  it("counts every approved status in the approved order, including zeros", () => {
    const { counts, total, other } = assetStatusBreakdown(
      assets("Available", "Available", "Assigned", "Borrowed", "Reserved", "Under Maintenance", "Under Repair", "Damaged", "Archived"),
    );
    expect(counts.map((c) => c.status)).toEqual([
      "Available", "Assigned", "Borrowed", "Reserved", "Under Maintenance", "Under Repair", "Damaged", "Archived",
    ]);
    expect(counts.map((c) => c.count)).toEqual([2, 1, 1, 1, 1, 1, 1, 1]);
    expect(total).toBe(9);
    expect(other).toBe(0);
    expect(assetStatusBreakdown([]).counts.every((c) => c.count === 0)).toBe(true);
  });
  it("does not force Lost / Missing / Disposed into an approved status", () => {
    const result = assetStatusBreakdown(assets("Lost", "Missing", "Disposed", "Available"));
    expect(result.other).toBe(3);
    expect(result.counts.find((c) => c.key === "available")?.count).toBe(1);
    expect(result.counts.reduce((s, c) => s + c.count, 0) + result.other).toBe(result.total);
  });
  it("changes when an asset changes (no stored counter)", () => {
    const list = assets("Available", "Available");
    expect(assetStatusBreakdown(list).counts[0].count).toBe(2);
    list[0].status = "Assigned";
    const after = assetStatusBreakdown(list);
    expect([after.counts[0].count, after.counts[1].count]).toEqual([1, 1]);
  });
});
