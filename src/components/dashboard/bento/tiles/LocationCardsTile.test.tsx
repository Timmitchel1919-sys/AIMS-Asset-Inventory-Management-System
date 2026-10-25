// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LocationCardsTile } from "./LocationCardsTile";
import type { Asset } from "../../../../domain/types";
import type { LocationType, ReferenceRecord } from "../../../../data/contracts";

function loc(id: string, name: string, typeId: string | null, parentId: string | null = null): ReferenceRecord {
  return {
    id, kind: "location", name,
    type: typeId ?? "building",
    typeId: typeId ?? undefined,
    parentLocationId: parentId,
    containerLocationId: parentId,
    parentId: parentId ?? undefined,
    status: "Active",
    relatedCount: 0,
    details: {},
  } as ReferenceRecord;
}

function lt(id: string, name: string, code: string): LocationType {
  return {
    id, name, code, description: "", isActive: true, sortOrder: 1,
    allowedParentTypeIds: [], createdAt: "", updatedAt: "",
  };
}

function asset(id: string, currentLocationId: string | undefined, status: Asset["status"] = "Available"): Asset {
  return {
    id, code: id, codePrefix: "ICT", codeNumber: 1, name: id,
    category: "Laptop", type: "device", brand: "", model: "", serialNumber: "",
    location: "", department: "",
    currentLocationId: currentLocationId ?? undefined,
    status, condition: "Good", purchaseDate: "", warrantyExpiry: "",
    lastUpdated: "", qr: false,
  } as Asset;
}

describe("LocationCardsTile", () => {
  it("aggregates asset counts up to the root location (descendants included once)", () => {
    const refs = [
      loc("root", "Main Building", "building"),
      loc("floor1", "Floor 1", "floor", "root"),
      loc("room-a", "Room A", "classroom", "floor1"),
      loc("other-root", "Warehouse", "warehouse"),
    ];
    const types = [
      lt("building", "Building", "BLDG"),
      lt("floor", "Floor", "FLR"),
      lt("classroom", "Classroom", "CLASS"),
      lt("warehouse", "Warehouse", "WH"),
    ];
    const assets = [
      asset("a1", "room-a"),       // deep descendant of root
      asset("a2", "floor1"),       // direct child of root
      asset("a3", "root"),          // direct on root
      asset("a4", "other-root"),    // other root
    ];
    const { container } = render(
      <LocationCardsTile nl={false} references={refs} locationTypes={types} assets={assets} />,
    );
    const rows = container.querySelectorAll(".bento-cards__row");
    // Expect root = 3 (a1 + a2 + a3), Warehouse = 1
    const counts = Array.from(rows).map(
      (r) => Number(r.querySelector(".bento-cards__count")?.textContent ?? "-1"),
    );
    expect(counts).toContain(3);
    expect(counts).toContain(1);
    // No double counting: total across rows == 4
    expect(counts.reduce((s, n) => s + n, 0)).toBe(4);
  });

  it("renders an Unassigned location bucket for assets with no resolvable location", () => {
    const refs = [loc("r1", "Main", "building")];
    const types = [lt("building", "Building", "BLDG")];
    const assets = [
      asset("a1", "r1"),
      asset("a2", undefined),      // no location
      asset("a3", "nowhere"),       // invalid id, not in references
    ];
    const { container } = render(
      <LocationCardsTile nl={false} references={refs} locationTypes={types} assets={assets} />,
    );
    const unassigned = container.querySelector(".bento-cards__row--unassigned");
    expect(unassigned).not.toBeNull();
    expect(unassigned!.querySelector(".bento-cards__count")?.textContent).toBe("2");
  });

  it("excludes Disposed and Archived assets from counts", () => {
    const refs = [loc("r1", "Main", "building")];
    const types = [lt("building", "Building", "BLDG")];
    const assets = [
      asset("a1", "r1", "Available"),
      asset("a2", "r1", "Disposed"),
      asset("a3", "r1", "Archived"),
    ];
    const { container } = render(
      <LocationCardsTile nl={false} references={refs} locationTypes={types} assets={assets} />,
    );
    expect(container.querySelector(".bento-cards__count")?.textContent).toBe("1");
  });

  it("does NOT double-count an asset that sits deep in a hierarchy and belongs to only one root", () => {
    const refs = [
      loc("root-a", "Site A", "building"),
      loc("floor1", "Floor 1", "floor", "root-a"),
      loc("room-7", "Room 7", "classroom", "floor1"),
      loc("root-b", "Site B", "building"), // unrelated root
    ];
    const types = [
      lt("building", "Building", "BLDG"),
      lt("floor", "Floor", "FLR"),
      lt("classroom", "Classroom", "CLASS"),
    ];
    const assets = [asset("single", "room-7")]; // deep descendant of root-a only
    const { container } = render(
      <LocationCardsTile nl={false} references={refs} locationTypes={types} assets={assets} />,
    );
    const rows = container.querySelectorAll(".bento-cards__row");
    const counts = Array.from(rows).map(
      (r) => Number(r.querySelector(".bento-cards__count")?.textContent ?? "-1"),
    );
    // One asset total, attributed to exactly one root; no double count.
    expect(counts.reduce((s, n) => s + n, 0)).toBe(1);
    // No unassigned bucket produced
    expect(container.querySelector(".bento-cards__row--unassigned")).toBeNull();
  });

  it("shows an empty state when no locations are configured", () => {
    const { container } = render(
      <LocationCardsTile nl={false} references={[]} locationTypes={[]} assets={[]} />,
    );
    expect(container.textContent).toContain("No locations configured");
  });
});
