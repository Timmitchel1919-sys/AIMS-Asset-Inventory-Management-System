// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { MockInventoryRepository } from "./mockRepository";
import { withAssetWorkflowComposition } from "./assetWorkflowComposition";
import { assetInDepartment } from "../domain/assetLookups";

/**
 * The operational asset lifecycle end to end (layers 6-10): departments,
 * assignments, loans, repairs, maintenance, disposal, history and the rules
 * that keep history immutable.
 */
describe("operational lifecycle", () => {
  let repo: MockInventoryRepository;
  const snap = () => repo.snapshot();
  const asset = (id?: string) => snap().assets.find((a) => a.id === id)!;
  beforeEach(() => {
    localStorage.setItem("kcs-language", "en");
    repo = withAssetWorkflowComposition(new MockInventoryRepository());
  });
  const mainLocation = (status: "Active" | "Inactive" = "Active") =>
    snap().references.find((r) => r.kind === "location" && r.type === "Main location" && r.status === status);
  const newAsset = async (extra: Record<string, unknown> = {}) => {
    const created = await repo.execute({ action: "asset.create", values: { name: "Laptop", serialNumber: `L-${Math.random()}`, ...extra } });
    expect(created.ok, created.message).toBe(true);
    return created.entityId!;
  };
  const users = () => snap().users.filter((u) => snap().users.filter((x) => x.name === u.name).length === 1);

  describe("Layer 6: departments reference Master Data (Test 1)", () => {
    const create = (values: Record<string, unknown>) =>
      repo.execute({ action: "reference.create", values: { kind: "department", type: "Department", status: "Active", ...values } });

    it("requires an existing, active Hoofdlocatie from Master Data", async () => {
      const main = mainLocation()!;
      const ok = await create({ name: "Groep 9Z", mainLocationId: main.id });
      expect(ok.ok, ok.message).toBe(true);
      expect(snap().references.find((r) => r.id === ok.entityId)).toMatchObject({ kind: "department", mainLocationId: main.id });
      expect((await create({ name: "Zonder locatie" })).ok).toBe(false);
      expect((await create({ name: "Onbekend", mainLocationId: "does-not-exist" })).ok).toBe(false);
      // A sub-location or department is not a Hoofdlocatie.
      expect((await create({ name: "Verkeerd type", mainLocationId: ok.entityId })).ok).toBe(false);
    });

    it("blocks an inactive Hoofdlocatie for a NEW department but keeps existing ones valid", async () => {
      const main = mainLocation()!;
      const dept = await create({ name: "Groep 7Q", mainLocationId: main.id });
      await repo.execute({ action: "reference.edit", entityId: main.id, values: { status: "Inactive" } });
      const blocked = await create({ name: "Nieuwe afdeling", mainLocationId: main.id });
      expect(blocked.ok).toBe(false);
      expect(blocked.message).toMatch(/not active/);
      // The existing department keeps working, edits that don't change the location are fine.
      expect((await repo.execute({ action: "reference.edit", entityId: dept.entityId, values: { name: "Groep 7Q (nieuw)" } })).ok).toBe(true);
      expect(snap().references.find((r) => r.id === dept.entityId)?.mainLocationId).toBe(main.id);
    });

    it("blocks a duplicate name within the same Hoofdlocatie only", async () => {
      const [first, second] = snap().references.filter((r) => r.kind === "location" && r.type === "Main location" && r.status === "Active");
      await create({ name: "Groep 5A", mainLocationId: first.id });
      const dup = await create({ name: " groep  5a ", mainLocationId: first.id });
      expect(dup.ok).toBe(false);
      expect(dup.message).toMatch(/already exists/);
      if (second) expect((await create({ name: "Groep 5A", mainLocationId: second.id })).ok).toBe(true);
    });
  });

  describe("Layer 6/9: transfer keeps the department view consistent (Tests 2 and 11)", () => {
    it("moves an asset between departments: it leaves the old one, joins the new one, history keeps both", async () => {
      const id = await newAsset({ department: "Groep 1A" });
      const from = { id: "dep-from", name: "Groep 1A" };
      const to = { id: "dep-to", name: "Groep 2B" };
      expect(assetInDepartment(asset(id), from)).toBe(true);
      const dest = snap().references.find((r) => r.kind === "location" && r.status === "Active" && r.type !== "Main location" && r.id !== asset(id).currentLocationId)!;
      const moves = snap().movements.length;
      const moved = await repo.execute({ action: "asset.move", entityId: id, values: { destinationLocationId: dest.id, destinationDepartment: "Groep 2B", reason: "Reorganisation" } });
      expect(moved.ok, moved.message).toBe(true);
      expect(assetInDepartment(asset(id), from)).toBe(false);
      expect(assetInDepartment(asset(id), to)).toBe(true);
      expect(snap().movements).toHaveLength(moves + 1);
      expect(snap().movements[0]).toMatchObject({ assetId: id, destinationLocationId: dest.id, immutable: true, sourceDepartment: "Groep 1A" });
    });
  });

  describe("Layer 7: assignments (Tests 3, 4, 16)", () => {
    it("stores the canonical user id next to the display name", async () => {
      const [ann] = users();
      const id = await newAsset({ assignedTo: ann.name });
      const assignment = snap().assignments.find((a) => a.assetId === id)!;
      expect(assignment).toMatchObject({ assignee: ann.name, assigneeUserId: ann.id });
    });

    it("blocks a second simultaneous assignment of the same asset", async () => {
      const [ann, bob] = users();
      const id = await newAsset({ assignedTo: ann.name });
      const second = await repo.execute({ action: "assignment.create", entityId: id, values: { assignee: bob.name } });
      expect(second.ok).toBe(false);
      expect(snap().assignments.filter((a) => a.assetId === id && a.active)).toHaveLength(1);
    });

    it("refuses to assign an archived or disposed asset", async () => {
      const [ann] = users();
      const id = await newAsset();
      await repo.execute({ action: "asset.edit", entityId: id, values: { status: "Archived" } });
      expect((await repo.execute({ action: "assignment.create", entityId: id, values: { assignee: ann.name } })).ok).toBe(false);
      expect((await repo.execute({ action: "asset.edit", entityId: id, values: { assignedTo: ann.name } })).ok).toBe(false);
    });

    it("keeps the whole assignment history when the person changes", async () => {
      const [ann, bob] = users();
      const id = await newAsset({ assignedTo: ann.name });
      await repo.execute({ action: "asset.edit", entityId: id, values: { assignedTo: bob.name } });
      const history = snap().assignments.filter((a) => a.assetId === id);
      expect(history.map((a) => [a.assignee, a.active, a.assigneeUserId])).toEqual(
        expect.arrayContaining([[ann.name, false, ann.id], [bob.name, true, bob.id]]),
      );
    });
  });

  describe("Layer 7: loans (Tests 5 and 6)", () => {
    it("lending sets Borrowed, records the canonical borrower id, and returning frees the asset", async () => {
      const [ann] = users();
      const id = await newAsset();
      const request = await repo.execute({ action: "borrow.create", entityId: id, values: { borrower: ann.name } });
      expect(request.ok, request.message).toBe(true);
      expect(snap().borrows.find((b) => b.id === request.entityId)).toMatchObject({ borrower: ann.name, borrowerUserId: ann.id });
      await repo.execute({ action: "borrow.approve", entityId: request.entityId });
      await repo.execute({ action: "borrow.issue", entityId: request.entityId });
      expect(asset(id).status).toBe("Borrowed");
      const returned = await repo.execute({ action: "borrow.return", entityId: request.entityId });
      expect(returned.ok, returned.message).toBe(true);
      expect(asset(id).status).toBe("Available");
    });

    it("an asset on loan cannot be assigned or lent twice", async () => {
      const [ann] = users();
      const id = await newAsset();
      const request = await repo.execute({ action: "borrow.create", entityId: id, values: { borrower: ann.name } });
      await repo.execute({ action: "borrow.approve", entityId: request.entityId });
      await repo.execute({ action: "borrow.issue", entityId: request.entityId });
      expect((await repo.execute({ action: "assignment.create", entityId: id, values: { assignee: ann.name } })).ok).toBe(false);
      expect((await repo.execute({ action: "borrow.create", entityId: id, values: { borrower: ann.name } })).ok).toBe(false);
    });
  });

  describe("Layer 8: repair and maintenance (Tests 7-10)", () => {
    it("repair puts the asset In repair and completion restores it", async () => {
      const id = await newAsset();
      const repair = await repo.execute({ action: "repair.create", entityId: id, values: { issue: "Screen flicker", due: "2026-12-31" } });
      expect(repair.ok, repair.message).toBe(true);
      await repo.execute({ action: "repair.start", entityId: repair.entityId });
      expect(asset(id).status).toBe("Under Repair");
      const done = await repo.execute({ action: "repair.complete", entityId: repair.entityId, values: { outcome: "Passed", assetStatus: "Available", condition: "Good" } });
      expect(done.ok, done.message).toBe(true);
      expect(asset(id).status).toBe("Available");
      expect(snap().repairs.find((r) => r.id === repair.entityId)?.status).toBe("Completed");
    });

    it("an unrepairable asset is not deleted and can still be archived afterwards", async () => {
      const id = await newAsset();
      const repair = await repo.execute({ action: "repair.create", entityId: id, values: { issue: "Dead board", due: "2026-12-31" } });
      expect((await repo.execute({ action: "repair.diagnose", entityId: repair.entityId })).ok).toBe(true);
      const dead = await repo.execute({ action: "repair.unrepairable", entityId: repair.entityId, values: { diagnosis: "Mainboard failure", reason: "Not economical to repair" } });
      expect(dead.ok, dead.message).toBe(true);
      expect(snap().assets.some((a) => a.id === id)).toBe(true);
      expect(snap().repairs.find((r) => r.id === repair.entityId)?.status).toBe("Unrepairable");
      expect(["Damaged", "Under Repair"]).toContain(asset(id).status);
      // It can be retired through the normal, validated path and keeps its history.
      expect((await repo.execute({ action: "asset.edit", entityId: id, values: { status: "Damaged" } })).ok || asset(id).status === "Damaged").toBe(true);
      expect((await repo.execute({ action: "asset.edit", entityId: id, values: { status: "Archived" } })).ok).toBe(true);
      expect(snap().repairs.some((r) => r.id === repair.entityId)).toBe(true);
    });

    const startMaintenance = async (id: string) => {
      const task = await repo.execute({ action: "maintenance.create", entityId: id, values: { type: "Quarterly inspection", scheduledDate: "2026-12-31" } });
      expect(task.ok, task.message).toBe(true);
      return task.entityId!;
    };

    it("starting maintenance puts the asset In maintenance; completing restores it (Tests 9 and 10)", async () => {
      const id = await newAsset();
      const task = await startMaintenance(id);
      expect(asset(id).status).toBe("Available"); // only scheduled so far: still in service
      expect((await repo.execute({ action: "maintenance.start", entityId: task })).ok).toBe(true);
      expect(asset(id).status).toBe("Under Maintenance");
      const done = await repo.execute({ action: "maintenance.complete", entityId: task, values: {} });
      expect(done.ok, done.message).toBe(true);
      expect(asset(id).status).toBe("Available");
    });

    it("an assigned asset keeps its holder and returns to Assigned, never to Available", async () => {
      const [ann] = users();
      const id = await newAsset({ assignedTo: ann.name });
      const task = await startMaintenance(id);
      await repo.execute({ action: "maintenance.start", entityId: task });
      expect(asset(id)).toMatchObject({ status: "Under Maintenance", assignedTo: ann.name });
      await repo.execute({ action: "maintenance.complete", entityId: task, values: {} });
      expect(asset(id)).toMatchObject({ status: "Assigned", assignedTo: ann.name });
      expect(snap().assignments.filter((a) => a.assetId === id && a.active)).toHaveLength(1);
    });

    it("cancelling started maintenance restores the previous status; pausing keeps it in maintenance", async () => {
      const id = await newAsset();
      const task = await startMaintenance(id);
      await repo.execute({ action: "maintenance.start", entityId: task });
      await repo.execute({ action: "maintenance.pause", entityId: task });
      expect(asset(id).status).toBe("Under Maintenance");
      await repo.execute({ action: "maintenance.resume", entityId: task });
      const cancelled = await repo.execute({ action: "maintenance.cancel", entityId: task, values: { reason: "Not needed" } });
      expect(cancelled.ok, cancelled.message).toBe(true);
      expect(asset(id).status).toBe("Available");
    });

    it("an archived or lost asset cannot enter maintenance", async () => {
      const id = await newAsset();
      await repo.execute({ action: "asset.edit", entityId: id, values: { status: "Archived" } });
      const task = await startMaintenance(id);
      const started = await repo.execute({ action: "maintenance.start", entityId: task });
      expect(started.ok).toBe(false);
      expect(started.message).toMatch(/cannot enter maintenance/);
      expect(asset(id).status).toBe("Archived");
    });
  });

  describe("Layer 9: disposal keeps the identity (Test 15)", () => {
    it("never reuses the Inv.code and keeps assignment, repair and movement history", async () => {
      const [ann] = users();
      const id = await newAsset({ assignedTo: ann.name });
      const code = asset(id).code;
      await repo.execute({ action: "asset.edit", entityId: id, values: { assignedTo: "" } });
      const disposal = await repo.execute({ action: "disposal.create", entityId: id, values: { reason: "End of life" } });
      expect(disposal.ok, disposal.message).toBe(true);
      for (const step of ["disposal.inspect", "disposal.approve", "disposal.method", "disposal.complete"] as const)
        expect((await repo.execute({ action: step, entityId: disposal.entityId, values: { method: "Recycling", reason: "End of life" } })).ok, step).toBe(true);
      expect(asset(id).status).toBe("Disposed");
      expect(snap().assets.some((a) => a.code === code)).toBe(true);
      expect(snap().assignments.some((a) => a.assetId === id)).toBe(true);
      const replacement = await newAsset();
      expect(asset(replacement).code).not.toBe(code);
      // A disposed asset can't be reactivated or reassigned through a plain edit.
      expect((await repo.execute({ action: "asset.edit", entityId: id, values: { status: "Available" } })).ok).toBe(false);
    });
  });

  describe("Layer 9/10: history and audit cannot be deleted (Tests 17-19)", () => {
    const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
    const rule = (header: string) => {
      const start = rules.indexOf(header);
      expect(start, `${header} exists`).toBeGreaterThan(-1);
      const next = rules.indexOf("\n    match /", start + header.length);
      return rules.slice(start, next === -1 ? undefined : next);
    };

    it("audit logs can neither be changed nor deleted by any client", () => {
      const block = rule("match /activityLogs/{id}");
      expect(block).toContain("allow update, delete: if false;");
    });

    it("history events can only be deleted while they are a manual draft", () => {
      const block = rule("match /assetHistoryEvents/{id}");
      expect(block).toMatch(/allow delete: if resource\.data\.isManual == true\s+&& resource\.data\.status == 'Draft'/);
      expect(block).toMatch(/allow update:[\s\S]*resource\.data\.status == 'Draft'/);
    });

    it("inventory movements and transactions are append-only, and only locations/departments can ever be deleted generically", () => {
      expect(rules).toContain("&& collectionName != 'inventoryTransactions'");
      expect(rules).toContain("&& collectionName != 'assetMovements'");
      const generic = rule("match /{collectionName}/{id}");
      const del = generic.slice(generic.indexOf("allow delete:"));
      expect(del).not.toMatch(/inventoryTransactions|assetMovements|activityLogs|audits/);
      expect(del).toContain("collectionName == 'locations'");
      expect(del).toContain("collectionName == 'departments'");
    });

    it("asset records are never deletable (history keeps its subject)", () => {
      const block = rule("match /assets/{id}");
      expect(block).toContain("allow delete: if false;");
    });

    it("the engine offers no way to remove a movement, audit entry or asset", async () => {
      const actions = readFileSync(resolve(process.cwd(), "src/data/contracts.ts"), "utf8");
      for (const forbidden of ["movement.delete", "audit.delete", "activity.delete", "asset.delete", "movement.remove"])
        expect(actions).not.toContain(`"${forbidden}"`);
    });
  });
});
