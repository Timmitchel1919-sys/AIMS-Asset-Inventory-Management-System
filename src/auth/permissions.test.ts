import { describe, expect, it } from "vitest";
import { can } from "./permissions";
describe("permission checks", () => {
  it("allows administrators", () =>
    expect(can("administrator", "roles.manage")).toBe(true));
  it("blocks auditors from mutations", () =>
    expect(can("auditor", "assets.edit")).toBe(false));
  it("allows auditors to view activity", () =>
    expect(can("auditor", "activity.view")).toBe(true));
  it("allows only asset-managing ICT roles to import assets", () => {
    expect(can("administrator", "assets.import")).toBe(true);
    expect(can("ict-manager", "assets.import")).toBe(true);
    expect(can("ict-staff", "assets.import")).toBe(true);
    expect(can("warehouse-manager", "assets.import")).toBe(false);
    expect(can("warehouse-staff", "assets.import")).toBe(false);
    expect(can("management", "assets.import")).toBe(false);
    expect(can("auditor", "assets.import")).toBe(false);
  });
  it("restricts production inventory imports to accountable manager roles", () => {
    expect(can("administrator", "inventory.import")).toBe(true);
    expect(can("ict-manager", "inventory.import")).toBe(true);
    expect(can("ict-staff", "inventory.import")).toBe(false);
    expect(can("warehouse-manager", "inventory.import")).toBe(true);
    expect(can("warehouse-staff", "inventory.import")).toBe(false);
    expect(can("management", "inventory.import")).toBe(false);
    expect(can("auditor", "inventory.import")).toBe(false);
  });
});
