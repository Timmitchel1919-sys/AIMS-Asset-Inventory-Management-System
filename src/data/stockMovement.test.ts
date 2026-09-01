import { beforeEach, describe, expect, it } from "vitest";
import { MockInventoryRepository } from "./mockRepository";

describe("asset transfer / return — identity preserved, immutable transaction", () => {
  let repo: MockInventoryRepository;
  beforeEach(() => (repo = new MockInventoryRepository()));

  const locations = () =>
    repo.snapshot().references.filter((r) => r.kind === "location");
  /** a location that is not where `currentId` already is */
  const otherLocation = (currentId?: string) =>
    locations().find((l) => l.id !== currentId) ?? locations()[0];

  it("Test 1 — transfer keeps the asset identity and records one immutable TRF movement + history", async () => {
    const asset = repo.snapshot().assets[0];
    const before = {
      id: asset.id,
      code: asset.code,
      serial: asset.serialNumber,
      name: asset.name,
      condition: asset.condition,
      location: asset.location,
      department: asset.department,
    };
    const dest = otherLocation(asset.currentLocationId);
    const moves = repo.snapshot().movements.length;
    const events = repo.snapshot().assetHistoryEvents.length;

    const res = await repo.execute({
      action: "asset.move",
      entityId: asset.id,
      actor: "ICT Administrator",
      values: {
        destinationLocationId: dest.id,
        destinationBin: "Rack A / Shelf 03",
        reason: "Physical relocation",
      },
    });
    expect(res.ok).toBe(true);

    const after = repo.snapshot().assets.find((a) => a.id === before.id)!;
    // identity untouched
    expect(after.id).toBe(before.id);
    expect(after.code).toBe(before.code);
    expect(after.serialNumber).toBe(before.serial);
    expect(after.name).toBe(before.name);
    // current state updated
    expect(after.currentLocationId).toBe(dest.id);
    expect(after.currentBin).toBe("Rack A / Shelf 03");
    expect(after.currentLocationPath).toContain(dest.name);
    // exactly one new movement, immutable, canonical
    expect(repo.snapshot().movements).toHaveLength(moves + 1);
    const mv = repo.snapshot().movements[0];
    expect(mv.transactionType).toBe("TRANSFER");
    expect(mv.transactionId).toMatch(/^TRF-\d{4}-\d{6}$/);
    expect(mv.immutable).toBe(true);
    expect(mv.assetId).toBe(before.id);
    expect(mv.invCode).toBe(before.code);
    expect(mv.destinationLocationId).toBe(dest.id);
    expect(mv.conditionBefore).toBe(before.condition);
    // a history event was appended
    expect(repo.snapshot().assetHistoryEvents.length).toBeGreaterThan(events);
  });

  it("Test 2 — moving into a location that already holds stock leaves that stock untouched", async () => {
    const [a, b] = repo.snapshot().assets;
    const dest = otherLocation(a.currentLocationId || b.currentLocationId);
    // park B at the destination first
    await repo.execute({
      action: "asset.move",
      entityId: b.id,
      values: { destinationLocationId: dest.id, reason: "seed" },
    });
    const bAfterSeed = { ...repo.snapshot().assets.find((x) => x.id === b.id)! };
    const assetCount = repo.snapshot().assets.length;

    // now move A into the same destination
    const res = await repo.execute({
      action: "asset.move",
      entityId: a.id,
      values: { destinationLocationId: dest.id, reason: "relocation" },
    });
    expect(res.ok).toBe(true);

    // B is byte-for-byte unchanged; no asset created or removed
    expect(repo.snapshot().assets).toHaveLength(assetCount);
    expect(repo.snapshot().assets.find((x) => x.id === b.id)).toEqual(bAfterSeed);
    expect(repo.snapshot().assets.find((x) => x.id === a.id)!.currentLocationId).toBe(
      dest.id,
    );
  });

  it("Test 3 — return clears the assignee, frees the asset and records a RET movement", async () => {
    const asset =
      repo.snapshot().assets.find((x) => x.assignedTo) ??
      repo.snapshot().assets[0];
    // ensure it looks assigned
    asset.assignedTo = "Someone";
    asset.status = "Assigned";
    const dest = otherLocation(asset.currentLocationId);

    const res = await repo.execute({
      action: "asset.return",
      entityId: asset.id,
      values: {
        destinationLocationId: dest.id,
        returnFrom: "Group 6A",
        conditionAfter: "Fair",
        accessories: "charger, mouse",
        reason: "End of assignment",
      },
    });
    expect(res.ok).toBe(true);

    const after = repo.snapshot().assets.find((x) => x.id === asset.id)!;
    expect(after.assignedTo).toBeUndefined();
    expect(after.status).toBe("Available");
    expect(after.condition).toBe("Fair");
    expect(after.currentLocationId).toBe(dest.id);
    const mv = repo.snapshot().movements[0];
    expect(mv.transactionType).toBe("RETURN");
    expect(mv.transactionId).toMatch(/^RET-\d{4}-\d{6}$/);
    expect(mv.notes).toContain("charger");
  });

  it("rejects a no-op move (same location + bin)", async () => {
    const asset = repo.snapshot().assets[0];
    const dest = otherLocation(asset.currentLocationId);
    await repo.execute({
      action: "asset.move",
      entityId: asset.id,
      values: { destinationLocationId: dest.id, reason: "first" },
    });
    const res = await repo.execute({
      action: "asset.move",
      entityId: asset.id,
      values: { destinationLocationId: dest.id, reason: "again" },
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/same/i);
  });

});
