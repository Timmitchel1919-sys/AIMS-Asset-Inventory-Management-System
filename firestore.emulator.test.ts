import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FirebaseInventoryRepository } from "./src/data/firebaseRepository";

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
      getDoc(doc(environment.authenticatedContext("school-user", verified(undefined, ["assets.view"])).firestore(), "assets/asset-1")),
    );
  });

  it("denies operational access without permission claims", async () => {
    await environment.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), "assets/asset-1"), { name: "Laptop" }),
    );
    const db = environment.authenticatedContext("school-user", verified()).firestore();
    await assertFails(getDoc(doc(db, "assets/asset-1")));
    await assertFails(setDoc(doc(db, "assets/asset-2"), { name: "Injected" }));
  });

  it("applies an explicit denial after a permission grant", async () => {
    await environment.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), "assets/asset-1"), { name: "Laptop" }),
    );
    const claims = { ...verified(undefined, ["assets.view"]), denials: ["assets.view"] };
    await assertFails(getDoc(doc(environment.authenticatedContext("denied", claims).firestore(), "assets/asset-1")));
  });

  it("uses a protected access assignment without trusting the user profile", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "assets/asset-1"), { name: "Laptop" });
      await setDoc(doc(db, "accessAssignments/scoped-user"), {
        uid: "scoped-user", role: "auditor", permissions: ["assets.view"], denials: [],
        active: true, allRecords: true, departmentIds: [], locationIds: [],
        createdAt: serverTimestamp(), createdBy: "bootstrap-admin",
        updatedAt: serverTimestamp(), updatedBy: "bootstrap-admin",
      });
    });
    const db = environment.authenticatedContext("scoped-user", verified()).firestore();
    await assertSucceeds(getDoc(doc(db, "assets/asset-1")));
    await assertSucceeds(getDoc(doc(db, "accessAssignments/scoped-user")));
    await assertFails(updateDoc(doc(db, "accessAssignments/scoped-user"), { permissions: ["admin.users.manage"] }));
  });

  it("limits bootstrap administration to the confirmed UID and verified school domain", async () => {
    const uid = "VogTjC6S1aXHO6ySBbdiQ7LNOYG3";
    const valid = environment.authenticatedContext(uid, verified("aliendas@kangoeroeschool.com")).firestore();
    const wrongDomain = environment.authenticatedContext(uid, verified("aliendas@gmail.com")).firestore();
    const role = {
      name: "Bootstrap test", description: "Trusted bootstrap administrator",
      permissions: ["admin.roles.manage"], system: false,
      createdAt: serverTimestamp(), createdBy: uid, updatedAt: serverTimestamp(), updatedBy: uid,
    };
    await assertSucceeds(setDoc(doc(valid, "roles/bootstrap-test"), role));
    await assertFails(setDoc(doc(wrongDomain, "roles/bootstrap-denied"), role));
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
    await assertSucceeds(
      updateDoc(doc(db, "users/user-1"), {
        displayName: "School User Updated",
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(doc(db, "users/user-1"), { role: "admin" }));
    await assertFails(getDoc(doc(db, "users/user-2")));
  });

  it("separates the readable user directory from private account data", async () => {
    const owner = environment.authenticatedContext("user-1", verified()).firestore();
    const colleague = environment.authenticatedContext("user-2", verified("colleague@kangoeroeschool.com")).firestore();
    const publicProfile = {
      uid: "user-1",
      displayName: "School User",
      photoURL: null,
      department: "ICT",
      jobTitle: "Support",
      accountType: "school-user",
      authProvider: "password",
      emailVerified: true,
      status: "active",
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(owner, "userDirectory/user-1"), publicProfile));
    await assertSucceeds(getDoc(doc(colleague, "userDirectory/user-1")));
    await assertFails(setDoc(doc(colleague, "userDirectory/user-1"), publicProfile));
    await assertFails(setDoc(doc(owner, "userDirectory/user-1"), { ...publicProfile, email: "private@kangoeroeschool.com" }));
    await assertFails(getDoc(doc(colleague, "users/user-1")));
  });

  it("denies schema pollution and invalid inventory quantities", async () => {
    const db = environment.authenticatedContext("user-1", verified(undefined, ["inventory.create", "inventory.edit"])).firestore();
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

describe("Firebase repository persistence and concurrency", () => {
  const uid = "repository-user";
  const claims = verified("repository@kangoeroeschool.com", [
    "assets.view", "assets.create", "inventory.view", "inventory.issue",
    "assignments.view", "borrows.view", "repairs.view", "maintenance.view",
    "movements.view", "audits.view", "disposals.view", "notifications.view",
    "reports.view", "admin.audit.read",
  ]);

  async function seedConcurrencyFixtures() {
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "codeGroups/devices"), {
        name: "Mobile devices", prefix: "KCSMD", minimumNumber: 1,
        maximumNumber: 5000, nextAvailableNumber: 1, isActive: true, sortOrder: 1,
        createdAt: serverTimestamp(), createdBy: uid, updatedAt: serverTimestamp(), updatedBy: uid,
      });
      await setDoc(doc(db, "inventoryItems/cables"), {
        code: "INV-1", name: "Cable", itemType: "Consumable", category: "Cables",
        unit: "piece", onHand: 10, reserved: 0, minimum: 1, reorderLevel: 2,
        reorderQuantity: 5, warehouse: "Main", location: "A1", createdBy: uid,
        createdAt: serverTimestamp(), modifiedBy: uid, lastUpdated: "2026-08-17T12:00:00.000Z",
        archived: false, updatedAt: serverTimestamp(), updatedBy: uid,
      });
    });
  }

  it("persists asset allocation across refresh and permits only one concurrent code claim", async () => {
    await seedConcurrencyFixtures();
    const db = environment.authenticatedContext(uid, claims).firestore();
    const access = async () => ({ permissions: claims.permissions, denials: [], active: true });
    const first = new FirebaseInventoryRepository(db, () => uid, access);
    const second = new FirebaseInventoryRepository(db, () => uid, access);
    await Promise.all([first.initialize(), second.initialize()]);
    const results = await Promise.all([
      first.execute({ action: "asset.create", values: { codePrefix: "KCSMD", name: "First", serialNumber: "SERIAL-1" } }),
      second.execute({ action: "asset.create", values: { codePrefix: "KCSMD", name: "Second", serialNumber: "SERIAL-2" } }),
    ]);
    expect(results.filter((result) => result.ok), JSON.stringify(results)).toHaveLength(1);
    const refreshed = new FirebaseInventoryRepository(db, () => uid, access);
    await refreshed.initialize();
    expect(refreshed.snapshot().assets).toHaveLength(1);
    expect(refreshed.snapshot().assets[0].code).toBe("KCSMD-01");
    expect(refreshed.snapshot().codeGroups[0].nextAvailableNumber).toBe(2);
    expect(refreshed.snapshot().activity.some((entry) => entry.action === "asset.create")).toBe(true);
    first.dispose(); second.dispose(); refreshed.dispose();
  });

  it("persists stock workflow records and rejects a stale concurrent issue", async () => {
    await seedConcurrencyFixtures();
    const db = environment.authenticatedContext(uid, claims).firestore();
    const access = async () => ({ permissions: claims.permissions, denials: [], active: true });
    const first = new FirebaseInventoryRepository(db, () => uid, access);
    const second = new FirebaseInventoryRepository(db, () => uid, access);
    await Promise.all([first.initialize(), second.initialize()]);
    const results = await Promise.all([
      first.execute({ action: "stock.issue", entityId: "cables", values: { quantity: 7 } }),
      second.execute({ action: "stock.issue", entityId: "cables", values: { quantity: 7 } }),
    ]);
    expect(results.filter((result) => result.ok), JSON.stringify(results)).toHaveLength(1);
    const refreshed = new FirebaseInventoryRepository(db, () => uid, access);
    await refreshed.initialize();
    expect(refreshed.snapshot().inventory[0].onHand).toBe(3);
    expect(refreshed.snapshot().inventoryMovements).toHaveLength(1);
    expect(refreshed.snapshot().activity.some((entry) => entry.action === "stock.issue")).toBe(true);
    first.dispose(); second.dispose(); refreshed.dispose();
  });
});
