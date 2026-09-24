import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rules = readFileSync(
  new URL("./firestore.rules", import.meta.url),
  "utf8",
);
describe("Firestore AIMS authorization rules", () => {
  it("uses one secure exact verified-domain production ruleset", () => {
    expect(rules).toContain(
      "request.auth.token.email.matches('^[^@]+@[Kk][Aa][Nn][Gg][Oo][Ee][Rr][Oo][Ee][Ss][Cc][Hh][Oo][Oo][Ll][.]com$')",
    );
    expect(rules).toContain("request.auth.token.email_verified == true");
    expect(rules).not.toContain("allow read, write: if request.auth != null");
  });
  it("restricts user creation to the authenticated uid and protected metadata", () => {
    expect(rules).toContain("isVerified() && request.auth.uid == uid");
    expect(rules).toContain("data.accountType == 'school-user'");
    expect(rules).toContain("data.organizationDomain == 'kangoeroeschool.com'");
    expect(rules).toContain(
      "affectedKeys().hasOnly(['displayName','photoURL','department','jobTitle','preferences','authProvider','emailVerified','updatedAt','lastLoginAt'])",
    );
  });
  it("keeps private profiles owner-only and exposes only a validated email-free directory", () => {
    expect(rules).toContain("match /userDirectory/{uid}");
    expect(rules).toContain(
      "hasOnly(['uid','displayName','photoURL','department','jobTitle','accountType','authProvider','emailVerified','status','updatedAt','lastLoginAt'])",
    );
    expect(rules).toContain("allow read: if isOwnUser(uid);");
  });
  it("keeps audit history immutable and defaults to deny", () => {
    expect(rules).toContain("match /activityLogs/{id}");
    expect(rules).toContain("allow update, delete: if false;");
    expect(rules).toContain(
      "match /{document=**} { allow read, write: if false; }",
    );
  });
  it("allows only explicitly authorized, schema-validated legacy inventory imports", () => {
    expect(rules).toContain("hasPermission('inventory.import')");
    // Authorization is permission-based, not restricted to specific roles.
    expect(rules).not.toContain("request.auth.token.role in");
    expect(rules).toContain("validLegacyImportedAsset(request.resource.data)");
    expect(rules).toContain("validLegacyImportedInventory(request.resource.data)");
    expect(rules).toContain(
      "data.importMetadata.sourceType == 'legacy_inventory'",
    );
    expect(rules).toContain(
      "data.importMetadata.migrationVersion == 'laptop-inventory-v1'",
    );
    expect(rules).toContain("data.source == 'legacy_import'");
    expect(rules).toContain("isOperationalCollection(collectionName)");
  });
  it("applies the generic deny-by-default catch-all", () => {
    expect(rules).toContain(
      "match /{document=**} { allow read, write: if false; }",
    );
  });
  it("secures QR identities behind asset-view and one-way lifecycle rules", () => {
    expect(rules).toContain("match /qrIdentities/{token}");
    expect(rules).toContain("allow read: if hasPermission('assets.view');");
    expect(rules).toContain("validQrIdentity(request.resource.data)");
    expect(rules).toContain(
      "request.resource.data.assetId == resource.data.assetId",
    );
    expect(rules).toContain("resource.data.status == 'ACTIVE'");
    expect(rules).toContain("allow delete: if false;");
  });
  it("keeps asset codes immutable except a previousCodes-guarded prefix rename", () => {
    expect(rules).toContain(
      "request.resource.data.code == resource.data.code",
    );
    expect(rules).toContain(
      "request.resource.data.codePrefix == resource.data.codePrefix",
    );
    expect(rules).toContain(
      "request.resource.data.codePrefix != resource.data.codePrefix",
    );
    expect(rules).toContain(
      "resource.data.code in request.resource.data.previousCodes",
    );
  });
});
