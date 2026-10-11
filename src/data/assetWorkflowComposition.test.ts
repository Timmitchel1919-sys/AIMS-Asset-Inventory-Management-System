// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { MockInventoryRepository } from "./mockRepository";
import { withAssetWorkflowComposition } from "./assetWorkflowComposition";

/**
 * ICT-Middelen <-> Assignment Management are ONE relationship: assigning or
 * re-assigning from the asset must show up as a real assignment, and a refused
 * change must not leave anything half applied.
 */
describe("asset <-> assignment composition", () => {
  let repo: MockInventoryRepository;
  beforeEach(() => {
    localStorage.setItem("kcs-language", "en");
    repo = withAssetWorkflowComposition(new MockInventoryRepository());
  });

  const snap = () => repo.snapshot();
  const asset = (id?: string) => snap().assets.find((a) => a.id === id)!;
  const active = (assetId?: string) => snap().assignments.filter((a) => a.assetId === assetId && a.active);
  const history = (assetId?: string) => snap().assignments.filter((a) => a.assetId === assetId);
  const users = () => snap().users.filter((u) => snap().users.filter((x) => x.name === u.name).length === 1);
  const make = async (extra: Record<string, unknown> = {}, serial = `S-${Math.random()}`) => {
    const created = await repo.execute({ action: "asset.create", values: { name: "Laptop", serialNumber: serial, ...extra } });
    expect(created.ok, created.message).toBe(true);
    return created.entityId!;
  };

  it("wrapping twice does not compose twice", async () => {
    withAssetWorkflowComposition(repo);
    const [ann] = users();
    const id = await make({ assignedTo: ann.name });
    expect(active(id)).toHaveLength(1);
  });

  it("creating an asset with an assignee creates the assignment and marks it Assigned", async () => {
    const [ann] = users();
    const id = await make({ assignedTo: ann.name });
    expect(asset(id)).toMatchObject({ status: "Assigned", assignedTo: ann.name, assignedUserId: ann.id });
    expect(active(id)).toHaveLength(1);
    expect(active(id)[0]).toMatchObject({ assignee: ann.name, assetCode: asset(id).code, status: "Active" });
  });

  it("refuses a contradictory create (Available with a user) and creates nothing", async () => {
    const [ann] = users();
    const before = snap().assets.length;
    const result = await repo.execute({ action: "asset.create", values: { name: "X", serialNumber: "C-1", assignedTo: ann.name, status: "Available" } });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/cannot be assigned to a user/);
    expect(snap().assets).toHaveLength(before);
    const noUser = await repo.execute({ action: "asset.create", values: { name: "X", serialNumber: "C-2", status: "Assigned" } });
    expect(noUser.ok).toBe(false);
    expect(noUser.message).toMatch(/requires an assigned user/);
  });

  it("assigning from ICT-Middelen shows up in Assignment Management", async () => {
    const [ann] = users();
    const id = await make();
    const result = await repo.execute({ action: "asset.edit", entityId: id, values: { assignedTo: ann.name, notes: "n" } });
    expect(result.ok, result.message).toBe(true);
    expect(asset(id)).toMatchObject({ status: "Assigned", assignedTo: ann.name, notes: "n" });
    expect(active(id)).toHaveLength(1);
    expect(snap().activity.some((e) => e.action === "assignment.create" && e.result === "Success")).toBe(true);
  });

  it("changing the assignee ends the old assignment and starts exactly one new one", async () => {
    const [ann, bob] = users();
    const id = await make({ assignedTo: ann.name });
    const result = await repo.execute({ action: "asset.edit", entityId: id, values: { assignedTo: bob.name } });
    expect(result.ok, result.message).toBe(true);
    expect(active(id)).toHaveLength(1);
    expect(active(id)[0].assignee).toBe(bob.name);
    expect(history(id)).toHaveLength(2);
    expect(history(id).find((a) => !a.active)).toMatchObject({ assignee: ann.name, status: "Returned" });
    expect(asset(id)).toMatchObject({ assignedTo: bob.name, assignedUserId: bob.id, status: "Assigned" });
  });

  it("clearing the assignee returns the assignment and frees the asset", async () => {
    const [ann] = users();
    const id = await make({ assignedTo: ann.name });
    const result = await repo.execute({ action: "asset.edit", entityId: id, values: { assignedTo: "" } });
    expect(result.ok, result.message).toBe(true);
    expect(active(id)).toHaveLength(0);
    expect(asset(id).status).toBe("Available");
    expect(asset(id).assignedTo).toBeUndefined();
    expect(asset(id).assignedUserId ?? null).toBeNull();
    expect(history(id)[0].status).toBe("Returned");
  });

  it("the other direction: returning through Assignment Management updates the asset", async () => {
    const [ann] = users();
    const id = await make({ assignedTo: ann.name });
    const returned = await repo.execute({ action: "assignment.return", entityId: active(id)[0].id, values: {} });
    expect(returned.ok, returned.message).toBe(true);
    expect(asset(id).status).toBe("Available");
    expect(asset(id).assignedTo).toBeUndefined();
  });

  it("refuses an assignee change while the asset is under repair, leaving everything unchanged", async () => {
    const [ann] = users();
    const id = await make();
    await repo.execute({ action: "asset.edit", entityId: id, values: { status: "Under Repair" } });
    const before = JSON.stringify(asset(id));
    const result = await repo.execute({ action: "asset.edit", entityId: id, values: { assignedTo: ann.name } });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(asset(id))).toBe(before);
    expect(history(id)).toHaveLength(0);
  });

  it("refuses an assignee together with an Available status in one edit", async () => {
    const [ann] = users();
    const id = await make();
    const result = await repo.execute({ action: "asset.edit", entityId: id, values: { assignedTo: ann.name, status: "Available" } });
    expect(result.ok).toBe(false);
    expect(history(id)).toHaveLength(0);
    expect(asset(id).status).toBe("Available");
  });

  it("refuses a reassignment of a defective device up front instead of half applying it", async () => {
    const [ann, bob] = users();
    const id = await make({ assignedTo: ann.name });
    asset(id).condition = "Defective";
    const result = await repo.execute({ action: "asset.edit", entityId: id, values: { assignedTo: bob.name } });
    expect(result.ok).toBe(false);
    expect(active(id)[0].assignee).toBe(ann.name);
    expect(asset(id).status).toBe("Assigned");
  });

  it("validates plain status changes against the lifecycle", async () => {
    const id = await make();
    expect((await repo.execute({ action: "asset.edit", entityId: id, values: { status: "Under Maintenance" } })).ok).toBe(true);
    const jump = await repo.execute({ action: "asset.edit", entityId: id, values: { status: "Archived" } });
    expect(jump.ok).toBe(false);
    expect(jump.message).toMatch(/cannot be changed directly from "Under Maintenance" to "Archived"/);
    expect(asset(id).status).toBe("Under Maintenance");
    expect((await repo.execute({ action: "asset.edit", entityId: id, values: { status: "Available" } })).ok).toBe(true);
  });

  it("a terminal status is not left through a plain edit", async () => {
    const id = await make();
    await repo.execute({ action: "asset.edit", entityId: id, values: { status: "Archived" } });
    const result = await repo.execute({ action: "asset.edit", entityId: id, values: { status: "Available" } });
    expect(result.ok).toBe(false);
    expect(asset(id).status).toBe("Archived");
  });

  it("an edit that changes neither status nor assignee is never blocked (legacy data stays editable)", async () => {
    const id = await make();
    asset(id).status = "Assigned"; // legacy contradiction: Assigned without a user
    const result = await repo.execute({ action: "asset.edit", entityId: id, values: { notes: "fix typo", status: "Assigned" } });
    expect(result.ok, result.message).toBe(true);
  });

  it("messages follow the interface language", async () => {
    localStorage.setItem("kcs-language", "nl");
    const result = await repo.execute({ action: "asset.create", values: { name: "X", serialNumber: "NL-1", status: "Assigned" } });
    expect(result.message).toMatch(/is een toegewezen gebruiker vereist/);
  });

  it("an Inv.code is never reused, even after the asset's assignment history", async () => {
    const [ann] = users();
    const id = await make({ assignedTo: ann.name });
    const code = asset(id).code;
    await repo.execute({ action: "asset.edit", entityId: id, values: { assignedTo: "" } });
    const second = await make();
    expect(asset(second).code).not.toBe(code);
  });
});
