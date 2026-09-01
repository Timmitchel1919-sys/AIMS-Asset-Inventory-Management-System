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

  it("Test 4 — bulk move relocates every selected asset, one immutable TRF each, shared batch id, destination untouched", async () => {
    const all = repo.snapshot().assets.filter((a) => a.status !== "Archived");
    const [a, b, c] = all;
    const dest = otherLocation(a.currentLocationId);

    // park C at the destination first (existing stock there)
    await repo.execute({
      action: "asset.move",
      entityId: c.id,
      values: { destinationLocationId: dest.id, reason: "seed" },
    });
    const cAfterSeed = { ...repo.snapshot().assets.find((x) => x.id === c.id)! };
    const moves0 = repo.snapshot().movements.length;
    const assetCount = repo.snapshot().assets.length;

    const res = await repo.execute({
      action: "bulk.move",
      actor: "ICT Administrator",
      values: {
        assetIds: [a.id, b.id],
        inventoryIds: [],
        destinationLocationId: dest.id,
        reason: "Room reorganisation",
      },
    });
    expect(res.ok).toBe(true);
    expect(res.entityId).toMatch(/^BLK-\d{4}-\d{6}$/);

    // both moved, none created/removed
    expect(repo.snapshot().assets).toHaveLength(assetCount);
    for (const id of [a.id, b.id])
      expect(
        repo.snapshot().assets.find((x) => x.id === id)!.currentLocationId,
      ).toBe(dest.id);

    // one immutable TRF per moved asset, all sharing the batch id
    const legs = repo
      .snapshot()
      .movements.slice(0, repo.snapshot().movements.length - moves0);
    expect(legs).toHaveLength(2);
    expect(new Set(legs.map((m) => m.bulkBatchId)).size).toBe(1);
    expect(legs.every((m) => m.transactionType === "TRANSFER")).toBe(true);
    expect(legs.every((m) => m.immutable === true)).toBe(true);
    expect(legs.every((m) => /^TRF-\d{4}-\d{6}$/.test(m.transactionId!))).toBe(
      true,
    );

    // the asset already at the destination was not touched
    expect(repo.snapshot().assets.find((x) => x.id === c.id)).toEqual(cAfterSeed);
  });

  it("bulk move skips items already at the destination and errors if nothing is left", async () => {
    const asset = repo.snapshot().assets[0];
    const dest = otherLocation(asset.currentLocationId);
    await repo.execute({
      action: "asset.move",
      entityId: asset.id,
      values: { destinationLocationId: dest.id, reason: "first" },
    });
    const res = await repo.execute({
      action: "bulk.move",
      values: {
        assetIds: [asset.id],
        inventoryIds: [],
        destinationLocationId: dest.id,
        reason: "again",
      },
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/nothing to move/i);
  });

  it("Test 7 — a bulk move with a bad id moves the valid items and leaves nothing half-done", async () => {
    const asset = repo.snapshot().assets[0];
    const dest = otherLocation(asset.currentLocationId);
    const count = repo.snapshot().assets.length;

    const res = await repo.execute({
      action: "bulk.move",
      values: {
        assetIds: [asset.id, "does-not-exist"],
        inventoryIds: ["also-bogus"],
        destinationLocationId: dest.id,
        reason: "partial batch",
      },
    });
    expect(res.ok).toBe(true); // the one real item moved
    expect(repo.snapshot().assets).toHaveLength(count); // nothing created/removed
    expect(
      repo.snapshot().assets.find((x) => x.id === asset.id)!.currentLocationId,
    ).toBe(dest.id);
  });

  it("Test 7b — a bulk move with only bad ids changes nothing and reports it", async () => {
    const snapBefore = JSON.stringify(repo.snapshot().assets);
    const dest = otherLocation();
    const res = await repo.execute({
      action: "bulk.move",
      values: {
        assetIds: ["nope-1", "nope-2"],
        inventoryIds: [],
        destinationLocationId: dest.id,
        reason: "x",
      },
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/nothing to move/i);
    expect(JSON.stringify(repo.snapshot().assets)).toBe(snapBefore);
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
