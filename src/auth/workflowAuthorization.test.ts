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

  it("authorizes master data create/update semantically, not by feature permission", () => {
    const codeGroup = { action: "codeGroup.create" as const };
    expect(requiredPermission(codeGroup)).toBe("masterData.manage");
    expect(
      requiredPermission({ action: "reference.edit", values: { kind: "location" } }),
    ).toBe("masterData.manage");
    expect(
      requiredPermission({
        action: "reference.edit",
        values: { kind: "department" },
      }),
    ).toBe("masterData.manage");
    // Category references stay behind categories.manage.
    expect(
      requiredPermission({
        action: "reference.create",
        values: { kind: "category" },
      }),
    ).toBe("categories.manage");

    // Any authenticated, active AIMS role may manage master data.
    expect(
      isCommandAllowed(codeGroup, [], [], { role: "warehouse-staff" }),
    ).toBe(true);
    expect(
      isCommandAllowed(
        { action: "reference.create", values: { kind: "location" } },
        [],
        [],
        { role: "ict-staff" },
      ),
    ).toBe(true);
    expect(
      isCommandAllowed(
        { action: "reference.create", values: { kind: "department" } },
        [],
        [],
        { role: "warehouse-staff" },
      ),
    ).toBe(true);
    // A user authorized through the dashboard permission is also allowed.
    expect(isCommandAllowed(codeGroup, ["dashboard.view"])).toBe(true);
    // Unrelated feature permissions never grant master data access.
    expect(isCommandAllowed(codeGroup, ["admin.system.configure"])).toBe(false);
    expect(
      isCommandAllowed(
        { action: "reference.create", values: { kind: "department" } },
        ["departments.manage"],
      ),
    ).toBe(false);
    // Unauthenticated / unauthorized actors are denied.
    expect(isCommandAllowed(codeGroup, [])).toBe(false);
  });

  it("classifies location/department archive and restore as master data", () => {
    const locationArchive = {
      action: "reference.archive",
      values: { kind: "location" },
    } as const;
    const departmentRestore = {
      action: "reference.restore",
      values: { kind: "department" },
    } as const;
    expect(requiredPermission(locationArchive)).toBe("masterData.manage");
    expect(requiredPermission(departmentRestore)).toBe("masterData.manage");
    expect(
      isCommandAllowed(locationArchive, [], [], { role: "warehouse-staff" }),
    ).toBe(true);
    expect(
      isCommandAllowed(departmentRestore, [], [], { role: "ict-staff" }),
    ).toBe(true);
    // Without kind info, do not misclassify as master data.
    expect(
      isCommandAllowed({ action: "reference.archive" }, [], [], {
        role: "warehouse-staff",
      }),
    ).toBe(false);
  });

  it("keeps category archive/restore behind categories.manage", () => {
    const categoryArchive = {
      action: "reference.archive",
      values: { kind: "category" },
    } as const;
    expect(requiredPermission(categoryArchive)).toBe("categories.manage");
    expect(
      isCommandAllowed(categoryArchive, [], [], { role: "warehouse-staff" }),
    ).toBe(false);
    expect(isCommandAllowed(categoryArchive, ["categories.manage"])).toBe(true);
    expect(
      isCommandAllowed(
        { action: "reference.restore", values: { kind: "category" } },
        ["dashboard.view"],
      ),
    ).toBe(false);
  });

  it("restricts master data deletion to the designated managers", () => {
    const deleteCodeGroup = { action: "codeGroup.delete" as const };
    expect(
      isCommandAllowed(deleteCodeGroup, [], [], {
        role: "administrator",
        email: "normal@kangoeroeschool.com",
      }),
    ).toBe(false);
    expect(
      isCommandAllowed(deleteCodeGroup, [], [], {
        email: "aliendas@kangoeroeschool.com",
      }),
    ).toBe(true);
    expect(
      isCommandAllowed(deleteCodeGroup, [], [], {
        email: "Manager-ICT@kangoeroeschool.com",
      }),
    ).toBe(true);
    expect(
      isCommandAllowed({ action: "reference.delete" }, [], [], {
        email: "sastropawiroe@kangoeroeschool.com",
      }),
    ).toBe(true);
    expect(isCommandAllowed({ action: "reference.delete" }, [], [], {})).toBe(
      false,
    );
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
