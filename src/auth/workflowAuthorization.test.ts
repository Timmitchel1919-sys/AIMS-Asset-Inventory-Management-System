import { describe, expect, it } from "vitest";
import { isCommandAllowed, requiredPermission } from "./workflowAuthorization";

describe("workflow authorization", () => {
  it("maps sensitive operations to granular permissions", () => {
    expect(requiredPermission({ action: "stock.correct" })).toBe(
      "inventory.correct",
    );
    expect(requiredPermission({ action: "user.deactivate" })).toBe(
      "admin.users.manage",
    );
    expect(requiredPermission({ action: "report.generate" })).toBe(
      "reports.generate",
    );
    expect(requiredPermission({ action: "inventory.legacy.importBatch" })).toBe(
      "inventory.import",
    );
  });

  it("uses the reference kind instead of a generic settings permission", () => {
    expect(
      requiredPermission({
        action: "reference.edit",
        values: { kind: "department" },
      }),
    ).toBe("departments.manage");
  });

  it("gates asset transfer / return behind movements.create", () => {
    expect(requiredPermission({ action: "asset.move" })).toBe("movements.create");
    expect(requiredPermission({ action: "asset.return" })).toBe(
      "movements.create",
    );
    expect(
      isCommandAllowed({ action: "asset.return" }, ["assets.view"]),
    ).toBe(false);
    expect(
      isCommandAllowed({ action: "asset.return" }, ["movements.create"]),
    ).toBe(true);
  });

  it("applies explicit denials after grants", () => {
    const command = { action: "asset.edit" as const };
    expect(isCommandAllowed(command, ["assets.edit"])).toBe(true);
    expect(isCommandAllowed(command, ["assets.edit"], ["assets.edit"])).toBe(
      false,
    );
  });
});
