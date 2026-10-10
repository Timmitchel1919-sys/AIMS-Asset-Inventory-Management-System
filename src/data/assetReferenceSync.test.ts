import { beforeEach, describe, expect, it } from "vitest";
import { MockInventoryRepository } from "./mockRepository";

/**
 * Canonical id references must follow the asset text after every user action
 * (create, edit, assign, return), never leaving a stale id behind, and must
 * never be wiped just because a lookup list is empty.
 */
describe("asset canonical reference sync", () => {
  let repo: MockInventoryRepository;
  beforeEach(() => (repo = new MockInventoryRepository()));

  const pick = () => {
    const snap = repo.snapshot();
    // Names must be unique so the match is unambiguous.
    const unique = <T extends { name: string }>(items: T[]) =>
      items.find((item) => items.filter((x) => x.name.trim().toLowerCase() === item.name.trim().toLowerCase()).length === 1);
    const category = unique(snap.references.filter((r) => r.kind === "category" && r.status !== "Archived"));
    const department = unique(snap.references.filter((r) => r.kind === "department" && r.status !== "Archived"));
    const group = snap.codeGroups.find((g) => !g.archived && snap.codeGroups.filter((x) => x.prefix === g.prefix).length === 1);
    const user = unique(snap.users);
    expect(category, "seed has a unique category").toBeTruthy();
    expect(department, "seed has a unique department").toBeTruthy();
    expect(group, "seed has a code group").toBeTruthy();
    expect(user, "seed has a unique user").toBeTruthy();
    return { category: category!, department: department!, group: group!, user: user! };
  };
  const find = (id?: string) => repo.snapshot().assets.find((a) => a.id === id)!;

  it("derives all canonical ids when an asset is created", async () => {
    const { category, department, group, user } = pick();
    const created = await repo.execute({
      action: "asset.create",
      values: {
        name: "Synced laptop",
        serialNumber: "SYNC-1",
        codePrefix: group.prefix,
        category: category.name,
        department: department.name,
        assignedTo: user.name,
        assetTypeId: "serialized",
      },
    });
    expect(created.ok).toBe(true);
    const asset = find(created.entityId);
    expect(asset).toMatchObject({
      categoryId: category.id,
      departmentId: department.id,
      codeGroupId: group.id,
      assignedUserId: user.id,
      assetTypeId: "serialized",
    });
  });

  it("replaces a stale id when the text is edited, and clears it when the text matches nothing", async () => {
    const { category, department, group, user } = pick();
    const created = await repo.execute({
      action: "asset.create",
      values: { name: "Edit me", serialNumber: "SYNC-2", codePrefix: group.prefix, category: category.name, department: department.name, assignedTo: user.name },
    });
    await repo.execute({ action: "asset.edit", entityId: created.entityId, values: { assignedTo: "Somebody Not In The Directory" } });
    expect(find(created.entityId).assignedUserId).toBeNull();
    await repo.execute({ action: "asset.edit", entityId: created.entityId, values: { assignedTo: user.name } });
    expect(find(created.entityId).assignedUserId).toBe(user.id);
    await repo.execute({ action: "asset.edit", entityId: created.entityId, values: { department: "No Such Department" } });
    expect(find(created.entityId).departmentId).toBeNull();
    // The original text fields stay exactly as the user typed them.
    expect(find(created.entityId).department).toBe("No Such Department");
  });

  it("leaves identifiers and the explicitly chosen tracking type alone", async () => {
    const { group } = pick();
    const created = await repo.execute({
      action: "asset.create",
      values: { name: "Stable", serialNumber: "SYNC-3", codePrefix: group.prefix, assetTypeId: "bulk" },
    });
    const before = find(created.entityId);
    await repo.execute({ action: "asset.edit", entityId: created.entityId, values: { notes: "changed" } });
    const after = find(created.entityId);
    expect(after.code).toBe(before.code);
    expect(after.codeGroupId).toBe(group.id);
    expect(after.assetTypeId).toBe("bulk");
  });

  it("never clears an existing id because a lookup list is empty", async () => {
    const { user, group } = pick();
    const created = await repo.execute({
      action: "asset.create",
      values: { name: "Guarded", serialNumber: "SYNC-4", codePrefix: group.prefix, assignedTo: user.name },
    });
    expect(find(created.entityId).assignedUserId).toBe(user.id);
    // Simulate the directory not being loaded / readable.
    (repo as unknown as { state: { users: unknown[]; codeGroups: unknown[] } }).state.users = [];
    (repo as unknown as { state: { users: unknown[]; codeGroups: unknown[] } }).state.codeGroups = [];
    await repo.execute({ action: "asset.edit", entityId: created.entityId, values: { notes: "edited while directory unavailable" } });
    const asset = find(created.entityId);
    expect(asset.assignedUserId).toBe(user.id);
    expect(asset.codeGroupId).toBe(group.id);
  });

  it("follows an assignment and clears the assigned user again on return", async () => {
    const { user, group } = pick();
    const created = await repo.execute({
      action: "asset.create",
      values: { name: "Loaner", serialNumber: "SYNC-5", codePrefix: group.prefix, status: "Available" },
    });
    expect(find(created.entityId).assignedUserId ?? null).toBeNull();
    const assigned = await repo.execute({
      action: "assignment.create",
      entityId: created.entityId,
      values: { assignee: user.name, department: "ICT" },
    });
    expect(assigned.ok, assigned.message).toBe(true);
    expect(find(created.entityId).assignedUserId).toBe(user.id);
    const assignment = repo.snapshot().assignments.find((x) => x.assetId === created.entityId)!;
    const returned = await repo.execute({ action: "assignment.return", entityId: assignment.id, values: {} });
    expect(returned.ok, returned.message).toBe(true);
    expect(find(created.entityId).assignedUserId).toBeNull();
  });
});
