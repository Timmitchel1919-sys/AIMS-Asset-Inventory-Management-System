import { describe, expect, it } from "vitest";
import { emptyMovementFilters, filterMovements, invalidDateRange } from "./movementFilters";
import type { Movement } from "./types";

const m = (over: Partial<Movement>): Movement =>
  ({ id: "m", reference: "R", type: "Transfer", asset: "A", assetCode: "X-1", from: "", to: "", by: "u", date: "2026-03-10T09:00:00Z", quantity: 1, ...over }) as Movement;
const rows = [
  m({ id: "1", type: "Transfer", date: "2026-03-01", destinationDepartment: "Groep 1A" }),
  m({ id: "2", type: "Assignment", date: "2026-03-10T23:59:00Z", sourceDepartment: "ICT" }),
  m({ id: "3", type: "Transfer", date: "2026-04-01", relatedDepartment: "Groep 2B" }),
];
const ids = (f: Partial<typeof emptyMovementFilters>) => filterMovements(rows, { ...emptyMovementFilters, ...f }).map((r) => r.id);

describe("movement history filters", () => {
  it("returns everything when no filter is set and never mutates the history", () => {
    const copy = JSON.stringify(rows);
    expect(ids({})).toEqual(["1", "2", "3"]);
    expect(JSON.stringify(rows)).toBe(copy);
  });
  it("filters by type", () => expect(ids({ type: "Transfer" })).toEqual(["1", "3"]));
  it("treats the date range as inclusive on both ends, including a timestamp on the last day", () => {
    expect(ids({ from: "2026-03-01", to: "2026-03-10" })).toEqual(["1", "2"]);
    expect(ids({ from: "2026-03-11" })).toEqual(["3"]);
    expect(ids({ to: "2026-02-28" })).toEqual([]);
  });
  it("filters by department on either side or the related department", () => {
    expect(ids({ department: "Groep 1A" })).toEqual(["1"]);
    expect(ids({ department: "ICT" })).toEqual(["2"]);
    expect(ids({ department: "Groep 2B" })).toEqual(["3"]);
  });
  it("combines filters and detects an impossible range", () => {
    expect(ids({ type: "Transfer", from: "2026-03-15" })).toEqual(["3"]);
    expect(invalidDateRange({ from: "2026-05-01", to: "2026-04-01" })).toBe(true);
    expect(invalidDateRange({ from: "", to: "2026-04-01" })).toBe(false);
  });
});
