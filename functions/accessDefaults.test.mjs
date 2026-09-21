import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ACCESS_PERMISSIONS,
  DEFAULT_ACCESS_ROLE,
} from "./accessDefaults.js";

test("default access uses the application fallback role", () => {
  assert.equal(DEFAULT_ACCESS_ROLE, "warehouse-staff");
});

test("default access grants read visibility across core modules", () => {
  for (const permission of [
    "dashboard.view",
    "assets.view",
    "inventory.view",
    "inventory.movements.view",
    "assignments.manage",
    "borrow.manage",
    "movements.manage",
    "audits.view",
    "notifications.view",
    "disposals.view",
  ]) {
    assert.ok(
      DEFAULT_ACCESS_PERMISSIONS.includes(permission),
      `expected ${permission} in the default grant`,
    );
  }
});

test("default access never grants elevated or admin permissions", () => {
  for (const permission of DEFAULT_ACCESS_PERMISSIONS) {
    assert.ok(
      !permission.startsWith("admin."),
      `default access must not contain ${permission}`,
    );
  }
  for (const forbidden of [
    "inventory.import",
    "assets.import",
    "users.manage",
    "roles.manage",
    "settings.manage",
    "admin.access",
    "admin.users.manage",
    "admin.system.configure",
  ]) {
    assert.ok(
      !DEFAULT_ACCESS_PERMISSIONS.includes(forbidden),
      `default access must not contain ${forbidden}`,
    );
  }
});
