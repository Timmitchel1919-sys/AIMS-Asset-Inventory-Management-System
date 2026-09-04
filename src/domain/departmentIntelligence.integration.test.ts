import { beforeEach, describe, expect, it } from "vitest";
import { MockInventoryRepository } from "../data/mockRepository";
import {
  assetsForDepartment,
  departmentActivityFeed,
  departmentAssetSummary,
  departmentLocationLabel,
} from "./departmentIntelligence";

/**
 * "Change the asset once → AIMS reflects the change everywhere." These tests
 * exercise the real repository (the same one every page reads through
 * useMockSnapshot) and then re-derive the Department Panel's view straight
 * from the resulting snapshot — there is no separate department store to
 * keep in sync, so a transfer/return propagates purely because the
 * derivation reads live data.
 */
describe("Department Intelligence Panel — derives live from the single asset source of truth", () => {
  let repo: MockInventoryRepository;
  beforeEach(() => (repo = new MockInventoryRepository()));

  const departments = () =>
    repo.snapshot().references.filter((r) => r.kind === "department");
  const otherLocation = (currentId?: string) =>
    repo
      .snapshot()
      .references.filter((r) => r.kind === "location")
      .find((l) => l.id !== currentId) ??
    repo.snapshot().references.filter((r) => r.kind === "location")[0];

  it("a department with no assets shows an empty, all-zero summary", () => {
    const empty = "A Department With No Assets";
    expect(assetsForDepartment(repo.snapshot().assets, empty)).toHaveLength(0);
    expect(
      departmentAssetSummary(
        assetsForDepartment(repo.snapshot().assets, empty),
        repo.snapshot().references,
      ),
    ).toEqual({ total: 0, ict: 0, active: 0, assigned: 0, maintenance: 0, disposed: 0 });
    expect(
      departmentActivityFeed(repo.snapshot().movements, repo.snapshot().assetHistoryEvents, empty),
    ).toEqual([]);
  });

  it("resolves manager and location straight from the department's own reference record", () => {
    const ict = departments().find((d) => d.name === "ICT")!;
    expect(String(ict.details.manager)).toBe("Michael King");
    // No assertion on the exact path text — only that deriving it never throws
    // and degrades to empty strings rather than "undefined"/"null" for a
    // department with no main location configured in the seed data.
    const label = departmentLocationLabel(repo.snapshot().references, ict);
    expect(typeof label.location).toBe("string");
    expect(typeof label.subLocation).toBe("string");
  });

  it("transferring an asset between departments moves it out of the source panel and into the destination panel, with no manual sync", async () => {
    const asset = repo.snapshot().assets.find((a) => a.department === "ICT" && a.status !== "Archived")!;
    const dest = otherLocation(asset.currentLocationId);
    const before = {
      sourceCount: assetsForDepartment(repo.snapshot().assets, "ICT").length,
      destCount: assetsForDepartment(repo.snapshot().assets, "Administration").length,
    };

    const res = await repo.execute({
      action: "asset.move",
      entityId: asset.id,
      actor: "ICT Administrator",
      values: {
        destinationLocationId: dest.id,
        destinationDepartment: "Administration",
        reason: "Reassigned to Administration",
      },
    });
    expect(res.ok).toBe(true);

    // 1) The asset record itself now belongs to the destination department.
    const after = repo.snapshot().assets.find((a) => a.id === asset.id)!;
    expect(after.department).toBe("Administration");

    // 2) Source department panel: the asset disappeared from its list.
    const sourceAfter = assetsForDepartment(repo.snapshot().assets, "ICT");
    expect(sourceAfter.some((a) => a.id === asset.id)).toBe(false);
    expect(sourceAfter).toHaveLength(before.sourceCount - 1);

    // 3) Destination department panel: the asset appeared in its list.
    const destAfter = assetsForDepartment(repo.snapshot().assets, "Administration");
    expect(destAfter.some((a) => a.id === asset.id)).toBe(true);
    expect(destAfter).toHaveLength(before.destCount + 1);

    // 4) History Log: an immutable transfer record exists with both ends.
    const movement = repo.snapshot().movements[0];
    expect(movement.assetId).toBe(asset.id);
    expect(movement.sourceDepartment).toBe("ICT");
    expect(movement.destinationDepartment).toBe("Administration");
    expect(movement.immutable).toBe(true);

    // 5) Automatic history event also captured the department transition.
    const historyEvent = repo
      .snapshot()
      .assetHistoryEvents.find((e) => e.assetId === asset.id);
    expect(historyEvent?.previous?.department).toBe("ICT");
    expect(historyEvent?.next?.department).toBe("Administration");

    // 6) Both departments' activity feeds pick the same transfer up — no
    //    second write, just re-deriving from the same movements collection.
    const sourceFeed = departmentActivityFeed(repo.snapshot().movements, repo.snapshot().assetHistoryEvents, "ICT");
    const destFeed = departmentActivityFeed(repo.snapshot().movements, repo.snapshot().assetHistoryEvents, "Administration");
    expect(sourceFeed.some((item) => item.kind === "movement" && item.movement.id === movement.id)).toBe(true);
    expect(destFeed.some((item) => item.kind === "movement" && item.movement.id === movement.id)).toBe(true);
  });

  it("returning an asset clears it from the department panel it was returned from", async () => {
    const asset = repo.snapshot().assets.find((a) => a.department === "ICT" && a.status !== "Archived")!;
    const dest = otherLocation(asset.currentLocationId);
    const before = assetsForDepartment(repo.snapshot().assets, "ICT").length;

    const res = await repo.execute({
      action: "asset.return",
      entityId: asset.id,
      values: {
        destinationLocationId: dest.id,
        destinationDepartment: "Central Storage",
        returnFrom: "ICT",
        reason: "End of assignment",
      },
    });
    expect(res.ok).toBe(true);

    const sourceAfter = assetsForDepartment(repo.snapshot().assets, "ICT");
    expect(sourceAfter.some((a) => a.id === asset.id)).toBe(false);
    expect(sourceAfter).toHaveLength(before - 1);

    const movement = repo.snapshot().movements[0];
    expect(movement.transactionType).toBe("RETURN");
    expect(movement.sourceDepartment).toBe("ICT");
    expect(movement.destinationDepartment).toBe("Central Storage");
  });

  it("a transfer that omits destinationDepartment leaves the department unchanged (backward compatible)", async () => {
    const asset = repo.snapshot().assets.find((a) => a.department === "ICT" && a.status !== "Archived")!;
    const dest = otherLocation(asset.currentLocationId);

    const res = await repo.execute({
      action: "asset.move",
      entityId: asset.id,
      values: { destinationLocationId: dest.id, reason: "Relocate within department" },
    });
    expect(res.ok).toBe(true);
    expect(repo.snapshot().assets.find((a) => a.id === asset.id)!.department).toBe("ICT");
  });
});
