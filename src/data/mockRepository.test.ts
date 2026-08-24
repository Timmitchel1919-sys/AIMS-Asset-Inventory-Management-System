import { beforeEach, describe, expect, it } from "vitest";
import { MockInventoryRepository } from "./mockRepository";
describe("mock workflow repository", () => {
  let repo: MockInventoryRepository;
  beforeEach(() => (repo = new MockInventoryRepository()));
  it("queries assets with repository-side filtering and cursor pagination", async () => {
    const first = await repo.queryAssets({
      filters: [{ field: "department", operator: "eq", value: "ICT" }],
      sort: [{ field: "codeNumber", direction: "asc" }],
      pageSize: 2,
    });
    expect(first.items).toHaveLength(2);
    expect(first.totalCount).toBeGreaterThan(2);
    const second = await repo.queryAssets({
      filters: [{ field: "department", operator: "eq", value: "ICT" }],
      sort: [{ field: "codeNumber", direction: "asc" }],
      pageSize: 2,
      cursor: first.nextCursor,
    });
    expect(second.items.map((asset) => asset.id)).not.toEqual(
      first.items.map((asset) => asset.id),
    );
  });
  it("creates, edits, archives and restores an asset with activity", async () => {
    const created = await repo.execute({
      action: "asset.create",
      values: { name: "Test laptop", serialNumber: "UNIQUE-1" },
    });
    expect(created.ok).toBe(true);
    await repo.execute({
      action: "asset.edit",
      entityId: created.entityId,
      values: { location: "Server Room" },
    });
    await repo.execute({ action: "asset.archive", entityId: created.entityId });
    expect(
      repo.snapshot().assets.find((a) => a.id === created.entityId)?.status,
    ).toBe("Archived");
    expect(
      (await repo.queryAssets({ pageSize: 100 })).items.some(
        (asset) => asset.id === created.entityId,
      ),
    ).toBe(false);
    await repo.execute({ action: "asset.restore", entityId: created.entityId });
    expect(repo.snapshot().activity).toHaveLength(4);
  });
  it("moves deleted code groups to the recycle bin and restores them", async () => {
    const created = await repo.execute({
      action: "codeGroup.create",
      values: {
        name: "Temporary group",
        prefix: "TMP",
        minimumNumber: 1,
        maximumNumber: 100,
        nextAvailableNumber: 1,
      },
    });
    expect(
      (
        await repo.execute({
          action: "codeGroup.delete",
          entityId: created.entityId,
          values: { reason: "Test removal" },
        })
      ).ok,
    ).toBe(true);
    expect(
      repo.snapshot().codeGroups.find((group) => group.id === created.entityId),
    ).toMatchObject({ archived: true, isActive: false });
    await repo.execute({
      action: "codeGroup.restore",
      entityId: created.entityId,
    });
    expect(
      repo.snapshot().codeGroups.find((group) => group.id === created.entityId),
    ).toMatchObject({ archived: false, isActive: true });
  });
  it("allocates the next official code and prevents duplicate serial numbers", async () => {
    const expected =
      Math.max(
        ...repo
          .snapshot()
          .assets.filter((asset) => asset.codePrefix === "KCSMD")
          .map((asset) => asset.codeNumber),
      ) + 1;
    const created = await repo.execute({
      action: "asset.create",
      actor: "Admin",
      values: {
        codePrefix: "KCSMD",
        name: "Managed code",
        serialNumber: "NEXT-001",
      },
    });
    const asset = repo
      .snapshot()
      .assets.find((value) => value.id === created.entityId)!;
    expect(asset.code).toBe(`KCSMD-${expected}`);
    expect(asset.createdBy).toBe("Admin");
    expect(
      (
        await repo.execute({
          action: "asset.create",
          values: { serialNumber: "next-001" },
        })
      ).ok,
    ).toBe(false);
  });
  it("preserves corrected official codes and records actor metadata", async () => {
    const asset = repo.snapshot().assets[1];
    const oldCode = asset.code;
    const result = await repo.execute({
      action: "asset.edit",
      entityId: asset.id,
      actor: "Administrator",
      values: {
        codeCorrection: "KCSL-300",
        correctionReason: "Registry correction",
      },
    });
    expect(result.ok).toBe(true);
    expect(asset.previousCodes).toContain(oldCode);
    expect(asset.code).toBe("KCSL-300");
    expect(asset.lastModifiedBy).toBe("Administrator");
  });
  it("moves an asset and appends movement history", async () => {
    const asset = repo.snapshot().assets[1],
      count = repo.snapshot().movements.length;
    const result = await repo.execute({
      action: "asset.move",
      entityId: asset.id,
      values: {
        destinationLocation: "Server Room",
        destinationDepartment: "ICT",
        reason: "Deployment",
      },
    });
    expect(result.ok).toBe(true);
    expect(asset.location).toBe("Server Room");
    expect(repo.snapshot().movements).toHaveLength(count + 1);
  });
  it("receives, issues, transfers and corrects stock without going negative", async () => {
    const item = repo.snapshot().inventory[0];
    await repo.execute({
      action: "stock.receive",
      entityId: item.id,
      values: { quantity: 5 },
    });
    await repo.execute({
      action: "stock.issue",
      entityId: item.id,
      values: { quantity: 2 },
    });
    await repo.execute({
      action: "stock.transfer",
      entityId: item.id,
      values: { destination: "ICT Store" },
    });
    expect(repo.snapshot().inventory[0].onHand).toBe(185);
    expect(
      (
        await repo.execute({
          action: "stock.issue",
          entityId: item.id,
          values: { quantity: 999 },
        })
      ).ok,
    ).toBe(false);
  });
  it("enforces borrow approval before issue and updates the asset", async () => {
    const asset = repo.snapshot().assets.find((a) => a.status === "Available")!;
    const request = await repo.execute({
      action: "borrow.create",
      entityId: asset.id,
    });
    expect(
      (
        await repo.execute({
          action: "borrow.issue",
          entityId: request.entityId,
        })
      ).ok,
    ).toBe(false);
    await repo.execute({
      action: "borrow.approve",
      entityId: request.entityId,
    });
    await repo.execute({ action: "borrow.issue", entityId: request.entityId });
    expect(repo.snapshot().assets.find((a) => a.id === asset.id)?.status).toBe(
      "Borrowed",
    );
    await repo.execute({ action: "borrow.return", entityId: request.entityId });
    expect(repo.snapshot().assets.find((a) => a.id === asset.id)?.status).toBe(
      "Available",
    );
  });
  it("requires inspection, approval and method before disposal completion", async () => {
    const asset = repo.snapshot().assets.find((a) => a.status === "Available")!;
    const request = await repo.execute({
      action: "disposal.create",
      entityId: asset.id,
    });
    expect(
      (
        await repo.execute({
          action: "disposal.complete",
          entityId: request.entityId,
        })
      ).ok,
    ).toBe(false);
    await repo.execute({
      action: "disposal.inspect",
      entityId: request.entityId,
    });
    await repo.execute({
      action: "disposal.approve",
      entityId: request.entityId,
    });
    expect(
      (
        await repo.execute({
          action: "disposal.complete",
          entityId: request.entityId,
        })
      ).ok,
    ).toBe(false);
    await repo.execute({
      action: "disposal.method",
      entityId: request.entityId,
      values: { method: "Recycling" },
    });
    await repo.execute({
      action: "disposal.complete",
      entityId: request.entityId,
    });
    expect(repo.snapshot().assets.find((a) => a.id === asset.id)?.status).toBe(
      "Disposed",
    );
  });
  it("prevents reservations above stock on hand", async () => {
    const item = repo.snapshot().inventory[0];
    expect(
      (
        await repo.execute({
          action: "stock.reserve",
          entityId: item.id,
          values: { quantity: item.onHand + 1 },
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await repo.execute({
          action: "stock.reserve",
          entityId: item.id,
          values: { quantity: 2 },
        })
      ).ok,
    ).toBe(true);
    expect(repo.snapshot().inventory[0].reserved).toBe(26);
  });
  it("archives linked references to the recycle bin but blocks permanent deletion", async () => {
    const reference = repo
      .snapshot()
      .references.find((value) => value.relatedCount > 0)!;
    const archived = await repo.execute({
      action: "reference.archive",
      entityId: reference.id,
    });
    expect(archived.ok).toBe(true);
    expect(
      repo.snapshot().references.find((value) => value.id === reference.id)
        ?.status,
    ).toBe("Archived");
    expect(
      (
        await repo.execute({
          action: "reference.delete",
          entityId: reference.id,
        })
      ).ok,
    ).toBe(false);
  });
  it("creates and deactivates a user while retaining the record", async () => {
    const created = await repo.execute({
      action: "user.create",
      values: { name: "Test User", email: "test@kcs.edu" },
    });
    await repo.execute({
      action: "user.deactivate",
      entityId: created.entityId,
    });
    expect(
      repo.snapshot().users.find((value) => value.id === created.entityId)
        ?.status,
    ).toBe("Inactive");
  });
  it("keeps notification unread quantities in sync with read state", async () => {
    const unread = () =>
      repo
        .snapshot()
        .notifications.filter((item) => !item.read && !item.dismissed).length;
    expect(unread()).toBeGreaterThan(0);
    await repo.execute({ action: "notification.readAll" });
    expect(unread()).toBe(0);
    expect(repo.snapshot().notifications.every((item) => item.read)).toBe(true);
    await repo.execute({
      action: "notification.unread",
      entityId: repo.snapshot().notifications[0].id,
    });
    expect(unread()).toBe(1);
  });
});
