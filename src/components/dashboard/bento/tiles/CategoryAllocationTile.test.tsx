// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CategoryAllocationTile } from "./CategoryAllocationTile";
import type { Asset } from "../../../../domain/types";

function a(category: string, status: Asset["status"] = "Available", id = category + status): Asset {
  return {
    id,
    code: id,
    codePrefix: "ICT",
    codeNumber: 1,
    name: id,
    category,
    type: "device",
    brand: "",
    model: "",
    serialNumber: "",
    location: "",
    department: "",
    status,
    condition: "Good",
    purchaseDate: "",
    warrantyExpiry: "",
    lastUpdated: "",
    qr: false,
  } as Asset;
}

describe("CategoryAllocationTile", () => {
  it("groups active assets by category and shows the total", () => {
    const { container } = render(
      <CategoryAllocationTile
        nl={false}
        assets={[a("Laptop"), a("Laptop", "Available", "l2"), a("Monitor")]}
      />,
    );
    const total = container.querySelector(".bento-cat__total");
    expect(total?.textContent).toBe("3");
    const segs = container.querySelectorAll(".bento-cat__seg");
    expect(segs.length).toBe(2);
  });

  it("ignores Disposed/Archived assets", () => {
    const { container } = render(
      <CategoryAllocationTile
        nl={false}
        assets={[a("Laptop"), a("Monitor", "Disposed"), a("Monitor", "Archived")]}
      />,
    );
    const total = container.querySelector(".bento-cat__total");
    expect(total?.textContent).toBe("1");
  });

  it("shows an empty state when there are no active assets", () => {
    const { container } = render(
      <CategoryAllocationTile
        nl={false}
        assets={[a("Monitor", "Disposed")]}
      />,
    );
    expect(container.textContent).toContain("No assets to display");
  });
});
