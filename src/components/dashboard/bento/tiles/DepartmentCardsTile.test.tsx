// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { DepartmentCardsTile } from "./DepartmentCardsTile";
import type { Asset } from "../../../../domain/types";
import type { ReferenceRecord } from "../../../../data/contracts";

function dept(id: string, name: string, status: ReferenceRecord["status"] = "Active"): ReferenceRecord {
  return {
    id, kind: "department", name, type: "department",
    status, relatedCount: 0, details: {},
  };
}

function asset(id: string, departmentId: string | undefined, department: string, status: Asset["status"] = "Available"): Asset {
  return {
    id, code: id, codePrefix: "ICT", codeNumber: 1, name: id,
    category: "Laptop", type: "device", brand: "", model: "", serialNumber: "",
    location: "", department, departmentId: departmentId ?? null,
    status, condition: "Good", purchaseDate: "", warrantyExpiry: "",
    lastUpdated: "", qr: false,
  } as Asset;
}

describe("DepartmentCardsTile", () => {
  it("counts active assets per department (canonical id first)", () => {
    const refs = [dept("d1", "ICT"), dept("d2", "Facilities")];
    const assets = [
      asset("a1", "d1", "ICT"),
      asset("a2", "d1", "ICT"),
      asset("a3", "d2", "Facilities"),
    ];
    const { container } = render(
      <DepartmentCardsTile nl={false} references={refs} assets={assets} />,
    );
    const rows = container.querySelectorAll(".bento-cards__row");
    expect(rows.length).toBe(2);
    // Highest-count department renders first
    expect(rows[0].textContent).toContain("ICT");
    // Primary KPI is the ACTIVE count (consistent with Hero tile).
    expect(rows[0].querySelector(".bento-cards__count")?.textContent).toBe("2");
  });

  it("primary KPI excludes Disposed and Archived assets (consistent with Hero tile)", () => {
    const refs = [dept("d1", "ICT")];
    // 2 Available + 1 Disposed + 1 Archived → active = 2, total = 4
    const assets = [
      asset("a1", "d1", "ICT", "Available"),
      asset("a2", "d1", "ICT", "Available"),
      asset("retired-d", "d1", "ICT", "Disposed"),
      asset("retired-a", "d1", "ICT", "Archived"),
    ];
    const { container } = render(
      <DepartmentCardsTile nl={false} references={refs} assets={assets} />,
    );
    const row = container.querySelector(".bento-cards__row")!;
    const primary = row.querySelector(".bento-cards__count");
    expect(primary?.textContent).toBe("2"); // active, not 4 (total)
    // The retired tally is still surfaced on the subline so nothing is hidden.
    expect(row.querySelector(".bento-cards__sub")?.textContent).toContain("retired");
    // Tooltip explicitly discloses the full total.
    expect(primary?.getAttribute("title")).toContain("4");
  });

  it("falls back to legacy department-name match when departmentId is absent", () => {
    const refs = [dept("d1", "ICT")];
    const assets = [asset("legacy1", undefined, "ICT")];
    const { container } = render(
      <DepartmentCardsTile nl={false} references={refs} assets={assets} />,
    );
    expect(container.querySelector(".bento-cards__count")?.textContent).toBe("1");
    // No unassigned row produced
    expect(container.querySelector(".bento-cards__row--unassigned")).toBeNull();
  });

  it("buckets assets with no matching department into Unassigned", () => {
    const refs = [dept("d1", "ICT")];
    const assets = [
      asset("a1", "d1", "ICT"),
      asset("orphan", undefined, "Unknown Dept"),
    ];
    const { container } = render(
      <DepartmentCardsTile nl={false} references={refs} assets={assets} />,
    );
    const unassigned = container.querySelector(".bento-cards__row--unassigned");
    expect(unassigned).not.toBeNull();
    expect(unassigned!.textContent).toContain("Unassigned");
    expect(unassigned!.querySelector(".bento-cards__count")?.textContent).toBe("1");
  });

  it("shows an empty state when no departments are configured", () => {
    const { container } = render(
      <DepartmentCardsTile nl={false} references={[]} assets={[]} />,
    );
    expect(container.textContent).toContain("No departments configured");
  });

  it("does NOT double-count an asset that matches two departments by id vs name", () => {
    const refs = [dept("d1", "ICT"), dept("d2", "ICT Workshop")];
    const assets = [
      // Belongs to d1 by canonical id; its department name also matches d2 by substring but
      // the helper uses exact normalized name match, so d2 must NOT also claim this asset.
      asset("a1", "d1", "ICT"),
    ];
    const { container } = render(
      <DepartmentCardsTile nl={false} references={refs} assets={assets} />,
    );
    const rows = container.querySelectorAll(".bento-cards__row");
    // Two rows (both departments), total active across rows == 1
    const totalCount = Array.from(rows)
      .map((r) => Number(r.querySelector(".bento-cards__count")?.textContent ?? 0))
      .reduce((s, n) => s + n, 0);
    expect(totalCount).toBe(1);
  });
});
