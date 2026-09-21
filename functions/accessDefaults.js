// Baseline access for a newly verified school account. It mirrors the
// application's fallback role (warehouse-staff in src/auth/permissions.ts +
// src/context/AppContext.tsx) so that a user who registered and verified can
// actually read and operate the system before an administrator customizes
// their role/assignment. Keep this list synchronized with
// rolePermissions['warehouse-staff'].
export const DEFAULT_ACCESS_ROLE = "warehouse-staff";

export const DEFAULT_ACCESS_PERMISSIONS = [
  "dashboard.view",
  "assets.view",
  "inventory.view",
  "inventory.manage",
  "inventory.create",
  "inventory.edit",
  "inventory.receive",
  "inventory.issue",
  "inventory.transfer",
  "inventory.return",
  "inventory.reserve",
  "inventory.export",
  "inventory.movements.view",
  "assignments.manage",
  "borrow.manage",
  "movements.manage",
  "audits.view",
  "audits.perform",
  "notifications.view",
  "disposals.view",
  "disposals.request",
];
