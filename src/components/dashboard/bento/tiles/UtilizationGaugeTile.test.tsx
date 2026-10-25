// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { UtilizationGaugeTile } from "./UtilizationGaugeTile";
import { classifyUtilization } from "./utilizationBuckets";
import type { Asset, AssetStatus } from "../../../../domain/types";

function a(status: AssetStatus, id: string = status): Asset {
  return {
    id, code: id, codePrefix: "ICT", codeNumber: 1, name: id,
    category: "Laptop", type: "device", brand: "", model: "", serialNumber: "",
    location: "", department: "",
    status, condition: "Good", purchaseDate: "", warrantyExpiry: "",
    lastUpdated: "", qr: false,
  } as Asset;
}

describe("classifyUtilization", () => {
  it("classifies statuses into the agreed buckets", () => {
    const assets = [
      a("Assigned", "x1"), a("Borrowed", "x2"),
      a("Available", "x3"), a("Available", "x4"), a("Available", "x5"),
      a("Reserved", "x6"),
      a("Under Repair", "x7"), a("Damaged", "x8"),
      a("Disposed", "x9"), a("Archived", "x10"),
    ];
    const b = classifyUtilization(assets);
    expect(b.inUse).toBe(2);
    expect(b.available).toBe(3);
    expect(b.reserved).toBe(1);
    expect(b.service).toBe(2);
    expect(b.retired).toBe(2);
    expect(b.unknown).toBe(0);
    // Active total excludes retired (2+3+1+2+0 = 8)
    expect(b.activeTotal).toBe(8);
    // 2 / 8 = 25%
    expect(b.utilizationPct).toBe(25);
  });

  it("buckets any unrecognized status under Unknown without dropping it", () => {
    const assets = [a("Assigned", "x1"), a("WeirdStatus" as AssetStatus, "x2")];
    const b = classifyUtilization(assets);
    expect(b.unknown).toBe(1);
    // Unknown IS part of the denominator so it never silently inflates utilization
    expect(b.activeTotal).toBe(2);
    expect(b.utilizationPct).toBe(50);
  });

  it("returns 0% utilization and avoids division by zero when no active assets", () => {
    const b = classifyUtilization([a("Disposed", "x1"), a("Archived", "x2")]);
    expect(b.activeTotal).toBe(0);
    expect(b.utilizationPct).toBe(0);
  });

  it("numerator never exceeds denominator and buckets reconcile with input", () => {
    const assets = [
      a("Assigned", "x1"), a("Borrowed", "x2"), a("Available", "x3"),
      a("Disposed", "x4"),
    ];
    const b = classifyUtilization(assets);
    expect(b.inUse).toBeLessThanOrEqual(b.activeTotal);
    const totalClassified = b.inUse + b.available + b.reserved + b.service + b.retired + b.unknown;
    expect(totalClassified).toBe(assets.length);
  });
});

describe("UtilizationGaugeTile", () => {
  it("renders the gauge with the computed percentage", () => {
    const assets = [a("Assigned", "x1"), a("Available", "x2")];
    const { container } = render(<UtilizationGaugeTile nl={false} assets={assets} />);
    const pct = container.querySelector(".bento-gauge__pct");
    expect(pct?.textContent).toContain("50");
  });

  it("renders the empty-state when no active assets exist", () => {
    const { container } = render(
      <UtilizationGaugeTile nl={false} assets={[a("Disposed", "x1")]} />,
    );
    expect(container.textContent).toContain("No active assets to measure");
  });
});
