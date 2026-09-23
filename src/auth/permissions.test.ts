import { describe, expect, it } from "vitest";
import { can, rolePermissions } from "./permissions";

const roles = Object.keys(rolePermissions) as (keyof typeof rolePermissions)[];

describe("permission checks", () => {
  it("allows administrators", () =>
    expect(can("administrator", "roles.manage")).toBe(true));
  // Every role now carries full ("super admin") rights: what an
  // administrator can see and do, every other role can too, including
  // deletion (routed through the existing recycle-bin/soft-delete flow).
  it("every role has every permission", () => {
    for (const role of roles) {
      expect(can(role, "assets.edit")).toBe(true);
      expect(can(role, "activity.view")).toBe(true);
      expect(can(role, "assets.import")).toBe(true);
      expect(can(role, "inventory.import")).toBe(true);
      expect(can(role, "users.manage")).toBe(true);
      expect(can(role, "roles.manage")).toBe(true);
      expect(rolePermissions[role]).toEqual(rolePermissions.administrator);
    }
  });
});
