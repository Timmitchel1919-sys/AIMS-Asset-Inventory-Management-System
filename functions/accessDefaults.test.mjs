import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

// Current policy: every verified, non-suspended school account has full
// ("super admin") rights. The seeded document therefore carries the complete
// permission catalog, identical to rolePermissions in src/auth/permissions.ts.
// (Enforcement does not depend on this list: firestore.rules and
// resolveActorAccess() grant every permission to any verified, active user.)
test("default access carries the full permission catalog, including admin permissions", () => {
  for (const permission of [
    "assets.import",
    "inventory.import",
    "admin.access",
    "admin.users.manage",
    "admin.system.configure",
    "categories.manage",
  ]) {
    assert.ok(
      DEFAULT_ACCESS_PERMISSIONS.includes(permission),
      `expected ${permission} in the default grant (full-rights policy)`,
    );
  }
});

test("default access has no duplicates or malformed permission names", () => {
  assert.equal(
    new Set(DEFAULT_ACCESS_PERMISSIONS).size,
    DEFAULT_ACCESS_PERMISSIONS.length,
  );
  for (const permission of DEFAULT_ACCESS_PERMISSIONS)
    assert.match(permission, /^[a-z][A-Za-z_]*(\.[A-Za-z_]+)+$/, permission);
});

test("default access stays identical to the application's permission catalog", () => {
  const source = readFileSync(
    new URL("../src/auth/permissions.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("const all: Permission[] = [");
  assert.ok(start >= 0, "could not find the permission catalog in permissions.ts");
  const catalog = new Set(
    [...source.slice(start, source.indexOf("];", start)).matchAll(/"([A-Za-z_.]+)"/g)].map(
      (match) => match[1],
    ),
  );
  assert.deepEqual(
    [...new Set(DEFAULT_ACCESS_PERMISSIONS)].sort(),
    [...catalog].sort(),
    "functions/accessDefaults.js and src/auth/permissions.ts must list the same permissions",
  );
});
