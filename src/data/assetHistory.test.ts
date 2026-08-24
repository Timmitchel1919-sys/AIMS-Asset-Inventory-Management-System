import { describe, expect, it } from "vitest";
import { WorkflowRepositoryEngine } from "./mockRepository";

describe("asset lifecycle history", () => {
  it.each([
    ["assignment.create", { assignee: "History User", department: "ICT", location: "ICT Store" }, "assignment_create"],
    ["repair.create", { issue: "Display fault", technician: "ICT" }, "repair_create"],
    ["maintenance.create", { type: "Inspection", assignee: "ICT", firstDate: "2026-08-22" }, "maintenance_create"],
    ["asset.move", { destinationLocation: "Server Room", destinationDepartment: "ICT", reason: "Lifecycle test" }, "asset_move"],
    ["disposal.create", { reason: "Lifecycle end", technicalAssessment: "Replace" }, "disposal_create"],
  ] as const)("automatically records %s", async (action, values, expectedType) => {
    const repository = new WorkflowRepositoryEngine();
    const asset = repository.snapshot().assets.find(item => item.status === "Available")!;
    const result = await repository.execute({ action, entityId: asset.id, actor: "Tester", values });
    expect(result.ok).toBe(true);
    expect(repository.snapshot().assetHistoryEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: asset.id, eventType: expectedType, source: "system", status: "Final" }),
    ]));
  });

  it("records condition changes separately", async () => {
    const repository = new WorkflowRepositoryEngine();
    const asset = repository.snapshot().assets[0];
    await repository.execute({ action: "asset.edit", entityId: asset.id, values: { condition: "Fair" } });
    expect(repository.snapshot().assetHistoryEvents[0]).toMatchObject({ eventType: "condition_changed", previous: { condition: "Good" }, next: { condition: "Fair" } });
  });

  it("autosaves and finalizes a manual note without mutating system evidence", async () => {
    const repository = new WorkflowRepositoryEngine();
    const asset = repository.snapshot().assets[0];
    const created = await repository.execute({
      action: "history.manual.saveDraft",
      actor: "Tester",
      values: { assetId: asset.id, title: "SSD check", description: "Health checked", occurredAt: "2026-08-22T09:00" },
    });
    expect(created.ok).toBe(true);
    const draft = repository.snapshot().assetHistoryEvents.find(item => item.id === created.entityId)!;
    expect(draft.status).toBe("Draft");
    await repository.execute({ action: "history.manual.finalize", entityId: draft.id, actor: "Tester" });
    const original = structuredClone(repository.snapshot().assetHistoryEvents.find(item => item.id === draft.id));
    await repository.execute({ action: "history.manual.correct", entityId: draft.id, actor: "Tester", values: { description: "Clarified measurement" } });
    expect(repository.snapshot().assetHistoryEvents.find(item => item.id === draft.id)).toEqual(original);
    expect(repository.snapshot().assetHistoryEvents[0]).toMatchObject({ source: "correction", sourceRecordId: draft.id });
  });
});
