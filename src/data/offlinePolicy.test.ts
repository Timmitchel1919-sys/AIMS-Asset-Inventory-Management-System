import { describe, expect, it } from "vitest";
import { isConnectionRequiredAction } from "./offlinePolicy";

describe("isConnectionRequiredAction", () => {
  it("blocks creates, deletes, stock moves and imports offline", () => {
    for (const a of [
      "asset.create",
      "inventory.create",
      "codeGroup.create",
      "assignment.create",
      "movement.create",
      "reference.delete",
      "codeGroup.delete",
      "stock.receive",
      "stock.issue",
      "stock.transfer",
      "stock.correct",
      "history.legacy.import",
      "inventory.legacy.importBatch",
      "audit.generate",
      "asset.move",
      "asset.return",
      "bulk.move",
    ]) {
      expect(isConnectionRequiredAction(a)).toBe(true);
    }
  });

  it("allows edits and state transitions on existing records offline", () => {
    for (const a of [
      "asset.edit",
      "asset.archive",
      "asset.restore",
      "inventory.edit",
      "inventory.archive",
      "reference.edit",
      "reference.archive",
      "reference.restore",
      "codeGroup.edit",
      "codeGroup.activate",
      "codeGroup.reorder",
      "assignment.return",
      "repair.complete",
      "maintenance.start",
      "audit.review",
      "movement.approve",
      "report.export",
    ]) {
      expect(isConnectionRequiredAction(a)).toBe(false);
    }
  });

  it("is safe on empty input", () => {
    expect(isConnectionRequiredAction("")).toBe(false);
  });
});
