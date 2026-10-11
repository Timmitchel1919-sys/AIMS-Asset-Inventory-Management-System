import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  AuthEventError,
  deriveAccountStatus,
  isSchoolEmail,
  recordAuthEvent,
  resetAuthEventDedupe,
} from "./authEvents.js";
import { FieldValue, makeFakeFirestore } from "./testUtils.mjs";

const school = (over = {}) => ({
  uid: "u1",
  email: "jane@kangoeroeschool.com",
  emailVerified: true,
  disabled: false,
  displayName: "Jane Doe",
  photoURL: null,
  providerData: [{ providerId: "password" }],
  ...over,
});
const asAuth = (uid = "u1", email = "jane@kangoeroeschool.com") => ({
  uid,
  token: { email },
});
const run = (db, authUser, auth, data, now) =>
  recordAuthEvent({
    db,
    authAdmin: { getUser: async () => authUser },
    FieldValue,
    auth,
    data,
    now,
  });
const docOf = async (db, c, id) => (await db.collection(c).doc(id).get()).data();
const logs = async (db) =>
  (await db.collection("activityLogs").get()).docs.map((d) => d.data());

beforeEach(() => resetAuthEventDedupe());

test("status: disabled beats pending beats active", () => {
  assert.equal(
    deriveAccountStatus({ authDisabled: true, emailVerified: false, assignmentActive: true }),
    "disabled",
  );
  assert.equal(
    deriveAccountStatus({ authDisabled: false, emailVerified: true, assignmentActive: false }),
    "disabled",
  );
  assert.equal(
    deriveAccountStatus({ authDisabled: false, emailVerified: false, assignmentActive: true }),
    "pending_verification",
  );
  assert.equal(
    deriveAccountStatus({ authDisabled: false, emailVerified: true, assignmentActive: true }),
    "active",
  );
});

test("only the exact school domain is a school email", () => {
  assert.ok(isSchoolEmail("A@KangoeroeSchool.com"));
  assert.ok(!isSchoolEmail("a@evilkangoeroeschool.com"));
  assert.ok(!isSchoolEmail("a@kangoeroeschool.com.evil.io"));
  assert.ok(!isSchoolEmail(""));
});

test("registration of an unverified account creates a PENDING directory entry and an audit record", async () => {
  const db = makeFakeFirestore();
  const r = await run(db, school({ emailVerified: false }), asAuth(), {
    event: "registration",
    profile: { department: "ICT", jobTitle: "Tech" },
  });
  assert.equal(r.status, "pending_verification");
  const dir = await docOf(db, "userDirectory", "u1");
  assert.equal(dir.status, "pending_verification");
  assert.equal(dir.emailVerified, false);
  assert.equal(dir.department, "ICT");
  assert.equal(dir.displayName, "Jane Doe");
  assert.equal(dir.lastLoginAt, undefined, "registration is not a sign-in");
  assert.equal((await logs(db))[0].event, "AUTH_REGISTRATION");
});

test("an unverified account cannot report a login or other privileged events", async () => {
  const db = makeFakeFirestore();
  for (const event of ["login", "logout", "email_verified", "password_changed"])
    await assert.rejects(
      run(db, school({ emailVerified: false }), asAuth(), { event }),
      (e) => e instanceof AuthEventError && e.code === "failed-precondition",
    );
  assert.equal((await logs(db)).length, 0);
});

test("a verified login sets lastLoginAt on the directory and the profile, server-side, and audits it", async () => {
  const db = makeFakeFirestore({ users: [{ id: "u1", uid: "u1" }] });
  const r = await run(db, school(), asAuth(), { event: "login" });
  assert.equal(r.status, "active");
  const dir = await docOf(db, "userDirectory", "u1");
  assert.ok(dir.lastLoginAt instanceof Date);
  assert.equal(dir.status, "active");
  assert.ok((await docOf(db, "users", "u1")).lastLoginAt instanceof Date);
  const [entry] = await logs(db);
  assert.equal(entry.event, "AUTH_LOGIN");
  assert.equal(entry.result, "Success");
  assert.match(entry.detail, /provider=password; status=active/);
});

test("a session sync does NOT bump lastLoginAt and is not audited", async () => {
  const db = makeFakeFirestore();
  await run(db, school(), asAuth(), { event: "session" });
  assert.equal((await docOf(db, "userDirectory", "u1")).lastLoginAt, undefined);
  assert.equal((await logs(db)).length, 0);
});

test("a disabled Firebase account is recorded as blocked and never gets a login time", async () => {
  const db = makeFakeFirestore();
  const r = await run(db, school({ disabled: true }), asAuth(), { event: "login" });
  assert.equal(r.status, "disabled");
  assert.equal((await docOf(db, "userDirectory", "u1")).lastLoginAt, undefined);
  const [entry] = await logs(db);
  assert.equal(entry.event, "AUTH_LOGIN_BLOCKED");
  assert.equal(entry.result, "Failure");
});

test("a suspended access assignment makes the account disabled", async () => {
  const db = makeFakeFirestore({ accessAssignments: [{ id: "u1", active: false }] });
  const r = await run(db, school(), asAuth(), { event: "login" });
  assert.equal(r.status, "disabled");
});

test("the client cannot choose its own status, verification or login time", async () => {
  const db = makeFakeFirestore();
  await run(db, school({ emailVerified: false }), asAuth(), {
    event: "registration",
    status: "active",
    emailVerified: true,
    lastLoginAt: "2001-01-01",
    profile: { department: "ICT" },
  });
  const dir = await docOf(db, "userDirectory", "u1");
  assert.equal(dir.status, "pending_verification");
  assert.equal(dir.emailVerified, false);
  assert.equal(dir.lastLoginAt, undefined);
});

test("identity fields are seeded once and not overwritten by later events", async () => {
  const db = makeFakeFirestore();
  await run(db, school(), asAuth(), { event: "login", profile: { department: "ICT" } });
  await db
    .collection("userDirectory")
    .doc("u1")
    .set({ displayName: "Renamed", department: "Finance" }, { merge: true });
  await run(
    db,
    school(),
    asAuth(),
    { event: "login", profile: { department: "Hacker" } },
    () => Date.now() + 10_000,
  );
  const dir = await docOf(db, "userDirectory", "u1");
  assert.equal(dir.displayName, "Renamed");
  assert.equal(dir.department, "Finance");
});

test("non-school, anonymous and unknown-event callers are refused", async () => {
  const db = makeFakeFirestore();
  await assert.rejects(
    run(db, school({ email: "x@gmail.com" }), asAuth("u1", "x@gmail.com"), { event: "login" }),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(run(db, school(), undefined, { event: "login" }), (e) => e.code === "unauthenticated");
  await assert.rejects(
    run(db, school(), asAuth(), { event: "make_me_admin" }),
    (e) => e.code === "invalid-argument",
  );
});

test("a token email on the school domain is not enough if Auth says otherwise", async () => {
  const db = makeFakeFirestore();
  await assert.rejects(
    run(db, school({ email: "jane@elsewhere.org" }), asAuth(), { event: "login" }),
    (e) => e.code === "permission-denied",
  );
});

test("repeat events within a few seconds are audited once", async () => {
  const db = makeFakeFirestore();
  const t = 1_000_000;
  await run(db, school(), asAuth(), { event: "login" }, () => t);
  await run(db, school(), asAuth(), { event: "login" }, () => t + 500);
  assert.equal((await logs(db)).length, 1);
  await run(db, school(), asAuth(), { event: "login" }, () => t + 5000);
  assert.equal((await logs(db)).length, 2);
});

test("audit entries never contain credentials", async () => {
  const db = makeFakeFirestore();
  await run(db, school(), asAuth(), { event: "password_changed", password: "Secret123", token: "abc" });
  const serialized = JSON.stringify(await logs(db));
  assert.ok(!/Secret123|abc/.test(serialized));
  assert.equal((await logs(db))[0].event, "AUTH_PASSWORD_CHANGED");
});
