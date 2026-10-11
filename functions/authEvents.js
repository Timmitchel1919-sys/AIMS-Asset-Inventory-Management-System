/**
 * Trusted authentication-event recorder (Layer 1: Authentication & User Management).
 *
 * The browser must not be the source of truth for facts other users rely on:
 * whether an account is verified or disabled, when it last signed in, and the
 * audit trail of sign-in/out. This module runs in the `recordAuthEvent`
 * callable with the Admin SDK and derives all of that from Firebase Auth and
 * the access assignment — never from client-supplied values. Firestore Rules
 * stop clients from writing those fields themselves (see firestore.rules).
 *
 * Nothing here stores a password, token or other secret; audit `detail` holds
 * only the sign-in provider and the derived account status.
 */

export const SCHOOL_DOMAIN = "kangoeroeschool.com";

export const AUTH_EVENTS = Object.freeze([
  "registration",
  "login",
  "logout",
  "email_verified",
  "password_changed",
  "session",
]);

/** Events a not-yet-verified account may report (it can only appear as "pending verification"). */
const UNVERIFIED_ALLOWED = new Set(["registration", "session"]);

/** Events that produce an audit entry. "session" is a silent directory sync. */
const AUDITED = {
  registration: { action: "User registered", event: "AUTH_REGISTRATION" },
  login: { action: "User signed in", event: "AUTH_LOGIN" },
  logout: { action: "User signed out", event: "AUTH_LOGOUT" },
  email_verified: { action: "Email address verified", event: "AUTH_EMAIL_VERIFIED" },
  password_changed: { action: "Password changed", event: "AUTH_PASSWORD_CHANGED" },
};

export class AuthEventError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AuthEventError";
    this.code = code; // maps onto HttpsError codes in index.js
  }
}

/**
 * Account state (not presence): Disabled wins over everything, then an
 * unverified email is Pending verification, otherwise Active.
 */
export function deriveAccountStatus({ authDisabled, emailVerified, assignmentActive }) {
  if (authDisabled === true || assignmentActive === false) return "disabled";
  if (emailVerified !== true) return "pending_verification";
  return "active";
}

export function isSchoolEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return at > 0 && normalized.slice(at + 1) === SCHOOL_DOMAIN;
}

function providerOf(authUser) {
  const providers = (authUser?.providerData || []).map((p) => p.providerId);
  return providers.includes("google.com") ? "google" : "password";
}

const text = (value, max) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
};

// Same-instance de-duplication so a retry/double-click cannot flood the audit log.
const recent = new Map();
const DEDUPE_MS = 3000;

export function resetAuthEventDedupe() {
  recent.clear();
}

/**
 * @param {object} deps
 * @param {{ collection: Function }} deps.db            Firestore Admin (or compatible fake)
 * @param {{ getUser: (uid: string) => Promise<object> }} deps.authAdmin
 * @param {{ serverTimestamp: () => unknown }} deps.FieldValue
 * @param {{ uid?: string, token?: { email?: string } } | undefined} deps.auth  callable request.auth
 * @param {{ event?: string, profile?: { department?: string, jobTitle?: string } }} deps.data
 * @param {() => number} [deps.now]
 */
export async function recordAuthEvent({ db, authAdmin, FieldValue, auth, data, now = Date.now }) {
  const uid = String(auth?.uid || "");
  if (!uid) throw new AuthEventError("unauthenticated", "Sign in first.");
  const tokenEmail = String(auth?.token?.email || "").trim().toLowerCase();
  if (!isSchoolEmail(tokenEmail))
    throw new AuthEventError("permission-denied", "A school account is required.");
  const event = String(data?.event || "");
  if (!AUTH_EVENTS.includes(event))
    throw new AuthEventError("invalid-argument", "Unknown authentication event.");

  // Authoritative facts come from Firebase Auth, never from the request.
  const authUser = await authAdmin.getUser(uid);
  const email = String(authUser.email || tokenEmail).trim().toLowerCase();
  if (!isSchoolEmail(email))
    throw new AuthEventError("permission-denied", "A school account is required.");
  const emailVerified = authUser.emailVerified === true;
  if (!emailVerified && !UNVERIFIED_ALLOWED.has(event))
    throw new AuthEventError("failed-precondition", "Verify your email address first.");

  const assignment = await db.collection("accessAssignments").doc(uid).get();
  const assignmentActive = !assignment.exists || assignment.data()?.active !== false;
  const status = deriveAccountStatus({
    authDisabled: authUser.disabled === true,
    emailVerified,
    assignmentActive,
  });
  const provider = providerOf(authUser);
  const stamp = FieldValue.serverTimestamp();

  // ---- Public directory (Users module) ----
  const directoryRef = db.collection("userDirectory").doc(uid);
  const directory = await directoryRef.get();
  const isLogin = event === "login" && status === "active";
  const patch = {
    uid,
    accountType: "school-user",
    authProvider: provider,
    emailVerified,
    status,
    updatedAt: stamp,
    ...(isLogin ? { lastLoginAt: stamp } : {}),
  };
  if (!directory.exists) {
    // First time this account is seen: seed the identity fields once. After
    // that the user owns them (name/department/job title/photo) via the app.
    Object.assign(patch, {
      displayName:
        text(authUser.displayName, 100) || email.split("@")[0] || "AIMS user",
      photoURL: text(authUser.photoURL, 2048),
      department: text(data?.profile?.department, 100),
      jobTitle: text(data?.profile?.jobTitle, 100),
    });
  }
  await directoryRef.set(patch, { merge: true });

  // ---- Own profile document: only the server-owned timestamp ----
  if (isLogin) {
    const userRef = db.collection("users").doc(uid);
    const user = await userRef.get();
    if (user.exists)
      await userRef.set(
        { lastLoginAt: stamp, authProvider: provider, emailVerified, updatedAt: stamp },
        { merge: true },
      );
  }

  // ---- Audit trail ----
  const audited = AUDITED[event];
  let audit = false;
  if (audited) {
    const key = `${uid}:${event}`;
    const t = now();
    const last = recent.get(key);
    if (last === undefined || t - last >= DEDUPE_MS) {
      recent.set(key, t);
      // A sign-in that the server refuses (disabled account) is recorded as a failure.
      const refused = event === "login" && status !== "active";
      await db.collection("activityLogs").add({
        at: new Date(t).toISOString(),
        user: email,
        action: refused ? "Sign-in blocked" : audited.action,
        event: refused ? "AUTH_LOGIN_BLOCKED" : audited.event,
        entityType: "User",
        entityId: uid,
        result: refused ? "Failure" : "Success",
        detail: `provider=${provider}; status=${status}`,
        createdAt: stamp,
        createdBy: uid,
        updatedAt: stamp,
        updatedBy: uid,
      });
      audit = true;
    }
  }
  return { ok: true, status, emailVerified, audited: audit };
}
