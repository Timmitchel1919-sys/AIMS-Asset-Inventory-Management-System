import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MASTER_DATA_DELETE_EMAILS,
  archiveMasterData,
  canDeleteMasterData,
  checkDependencies,
} from "./masterData.js";

const TS = "SERVER_TS";
let seq = 0;

/** Minimal Admin-SDK-shaped fake: equality queries (dotted paths), batch update/delete/set. */
function fakeDb(seed = {}) {
  const store = new Map(Object.entries(seed).map(([c, docs]) => [c, new Map(docs.map((d) => [d.id, { ...d }]))]));
  const coll = (n) => (store.has(n) ? store.get(n) : store.set(n, new Map()).get(n));
  const read = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const ref = (c, id) => ({
    __c: c,
    id,
    async get() {
      const d = coll(c).get(id);
      return { exists: d !== undefined, id, data: () => (d ? { ...d } : undefined) };
    },
  });
  return {
    collection: (c) => ({
      doc: (id) => ref(c, id ?? `gen-${++seq}`),
      where: (f, _op, v) => ({
        limit: (n) => ({
          async get() {
            const docs = [...coll(c).entries()].filter(([, d]) => read(d, f) === v).slice(0, n);
            return { docs: docs.map(([id, d]) => ({ id, data: () => ({ ...d }) })) };
          },
        }),
      }),
    }),
    batch() {
      const jobs = [];
      return {
        update: (r, data) => jobs.push(() => coll(r.__c).set(r.id, { ...coll(r.__c).get(r.id), ...data })),
        delete: (r) => jobs.push(() => coll(r.__c).delete(r.id)),
        set: (r, data) => jobs.push(() => coll(r.__c).set(r.id, { ...data })),
        async commit() {
          jobs.forEach((j) => j());
        },
      };
    },
    dump: (c) => Object.fromEntries([...coll(c).entries()]),
  };
}

const admin = { uid: "u1", email: "Manager-ICT@kangoeroeschool.com" };
const regular = { uid: "u2", email: "someone@kangoeroeschool.com" };
const run = (db, actor, args) => archiveMasterData(db, actor, args, TS);
const rejects = (promise, code) =>
  assert.rejects(promise, (e) => {
    assert.equal(e.code, code, e.message);
    return true;
  });

test("the deletion policy list equals the client list", () => {
  const client = readFileSync(new URL("../src/auth/masterDataDeletion.ts", import.meta.url), "utf8");
  const clientEmails = [...client.matchAll(/"([a-z-]+@kangoeroeschool\.com)"/g)].map((m) => m[1]);
  assert.deepEqual([...MASTER_DATA_DELETE_EMAILS].sort(), clientEmails.sort());
  assert.equal(canDeleteMasterData(" ALIENDAS@kangoeroeschool.com "), true);
  assert.equal(canDeleteMasterData("aliendas@kangoeroeschool.com.evil.io"), false);
  assert.equal(canDeleteMasterData(undefined), false);
});

test("an unauthorized account cannot archive or delete, even an unused record", async () => {
  const db = fakeDb({ codeGroups: [{ id: "g1", name: "Laptops", prefix: "KCSL" }] });
  await rejects(run(db, regular, { kind: "codeGroup", id: "g1", mode: "archive", reason: "cleanup" }), "permission-denied");
  assert.equal(db.dump("codeGroups").g1.archived, undefined);
});

test("a code group used by assets (by id or by legacy prefix) is blocked and reports why", async () => {
  const db = fakeDb({
    codeGroups: [{ id: "g1", name: "Laptops", prefix: "KCSL" }],
    assets: [{ id: "a1", code: "KCSL-001", codePrefix: "KCSL", status: "Disposed" }],
  });
  await assert.rejects(run(db, admin, { kind: "codeGroup", id: "g1", mode: "archive", reason: "cleanup" }), (e) => {
    assert.equal(e.code, "failed-precondition");
    assert.match(e.message, /KCSL-001/);
    assert.equal(e.details.dependencies[0].type, "assets");
    return true;
  });
  // A disposed asset still blocks: historical Inv.codes are permanent.
  assert.equal(db.dump("codeGroups").g1.archived, undefined);
});

test("an unused code group is archived with an audit entry; delete requires prior archive", async () => {
  const db = fakeDb({ codeGroups: [{ id: "g1", name: "Boards", prefix: "KCSDB" }] });
  await rejects(run(db, admin, { kind: "codeGroup", id: "g1", mode: "delete" }), "failed-precondition");
  await rejects(run(db, admin, { kind: "codeGroup", id: "g1", mode: "archive", reason: "x" }), "invalid-argument");
  const out = await run(db, admin, { kind: "codeGroup", id: "g1", mode: "archive", reason: "obsolete group" });
  assert.equal(out.ok, true);
  const g = db.dump("codeGroups").g1;
  assert.deepEqual([g.archived, g.isActive, g.deletionReason, g.archivedBy], [true, false, "obsolete group", "u1"]);
  const log = Object.values(db.dump("activityLogs"))[0];
  assert.equal(log.event, "CODEGROUP_ARCHIVED");
  assert.equal(log.result, "Success");
  await rejects(run(db, admin, { kind: "codeGroup", id: "g1", mode: "archive", reason: "again" }), "failed-precondition");
  await run(db, admin, { kind: "codeGroup", id: "g1", mode: "delete" });
  assert.equal(db.dump("codeGroups").g1, undefined);
});

test("a Hoofdlocatie with active assets, departments or sub-locations is blocked; inactive assets only block permanent delete", async () => {
  const seed = (extra = {}) =>
    fakeDb({
      locations: [{ id: "m1", name: "Warehouse", type: "Main location", status: "Active" }],
      ...extra,
    });
  for (const [label, extra, expect] of [
    ["asset", { assets: [{ id: "a1", code: "X-1", mainLocationId: "m1", status: "Available" }] }, "assets"],
    ["asset by current location", { assets: [{ id: "a1", code: "X-1", currentLocationId: "m1", status: "Assigned" }] }, "assets"],
    ["department", { departments: [{ id: "d1", name: "ICT", mainLocationId: "m1", status: "Active" }] }, "departments"],
    ["sub-location", { locations: [{ id: "m1", name: "Warehouse", type: "Main location", status: "Active" }, { id: "s1", name: "Shelf", type: "Shelf", mainLocationId: "m1", status: "Active" }] }, "locations"],
  ]) {
    const db = seed(extra);
    await assert.rejects(run(db, admin, { kind: "mainLocation", id: "m1", mode: "archive", reason: "cleanup" }), (e) => {
      assert.equal(e.code, "failed-precondition", label);
      assert.equal(e.details.dependencies[0].type, expect, label);
      return true;
    });
    assert.equal(db.dump("locations").m1.status, "Active", label);
  }
  // A disposed asset does not block archiving, but does block permanent deletion.
  const db = seed({ assets: [{ id: "a1", code: "X-1", mainLocationId: "m1", status: "Disposed" }] });
  await run(db, admin, { kind: "mainLocation", id: "m1", mode: "archive", reason: "closed down" });
  assert.equal(db.dump("locations").m1.status, "Archived");
  await rejects(run(db, admin, { kind: "mainLocation", id: "m1", mode: "delete" }), "failed-precondition");
});

test("only Hoofdlocaties are handled, and missing or unknown records are rejected", async () => {
  const db = fakeDb({ locations: [{ id: "s1", name: "Shelf", type: "Shelf", status: "Active" }] });
  await rejects(run(db, admin, { kind: "mainLocation", id: "s1", mode: "archive", reason: "xxx" }), "invalid-argument");
  await rejects(run(db, admin, { kind: "mainLocation", id: "nope", mode: "archive", reason: "xxx" }), "not-found");
  await rejects(run(db, admin, { kind: "category", id: "c1", mode: "archive", reason: "xxx" }), "invalid-argument");
  await rejects(run(db, admin, { kind: "codeGroup", id: "g", mode: "wipe", reason: "xxx" }), "invalid-argument");
});

test("dependency report covers categories and asset types for any caller, read-only", async () => {
  const db = fakeDb({
    categories: [
      { id: "c1", name: "Laptops", status: "Active" },
      { id: "c2", name: "Chromebooks", status: "Active", details: { categoryId: "c1" } },
    ],
    assets: [
      { id: "a1", code: "KCSL-001", category: "Laptops", status: "Available" },
      { id: "a2", code: "KCSL-002", categoryId: "c1", status: "Available" },
      { id: "a3", code: "KCSL-003", assetTypeId: "bulk", status: "Disposed" },
    ],
    assetTypes: [{ id: "bulk", name: "Bulk", behavior: "BULK" }],
  });
  const category = await checkDependencies(db, { kind: "category", id: "c1" });
  assert.equal(category.blocked, true);
  assert.deepEqual(category.dependencies.map((d) => [d.type, d.count]).sort(), [["assets", 2], ["categories", 1]]);
  // Active-asset view ignores the disposed one; the permanent view counts it.
  assert.equal((await checkDependencies(db, { kind: "assetType", id: "bulk" })).blocked, false);
  assert.equal((await checkDependencies(db, { kind: "assetType", id: "bulk", includeInactive: true })).blocked, true);
  assert.equal(JSON.stringify(db.dump("categories")).includes("Archived"), false); // nothing was written
});
