// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AssetAgeTile } from "./AssetAgeTile";
import { computeAgeDistribution, yearsBetween } from "./assetAge";
import type { Asset, AssetStatus } from "../../../../domain/types";

const NOW = new Date("2026-10-24T12:00:00.000Z");

function a(id: string, purchaseDate: string, status: AssetStatus = "Available"): Asset {
  return {
    id,
    code: id,
    codePrefix: "ICT",
    codeNumber: 1,
    name: id,
    category: "Laptop",
    type: "device",
    brand: "",
    model: "",
    serialNumber: "",
    location: "",
    department: "",
    status,
    condition: "Good",
    purchaseDate,
    warrantyExpiry: "2027-01-01",
    lastUpdated: "",
    qr: false,
  } as Asset;
}

describe("yearsBetween — calendar-aware anniversary boundaries", () => {
  it("returns 1 on the exact 1-year anniversary", () => {
    expect(yearsBetween(new Date("2025-10-24T00:00:00.000Z"), new Date("2026-10-24T12:00:00.000Z"))).toBe(1);
  });

  it("returns 0 the day before the 1-year anniversary", () => {
    expect(yearsBetween(new Date("2025-10-25T00:00:00.000Z"), new Date("2026-10-24T12:00:00.000Z"))).toBe(0);
  });

  it("handles leap-year birthdays sensibly (Feb 29 → Feb 28 of a non-leap year)", () => {
    // Feb 29, 2024 → Feb 28, 2025: not yet a full year by date comparison
    expect(yearsBetween(new Date("2024-02-29T00:00:00.000Z"), new Date("2025-02-28T12:00:00.000Z"))).toBe(0);
    // Feb 29, 2024 → Mar 1, 2025: 1 full year
    expect(yearsBetween(new Date("2024-02-29T00:00:00.000Z"), new Date("2025-03-01T12:00:00.000Z"))).toBe(1);
  });
});

describe("computeAgeDistribution — bucket boundaries", () => {
  it("excludes Disposed and Archived from the active total", () => {
    const assets = [
      a("ok", "2026-01-01T00:00:00.000Z", "Available"),
      a("gone", "2026-01-01T00:00:00.000Z", "Disposed"),
      a("archived", "2026-01-01T00:00:00.000Z", "Archived"),
    ];
    const d = computeAgeDistribution(assets, NOW);
    expect(d.totalActive).toBe(1);
    expect(d.withValidDate).toBe(1);
    expect(d.buckets.lt1).toBe(1);
  });

  it("places assets at exact anniversary boundaries into the upper bucket", () => {
    // Purchased 2025-10-24 → exactly 1 year old at NOW → "1to3"
    const assets = [a("edge", "2025-10-24T00:00:00.000Z")];
    const d = computeAgeDistribution(assets, NOW);
    expect(d.buckets.lt1).toBe(0);
    expect(d.buckets["1to3"]).toBe(1);
  });

  it("buckets are mutually exclusive and reconcile with totalActive", () => {
    const assets = [
      a("fresh", "2026-05-01T00:00:00.000Z"),   // <1
      a("mid",   "2024-06-01T00:00:00.000Z"),   // ~2 → 1to3
      a("aged",  "2022-05-01T00:00:00.000Z"),   // ~4 → 3to5
      a("old",   "2018-05-01T00:00:00.000Z"),   // ~8 → ge5
    ];
    const d = computeAgeDistribution(assets, NOW);
    const sum = d.buckets.lt1 + d.buckets["1to3"] + d.buckets["3to5"] + d.buckets.ge5 + d.buckets.unknown;
    expect(sum).toBe(d.totalActive);
    expect(d.buckets.lt1).toBe(1);
    expect(d.buckets["1to3"]).toBe(1);
    expect(d.buckets["3to5"]).toBe(1);
    expect(d.buckets.ge5).toBe(1);
  });

  it("classifies future purchase dates as Unknown and counts them as invalid", () => {
    const assets = [a("future", "2030-01-01T00:00:00.000Z")];
    const d = computeAgeDistribution(assets, NOW);
    expect(d.buckets.unknown).toBe(1);
    expect(d.invalidDate).toBe(1);
    expect(d.withValidDate).toBe(0);
    expect(d.oldestYears).toBeNull();
  });

  it("classifies missing / unparseable purchase dates as Unknown", () => {
    const assets = [a("empty", ""), a("junk", "not-a-date")];
    const d = computeAgeDistribution(assets, NOW);
    expect(d.buckets.unknown).toBe(2);
    expect(d.invalidDate).toBe(2);
  });

  it("empty input returns zeroed distribution with null oldest", () => {
    const d = computeAgeDistribution([], NOW);
    expect(d.totalActive).toBe(0);
    expect(d.oldestYears).toBeNull();
    const sum = Object.values(d.buckets).reduce((s, n) => s + n, 0);
    expect(sum).toBe(0);
  });
});

describe("AssetAgeTile", () => {
  it("renders the empty state when no active assets", () => {
    const { container } = render(
      <AssetAgeTile nl={false} assets={[a("gone", "2026-01-01T00:00:00.000Z", "Disposed")]} now={NOW} />,
    );
    expect(container.textContent).toContain("No active assets");
  });

  it("renders a row per bucket and a with-valid-date fraction consistent with Hero semantics", () => {
    const assets = [
      a("ok", "2026-01-01T00:00:00.000Z"),
      a("ok2", "2024-01-01T00:00:00.000Z"),
      a("missing", ""),
    ];
    const { container } = render(
      <AssetAgeTile nl={false} assets={assets} now={NOW} />,
    );
    const rows = container.querySelectorAll(".bento-age__row");
    expect(rows.length).toBe(5); // 4 age buckets + Unknown
    const total = container.querySelector(".bento-age__total");
    expect(total?.textContent).toContain("2"); // withValidDate
    expect(total?.textContent).toContain("3"); // totalActive
  });
});
