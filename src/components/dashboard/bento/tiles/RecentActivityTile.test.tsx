// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RecentActivityTile } from "./RecentActivityTile";
import type { Movement } from "../../../../domain/types";

function m(id: string, type: string, date: string): Movement {
  return {
    id,
    reference: "R-" + id,
    type,
    asset: "x",
    assetCode: "ICT-" + id,
    from: "A",
    to: "B",
    by: "User",
    date,
    quantity: 1,
  } as Movement;
}

describe("RecentActivityTile", () => {
  it("renders newest-first and respects the limit", () => {
    const movements = [
      m("1", "Issue", "2026-10-20T10:00:00.000Z"),
      m("2", "Return", "2026-10-23T10:00:00.000Z"),
      m("3", "Transfer", "2026-10-21T10:00:00.000Z"),
    ];
    const { container } = render(
      <RecentActivityTile nl={false} movements={movements} limit={2} />,
    );
    const rows = container.querySelectorAll("li.bento-act__row");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("ICT-2");
    expect(rows[1].textContent).toContain("ICT-3");
  });

  it("shows an empty state when there are no movements", () => {
    const { container } = render(
      <RecentActivityTile nl={false} movements={[]} />,
    );
    expect(container.textContent).toContain("No recent movements");
  });

  it("shows the quantity verbatim without a +/- sign (event, not stock delta)", () => {
    const movements = [m("1", "Return", "2026-10-23T10:00:00.000Z")];
    const { container } = render(
      <RecentActivityTile nl={false} movements={movements} />,
    );
    const amount = container.querySelector(".bento-act__amount");
    expect(amount?.textContent).toBe("qty 1");
    expect(amount?.textContent).not.toContain("+");
    expect(amount?.textContent).not.toContain("−");
  });
});
