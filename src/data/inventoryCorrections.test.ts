// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { MockInventoryRepository } from "./mockRepository";
import { withAssetWorkflowComposition } from "./assetWorkflowComposition";

/**
 * Inventory control: a finding NEVER overwrites authoritative data. A change to
 * the asset record happens only through a proposed, reviewed and approved
 * correction, via the normal validated workflows, with a full audit trail.
 */
describe("inventory control discrepancies and corrections", () => {
  let repo: MockInventoryRepository;
  const snap = () => repo.snapshot();
  const asset = (id: string) => snap().assets.find((a) => a.id === id)!;

  beforeEach(async () => {
    localStorage.setItem("kcs-language", "en");
    repo = withAssetWorkflowComposition(new MockInventoryRepository());
  });

  /** An audit whose first sampled record is an ICT asset, with a recorded discrepancy. */
  async function discrepancyOnAsset(outcome = "Wrong Location") {
    const generated = await repo.execute({
      action: "audit.generate",
      values: { name: "Control", count: snap().assets.length, seed: "S", assignee: "Auditor", deadline: "2026-12-31" },
    });
    expect(generated.ok, generated.message).toBe(true);
    const audit = snap().audits.find((a) => a.id === generated.entityId)!;
    const item = audit.sampleItems!.find((i) => snap().assets.some((a) => a.id === i.recordId))!;
    expect(item, "the audit samples at least one asset").toBeTruthy();
    const recorded = await repo.execute({
      action: "audit.discrepancy",
      entityId: audit.id,
      values: { scannedCode: item.code, outcome, notes: "Found elsewhere" },
    });
    expect(recorded.ok, recorded.message).toBe(true);
    const discrepancy = snap().auditDiscrepancies.find((d) => d.recordId === item.recordId)!;
    return { audit, item, discrepancy, assetId: item.recordId };
  }

  const propose = async (discrepancyId: string, field: string, value: string, reason = "Physically verified in another room") => {
    const created = await repo.execute({
      action: "corrective.create",
      entityId: discrepancyId,
      actor: "Auditor",
      values: { proposedField: field, proposedValue: value, description: reason, type: "Correct record" },
    });
    expect(created.ok, created.message).toBe(true);
    expect((await repo.execute({ action: "corrective.start", entityId: created.entityId })).ok).toBe(true);
    const submitted = await repo.execute({ action: "corrective.complete", entityId: created.entityId });
    expect(submitted.ok, submitted.message).toBe(true);
    return created.entityId!;
  };
  const action = (id: string) => snap().correctiveActions.find((a) => a.id === id)!;

  it("recording a discrepancy leaves the authoritative asset untouched (Test 13)", async () => {
    const generated = await repo.execute({ action: "audit.generate", values: { name: "C", count: snap().assets.length, seed: "S", assignee: "A", deadline: "2026-12-31" } });
    const audit = snap().audits.find((a) => a.id === generated.entityId)!;
    const item = audit.sampleItems!.find((i) => snap().assets.some((a) => a.id === i.recordId))!;
    const before = JSON.stringify(asset(item.recordId));
    const assetsBefore = snap().assets.length;
    await repo.execute({ action: "audit.discrepancy", entityId: audit.id, values: { scannedCode: item.code, outcome: "Wrong location" } });
    expect(snap().auditDiscrepancies.some((d) => d.recordId === item.recordId)).toBe(true);
    expect(JSON.stringify(asset(item.recordId))).toBe(before);
    expect(snap().assets).toHaveLength(assetsBefore);
  });

  it("a proposal needs a valid field, a value and a reason", async () => {
    const { discrepancy } = await discrepancyOnAsset();
    const bad = (values: Record<string, unknown>) => repo.execute({ action: "corrective.create", entityId: discrepancy.id, values });
    expect((await bad({ proposedField: "code", proposedValue: "X-1", description: "because" })).ok).toBe(false);
    expect((await bad({ proposedField: "condition", proposedValue: "", description: "because" })).ok).toBe(false);
    expect((await bad({ proposedField: "condition", proposedValue: "Good", description: "" })).ok).toBe(false);
  });

  it("an unapproved correction cannot be applied and changes nothing", async () => {
    const { discrepancy, assetId } = await discrepancyOnAsset();
    const id = await propose(discrepancy.id, "condition", "Poor");
    expect(action(id).status).toBe("Pending Approval");
    expect(action(id).approvalRequired).toBe(true);
    const before = JSON.stringify(asset(assetId));
    const result = await repo.execute({ action: "corrective.apply", entityId: id });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/approved/i);
    expect(JSON.stringify(asset(assetId))).toBe(before);
  });

  it("an approved condition correction changes the asset and is audited end to end (Test 14)", async () => {
    const { discrepancy, assetId } = await discrepancyOnAsset();
    const was = asset(assetId).condition;
    const next = was === "Poor" ? "Fair" : "Poor";
    const id = await propose(discrepancy.id, "condition", next);
    expect((await repo.execute({ action: "corrective.approve", entityId: id })).ok).toBe(true);
    const applied = await repo.execute({ action: "corrective.apply", entityId: id, actor: "Reviewer" });
    expect(applied.ok, applied.message).toBe(true);
    expect(applied.message).toContain(`${was} → ${next}`);
    expect(asset(assetId).condition).toBe(next);
    expect(action(id).status).toBe("Completed");
    expect(action(id).appliedChange).toMatchObject({ field: "condition", from: was, to: next, by: "Reviewer" });
    expect(snap().auditDiscrepancies.find((d) => d.id === discrepancy.id)!.status).toBe("Resolved");
    // Every step left an audit entry.
    const actions = snap().activity.filter((e) => e.result === "Success").map((e) => e.action);
    for (const expected of ["asset.edit", "corrective.complete", "discrepancy.resolve"]) expect(actions).toContain(expected);
    // It cannot be applied a second time.
    expect((await repo.execute({ action: "corrective.apply", entityId: id })).ok).toBe(false);
  });

  it("a location correction moves the asset through the movement workflow and keeps the old location in history", async () => {
    const { discrepancy, assetId } = await discrepancyOnAsset();
    const current = asset(assetId).currentLocationId;
    const target = snap().references.find((r) => r.kind === "location" && r.status === "Active" && r.type !== "Main location" && r.id !== current)!;
    expect(target).toBeTruthy();
    const movements = snap().movements.length;
    const id = await propose(discrepancy.id, "location", target.id);
    await repo.execute({ action: "corrective.approve", entityId: id });
    const applied = await repo.execute({ action: "corrective.apply", entityId: id });
    expect(applied.ok, applied.message).toBe(true);
    expect(asset(assetId).currentLocationId).toBe(target.id);
    expect(snap().movements).toHaveLength(movements + 1);
    expect(snap().movements[0]).toMatchObject({ assetId, destinationLocationId: target.id, immutable: true });
    expect(snap().movements[0].reason ?? "").toMatch(/correction/i);
  });

  it("an assignee correction goes through assignment management", async () => {
    const { discrepancy, assetId } = await discrepancyOnAsset();
    // Make sure the asset can be assigned.
    asset(assetId).status = "Available";
    asset(assetId).assignedTo = undefined;
    const user = snap().users[0];
    const id = await propose(discrepancy.id, "assignedTo", user.name);
    await repo.execute({ action: "corrective.approve", entityId: id });
    const applied = await repo.execute({ action: "corrective.apply", entityId: id });
    expect(applied.ok, applied.message).toBe(true);
    expect(asset(assetId)).toMatchObject({ assignedTo: user.name, status: "Assigned" });
    expect(snap().assignments.filter((a) => a.assetId === assetId && a.active)).toHaveLength(1);
  });

  it("an impossible correction is refused and leaves everything as it was", async () => {
    const { discrepancy, assetId } = await discrepancyOnAsset();
    asset(assetId).status = "Archived";
    const id = await propose(discrepancy.id, "status", "Available"); // Archived -> Available is not allowed
    await repo.execute({ action: "corrective.approve", entityId: id });
    const result = await repo.execute({ action: "corrective.apply", entityId: id });
    expect(result.ok).toBe(false);
    expect(asset(assetId).status).toBe("Archived");
    expect(action(id).status).toBe("Approved"); // still approved, nothing half done
    expect(snap().auditDiscrepancies.find((d) => d.id === discrepancy.id)!.status).not.toBe("Resolved");
  });

  it("refuses to apply when the asset already equals the proposed value (stale proposal)", async () => {
    const { discrepancy, assetId } = await discrepancyOnAsset();
    const id = await propose(discrepancy.id, "condition", asset(assetId).condition);
    await repo.execute({ action: "corrective.approve", entityId: id });
    const result = await repo.execute({ action: "corrective.apply", entityId: id });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/changed after the proposal/);
  });

  it("an approved action that required approval can be completed (previously an invalid Approved -> Pending Approval)", async () => {
    const { discrepancy } = await discrepancyOnAsset();
    const created = await repo.execute({ action: "corrective.create", entityId: discrepancy.id, values: { approvalRequired: "true", description: "Recount and fix" } });
    await repo.execute({ action: "corrective.start", entityId: created.entityId });
    await repo.execute({ action: "corrective.complete", entityId: created.entityId });
    await repo.execute({ action: "corrective.approve", entityId: created.entityId });
    const done = await repo.execute({ action: "corrective.complete", entityId: created.entityId });
    expect(done.ok, done.message).toBe(true);
    expect(action(created.entityId!).status).toBe("Completed");
  });
});
