import { describe, expect, it } from "vitest";
import type { ReferenceRecord } from "../data/contracts";
import {
  childLocations,
  isSameOrDescendant,
  locationPath,
  locationPathIds,
  mainLocationIdOf,
  parentLocationIdOf,
  rootLocations,
} from "./locationTree";

const loc = (
  id: string,
  name: string,
  parent: string | null,
  extra: Partial<ReferenceRecord> = {},
): ReferenceRecord => ({
  id,
  kind: "location",
  name,
  type: "General",
  status: "Active",
  relatedCount: 0,
  details: {},
  containerLocationId: parent,
  ...extra,
});

// IT Warehouse > Group 6A > Rack A ; plus a category to prove filtering.
const refs: ReferenceRecord[] = [
  loc("wh", "IT Warehouse", null),
  loc("g6a", "Group 6A", "wh"),
  loc("g1", "Group 1", "wh"),
  loc("rackA", "Rack A", "g6a"),
  loc("archived", "Old Room", "wh", { status: "Archived" }),
  { ...loc("cat", "Laptops", null), kind: "category" },
];

describe("locationTree", () => {
  it("resolves the parent via any of the synonym fields", () => {
    expect(parentLocationIdOf(refs.find((r) => r.id === "rackA"))).toBe("g6a");
    expect(
      parentLocationIdOf({ ...loc("x", "X", null), parentLocationId: "g6a" }),
    ).toBe("g6a");
    expect(parentLocationIdOf(refs.find((r) => r.id === "wh"))).toBe(null);
  });

  it("builds a root->leaf id path", () => {
    expect(locationPathIds(refs, "rackA")).toEqual(["wh", "g6a", "rackA"]);
    expect(locationPathIds(refs, "wh")).toEqual(["wh"]);
    expect(locationPathIds(refs, "missing")).toEqual([]);
  });

  it("renders a readable path with an optional bin", () => {
    expect(locationPath(refs, "rackA")).toBe("IT Warehouse / Group 6A / Rack A");
    expect(locationPath(refs, "g6a", { bin: "Shelf 03" })).toBe(
      "IT Warehouse / Group 6A / Shelf 03",
    );
  });

  it("finds the main (root) location id", () => {
    expect(mainLocationIdOf(refs, "rackA")).toBe("wh");
    expect(mainLocationIdOf(refs, "wh")).toBe("wh");
  });

  it("lists only active locations, filtered by level", () => {
    expect(rootLocations(refs).map((r) => r.id)).toEqual(["wh"]);
    expect(childLocations(refs, "wh").map((r) => r.id)).toEqual(["g1", "g6a"]);
    expect(childLocations(refs, "g6a").map((r) => r.id)).toEqual(["rackA"]);
  });

  it("detects self / descendant for move guards", () => {
    expect(isSameOrDescendant(refs, "rackA", "wh")).toBe(true);
    expect(isSameOrDescendant(refs, "rackA", "rackA")).toBe(true);
    expect(isSameOrDescendant(refs, "g1", "g6a")).toBe(false);
  });

  it("is cycle-safe", () => {
    const cyclic: ReferenceRecord[] = [
      loc("a", "A", "b"),
      loc("b", "B", "a"),
    ];
    expect(locationPathIds(cyclic, "a").length).toBeLessThanOrEqual(2);
  });
});
