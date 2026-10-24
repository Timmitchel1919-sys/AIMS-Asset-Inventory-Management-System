// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { HeroTile } from "./HeroTile";
import type { Asset, Movement } from "../../../../domain/types";

function makeAsset(partial: Partial<Asset>): Asset {
  return {
    id: partial.id ?? "a",
    code: "ICT-0001",
    codePrefix: "ICT",
    codeNumber: 1,
    name: "Test",
    category: "Laptop",
    type: "device",
    brand: "Brand",
    model: "Model",
    serialNumber: "SN",
    location: "Loc",
    department: "ICT",
    status: "Available",
    condition: "Good",
    purchaseDate: "2026-01-01",
    warrantyExpiry: "2027-01-01",
    lastUpdated: "2026-01-01",
    qr: false,
    ...partial,
  } as Asset;
}

function makeMovement(partial: Partial<Movement>): Movement {
  return {
    id: partial.id ?? "m",
    reference: "REF",
    type: "Issue",
    asset: "x",
    assetCode: "ICT-0001",
    from: "A",
    to: "B",
    by: "User",
    date: "2026-10-24T00:00:00.000Z",
    quantity: 1,
    ...partial,
  } as Movement;
}

describe("HeroTile", () => {
  it("excludes Disposed and Archived assets from the total", () => {
    const assets = [
      makeAsset({ id: "1", status: "Available" }),
      makeAsset({ id: "2", status: "Assigned" }),
      makeAsset({ id: "3", status: "Disposed" }),
      makeAsset({ id: "4", status: "Archived" }),
    ];
    const { container } = render(
      <HeroTile
        nl={false}
        assets={assets}
        movements={[]}
        now={new Date("2026-10-24T12:00:00.000Z")}
      />,
    );
    const kpi = container.querySelector(".bento-hero__kpi-value");
    expect(kpi?.textContent).toBe("2");
  });

  it("counts movement events within the 30-day window (unsigned)", () => {
    const now = new Date("2026-10-24T12:00:00.000Z");
    const movements = [
      makeMovement({ id: "1", type: "Issue", quantity: 3, date: "2026-10-20T00:00:00.000Z" }),
      makeMovement({ id: "2", type: "Return", quantity: 1, date: "2026-10-22T00:00:00.000Z" }),
    ];
    const { container } = render(
      <HeroTile nl={false} assets={[]} movements={movements} now={now} />,
    );
    const sub = container.querySelector(".bento-hero__kpi-sub");
    // 2 events in the window — count only, no sign.
    expect(sub?.textContent).toContain("30-day activity");
    expect(sub?.textContent).toContain("2");
    expect(sub?.textContent).not.toContain("−");
    expect(sub?.textContent).not.toContain("+");
  });

  it("shows the empty-state message when there are no movements in the 30-day window", () => {
    const { container } = render(
      <HeroTile
        nl={false}
        assets={[]}
        movements={[]}
        now={new Date("2026-10-24T12:00:00.000Z")}
      />,
    );
    const empty = container.querySelector(".bento-hero__empty");
    expect(empty?.textContent).toBe("No asset movements in the last 30 days.");
    // The strip is not rendered when the window is empty.
    expect(container.querySelector(".bento-hero__strip")).toBeNull();
  });

  it("renders a 30-day aria label on the strip when there is activity", () => {
    const now = new Date("2026-10-24T12:00:00.000Z");
    const movements = [
      makeMovement({ id: "1", type: "Issue", quantity: 1, date: "2026-10-20T00:00:00.000Z" }),
    ];
    const { container } = render(
      <HeroTile nl={false} assets={[]} movements={movements} now={now} />,
    );
    const strip = container.querySelector(".bento-hero__strip");
    expect(strip?.getAttribute("aria-label")).toMatch(
      /Daily movement events over 30 days/,
    );
  });
});
