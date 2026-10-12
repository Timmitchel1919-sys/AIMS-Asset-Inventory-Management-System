// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { MockInventoryRepository } from "./mockRepository";

/** Mixed-case serials must be accepted, and assets without a serial must not break create/edit. */
describe("asset serial numbers", () => {
  let repo: MockInventoryRepository;
  beforeEach(() => {
    localStorage.setItem("kcs-language", "en");
    repo = new MockInventoryRepository();
  });

  it("creates and edits assets while a legacy asset has no serial number", async () => {
    const legacy = repo.snapshot().assets[0];
    delete (legacy as { serialNumber?: string }).serialNumber;
    const created = await repo.execute({ action: "asset.create", values: { name: "Laptop", serialNumber: "AbC-123xYz" } });
    expect(created.ok, created.message).toBe(true);
    const edited = await repo.execute({ action: "asset.edit", entityId: created.entityId, values: { name: "Laptop 2" } });
    expect(edited.ok, edited.message).toBe(true);
    expect(repo.snapshot().assets.find((a) => a.id === created.entityId)?.serialNumber).toBe("AbC-123xYz");
  });

  it("still rejects a duplicate serial regardless of letter case", async () => {
    await repo.execute({ action: "asset.create", values: { name: "A", serialNumber: "Abc-1" } });
    const dup = await repo.execute({ action: "asset.create", values: { name: "B", serialNumber: "aBC-1" } });
    expect(dup.ok).toBe(false);
  });
});
