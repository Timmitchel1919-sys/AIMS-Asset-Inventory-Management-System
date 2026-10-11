// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { MockInventoryRepository } from "./mockRepository";

describe("asset movement targets", () => {
  let repo: MockInventoryRepository;
  beforeEach(() => {
    localStorage.setItem("kcs-language", "en");
    repo = new MockInventoryRepository();
  });
  const pick = () => {
    const snap = repo.snapshot();
    const asset = snap.assets.find((a) => a.status === "Available" && a.currentLocationId)!;
    const target = snap.references.find((r) => r.kind === "location" && r.status === "Active" && r.id !== asset.currentLocationId && r.type !== "Main location")!;
    return { asset, target };
  };

  it("refuses an unknown destination and leaves the asset where it is", async () => {
    const { asset } = pick();
    const before = asset.currentLocationId;
    const result = await repo.execute({ action: "asset.move", entityId: asset.id, values: { destinationLocationId: "nope", reason: "x" } });
    expect(result.ok).toBe(false);
    expect(repo.snapshot().assets.find((a) => a.id === asset.id)?.currentLocationId).toBe(before);
  });

  it("refuses an inactive destination: new placements need an active location", async () => {
    const { asset, target } = pick();
    await repo.execute({ action: "reference.edit", entityId: target.id, values: { status: "Inactive" } });
    const result = await repo.execute({ action: "asset.move", entityId: asset.id, values: { destinationLocationId: target.id, reason: "x" } });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not active|inactive|active/i);
    expect(repo.snapshot().assets.find((a) => a.id === asset.id)?.currentLocationId).not.toBe(target.id);
  });

  it("an asset already in a location that became inactive stays there (no silent move)", async () => {
    const { asset } = pick();
    const current = asset.currentLocationId!;
    await repo.execute({ action: "reference.edit", entityId: current, values: { status: "Inactive" } });
    expect(repo.snapshot().assets.find((a) => a.id === asset.id)?.currentLocationId).toBe(current);
  });
});
