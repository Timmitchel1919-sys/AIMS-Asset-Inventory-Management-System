import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rules = readFileSync(
  new URL("./firestore.rules", import.meta.url),
  "utf8",
);
describe("Firestore AIMS authorization rules", () => {
  it("accepts every current theme, the legacy Midnight id and every supported font", () => {
    for (const theme of [
      "aimsAzureGlass",
      "dark",
      "aimsMidnight",
      "aimsEmeraldGloss",
      "aimsLight",
      "aimsTurquoiseGlass",
    ])
      expect(rules).toContain(`'${theme}'`);
    for (const font of [
      "Inter",
      "IBM Plex Mono",
      "Montserrat",
      "Source Sans 3",
      "Roboto",
      "Open Sans",
    ])
      expect(rules).toContain(`'${font}'`);
  });
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
  it("keeps asset codes immutable", () => {
    expect(rules).toContain(
      "request.resource.data.code == resource.data.code",
    );
    expect(rules).toContain(
      "request.resource.data.codePrefix == resource.data.codePrefix",
    );
    expect(rules).toContain(
      "request.resource.data.codeNumber == resource.data.codeNumber",
    );
  });
  it("identifies the Owner by verified token email, never by a writable role field", () => {
    expect(rules).toContain(
      "request.auth.token.email.lower() == 'aliendas@kangoeroeschool.com'",
    );
    expect(rules).not.toContain("data.role == 'owner'");
    expect(rules).toContain("return isOwner() || hasTrustedAccessSignal();");
    expect(rules).toContain("return hasAccessAssignment() && get(accessAssignmentPath()).data.active == true;");
    expect(rules).toContain("hasTrustedTokenSignal() && !hasAccessAssignment()");
    expect(rules).toContain("ownerRoleAllowed(request.resource.data)");
    expect(rules).toContain("ownerRoleAllowed(resource.data)");
    for (const name of [
      "deviceManagement",
      "deviceCommands",
      "devicePolicies",
      "deviceNetwork",
      "deviceCompliance",
      "deviceAuditTrail",
    ])
      expect(rules).toContain(`match /${name}/{document=**}`);
  });
  it("keeps Network Discovery owner-readable and client-write-denied", () => {
    for (const name of ["discoveryAgents", "discoveryRequests", "discoveredDevices"])
      expect(rules).toContain(`match /${name}/{document=**} { allow read: if isOwner(); allow write: if false; }`);
    expect(rules).toContain("match /discoveryEnrollments/{document=**} { allow read, write: if false; }");
  });
  it("separates user-readable device data from Owner-only actions", () => {
    expect(rules).toContain("match /deviceManagement/{document=**}");
    expect(rules).toContain("match /deviceNetwork/{document=**}");
    expect(rules).toContain("match /deviceCompliance/{document=**}");
    expect(rules.match(/allow read: if isAuthorizedAimsUser\(\);/g)?.length).toBeGreaterThanOrEqual(3);
    for (const name of ["deviceCommands", "devicePolicies"])
      expect(rules).toContain(`match /${name}/{document=**} {\n      allow read, write: if isOwner();`);
    expect(rules).toContain("match /deviceNetwork/{document=**} {\n      allow read: if isAuthorizedAimsUser();\n      allow write: if false;");
  });
  it("keeps tracking type management Owner-only while retaining safe reference reads", () => {
    expect(rules).toContain("match /assetTypes/{id}");
    expect(rules).toContain("data.behavior in ['SERIALIZED','BULK','CONSUMABLE']");
    expect(rules).toContain("request.resource.data.behavior == resource.data.behavior");
    // Asset types are archived, never deleted.
    const block = rules.slice(rules.indexOf("match /assetTypes/{id}"), rules.indexOf("match /assetCodes/{code}"));
    expect(block).toContain("allow read: if isAuthorizedAimsUser();");
    expect(block).toContain("allow create: if isOwner()");
    expect(block).toContain("allow update: if isOwner()");
    expect(block).not.toContain("hasPermission('categories.manage')");
    expect(block).toContain("allow delete: if false;");
    for (const field of ["categoryId", "assetTypeId", "codeGroupId", "departmentId", "assignedUserId"])
      expect(rules).toContain(`nullableShortString(data, '${field}', 128)`);
    // The immutable inventory-code guarantee on asset updates is untouched.
    expect(rules).toContain("request.resource.data.code == resource.data.code");
  });
  it("allows only a well-formed canonical audit event on activity logs", () => {
    expect(rules).toContain("'action','event','entityType'");
    expect(rules).toContain("data.event.matches('^[A-Z_]{3,48}$')");
    // Activity logs stay immutable.
    expect(rules).toContain("match /activityLogs/{id}");
  });
});
