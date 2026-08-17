import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "aims-rules-test";
let environment: RulesTestEnvironment;

const verified = (email = "verified@kangoeroeschool.com", permissions: string[] = []) => ({
  email,
  email_verified: true,
  permissions,
});

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

beforeEach(() => environment.clearFirestore());
afterAll(() => environment.cleanup());

describe("AIMS Firestore authorization", () => {
  it("denies unauthenticated, wrong-domain, unverified, and lookalike accounts", async () => {
    const path = "assets/asset-1";
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), path)));
    for (const claims of [
      verified("person@gmail.com"),
      { email: "person@kangoeroeschool.com", email_verified: false },
      verified("person@sub.kangoeroeschool.com"),
      verified("person@kangoeroeschool.com.attacker.com"),
    ]) {
      await assertFails(getDoc(doc(environment.authenticatedContext("blocked", claims).firestore(), path)));
    }
  });

  it("allows an exact-domain verified user to read operational data", async () => {
    await environment.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), "assets/asset-1"), { name: "Laptop" }),
    );
    await assertSucceeds(
      getDoc(doc(environment.authenticatedContext("school-user", verified()).firestore(), "assets/asset-1")),
    );
  });

  it("allows only a valid self profile and denies privilege injection or cross-user access", async () => {
    const db = environment.authenticatedContext("user-1", verified()).firestore();
    const profile = {
      uid: "user-1",
      displayName: "School User",
      email: "verified@kangoeroeschool.com",
      emailNormalized: "verified@kangoeroeschool.com",
      photoURL: null,
      department: null,
      jobTitle: null,
      accountType: "school-user",
      organizationDomain: "kangoeroeschool.com",
      authProvider: "password",
      emailVerified: true,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      firstLoginAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      preferences: {},
    };
    await assertSucceeds(setDoc(doc(db, "users/user-1"), profile));
    await assertFails(updateDoc(doc(db, "users/user-1"), { role: "admin" }));
    await assertFails(getDoc(doc(db, "users/user-2")));
  });

  it("denies schema pollution and invalid inventory quantities", async () => {
    const db = environment.authenticatedContext("user-1", verified()).firestore();
    const valid = {
      code: "INV-1",
      name: "Cable",
      itemType: "Consumable",
      category: "Cables",
      unit: "piece",
      onHand: 10,
      reserved: 0,
      minimum: 1,
      reorderLevel: 2,
      reorderQuantity: 5,
      warehouse: "Main",
      location: "A1",
      createdBy: "user-1",
      createdAt: serverTimestamp(),
      modifiedBy: "user-1",
      lastUpdated: serverTimestamp(),
      archived: false,
      updatedAt: serverTimestamp(),
      updatedBy: "user-1",
    };
    await assertSucceeds(setDoc(doc(db, "inventoryItems/item-1"), valid));
    await assertFails(updateDoc(doc(db, "inventoryItems/item-1"), { onHand: -1 }));
    await assertFails(updateDoc(doc(db, "inventoryItems/item-1"), { injectedPrivilege: true }));
  });

  it("keeps activity immutable", async () => {
    const db = environment.authenticatedContext("user-1", verified()).firestore();
    await assertSucceeds(setDoc(doc(db, "activityLogs/log-1"), {
      at: "2026-08-17T12:00:00.000Z",
      user: "School User",
      action: "asset.create",
      entityType: "asset",
      entityId: "asset-1",
      result: "Success",
      detail: "Created",
      createdAt: serverTimestamp(),
      createdBy: "user-1",
      updatedAt: serverTimestamp(),
      updatedBy: "user-1",
    }));
    await assertFails(updateDoc(doc(db, "activityLogs/log-1"), { detail: "Changed" }));
  });

  it("requires trusted claims for administration collections", async () => {
    const normal = environment.authenticatedContext("user-1", verified()).firestore();
    const admin = environment.authenticatedContext(
      "admin-1",
      verified("admin@kangoeroeschool.com", ["admin.roles.manage"]),
    ).firestore();
    const role = {
      name: "Administrator",
      description: "Trusted administrators",
      permissions: ["admin.roles.manage"],
      system: false,
      createdAt: serverTimestamp(),
      createdBy: "admin-1",
      updatedAt: serverTimestamp(),
      updatedBy: "admin-1",
    };
    await assertFails(setDoc(doc(normal, "roles/administrator"), role));
    await assertSucceeds(setDoc(doc(admin, "roles/administrator"), role));
  });

  it("default-denies unknown collections", async () => {
    const db = environment.authenticatedContext("user-1", verified()).firestore();
    await assertFails(setDoc(doc(db, "unknown/doc"), { value: true }));
  });
});
