// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * End-to-end behavior of the sign-in/registration flows with Firebase mocked:
 * what is called, in which order, and what is NEVER called.
 */
const h = vi.hoisted(() => ({
  calls: [] as string[],
  user: { uid: "u1", email: "ann@kangoeroeschool.com", emailVerified: true, displayName: "Ann", photoURL: null, providerData: [{ providerId: "password" }] } as Record<string, unknown>,
  assignment: { exists: false, active: true },
  createError: null as unknown,
  popupUser: null as Record<string, unknown> | null,
  authEvent: { ok: true, status: "active", emailVerified: true } as { ok?: boolean; status: string; emailVerified?: boolean } | null,
  persistence: [] as unknown[],
  customParams: [] as unknown[],
}));
const log = (name: string) => h.calls.push(name);

vi.mock("firebase/auth", async (importOriginal) => {
  class GoogleAuthProvider {
    setCustomParameters(params: unknown) {
      h.customParams.push(params);
    }
  }
  return {
    ...(await importOriginal<typeof import("firebase/auth")>()),
    GoogleAuthProvider,
    browserLocalPersistence: "local",
    browserSessionPersistence: "session",
    setPersistence: async (_a: unknown, value: unknown) => {
      h.persistence.push(value);
    },
    createUserWithEmailAndPassword: async () => {
      log("createUser");
      if (h.createError) throw h.createError;
      return { user: h.user };
    },
    updateProfile: async () => log("updateProfile"),
    sendEmailVerification: async () => log("sendVerification"),
    signInWithEmailAndPassword: async () => {
      log("signIn");
      return { user: h.user };
    },
    signInWithPopup: async () => {
      log("popup");
      return { user: h.popupUser ?? h.user };
    },
    signOut: async () => log("signOut"),
  };
});
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  serverTimestamp: () => "TS",
  getDoc: async (ref: { path: string }) => {
    log(`get:${ref.path}`);
    if (ref.path.startsWith("accessAssignments/"))
      return { exists: () => h.assignment.exists, data: () => ({ active: h.assignment.active }) };
    return { exists: () => false, data: () => undefined };
  },
  setDoc: async (ref: { path: string }) => log(`set:${ref.path}`),
  updateDoc: async (ref: { path: string }) => log(`update:${ref.path}`),
}));
vi.mock("firebase/functions", () => ({ httpsCallable: () => async () => ({ data: { ok: true } }) }));
vi.mock("../lib/firebase", () => ({
  requireFirebase: () => ({ auth: {}, db: {} }),
  firebaseFunctions: null,
}));
vi.mock("./authEvents", () => ({
  reportAuthEvent: async (event: string) => {
    log(`event:${event}`);
    return h.authEvent;
  },
}));

import {
  AccountDisabledError,
  authErrorMessage,
  googleLogin,
  isAccessSuspended,
  login,
  register,
} from "./firebaseAuth";
import { AIMS_ACCESS_MESSAGE, AIMS_LOGIN_DOMAIN_MESSAGE, AIMS_REGISTRATION_DOMAIN_MESSAGE } from "./aimsEmailPolicy";

beforeEach(() => {
  h.calls.length = 0;
  h.persistence.length = 0;
  h.customParams.length = 0;
  h.assignment = { exists: false, active: true };
  h.createError = null;
  h.popupUser = null;
  h.authEvent = { ok: true, status: "active", emailVerified: true };
  h.user = { uid: "u1", email: "ann@kangoeroeschool.com", emailVerified: true, displayName: "Ann", photoURL: null, providerData: [{ providerId: "password" }] };
  localStorage.clear();
});

describe("email + password sign-in", () => {
  it("refuses a non-school address before Firebase is contacted", async () => {
    await expect(login("someone@gmail.com", "x", true)).rejects.toThrow(AIMS_LOGIN_DOMAIN_MESSAGE);
    expect(h.calls).toEqual([]);
  });

  it("honours 'remember me' with local vs. session persistence", async () => {
    await login("ann@kangoeroeschool.com", "pw", true);
    await login("ann@kangoeroeschool.com", "pw", false);
    expect(h.persistence).toEqual(["local", "session"]);
  });

  it("records a genuine login only after a verified, non-suspended sign-in", async () => {
    await login("ann@kangoeroeschool.com", "pw", true);
    const order = h.calls;
    expect(order[0]).toBe("signIn");
    expect(order).toContain("event:login");
    // The audited event comes before the directory is touched.
    expect(order.indexOf("event:login")).toBeLessThan(order.findIndex((c) => c.startsWith("update:userDirectory") || c.startsWith("set:userDirectory")));
  });

  it("does not provision or record anything for an unverified account", async () => {
    h.user.emailVerified = false;
    await login("ann@kangoeroeschool.com", "pw", true);
    expect(h.calls).toEqual(["signIn"]);
  });

  it("signs out and refuses a verified account whose address is outside the school domain", async () => {
    h.user.email = "ann@evil.example";
    await expect(login("ann@kangoeroeschool.com", "pw", true)).rejects.toThrow(AIMS_ACCESS_MESSAGE);
    expect(h.calls).toEqual(["signIn", "signOut"]);
  });
});

describe("suspended (disabled) accounts", () => {
  it("is refused from the account's own access assignment, even if the Cloud Function cannot be reached", async () => {
    h.assignment = { exists: true, active: false };
    h.authEvent = null; // function unreachable: must NOT fail open
    await expect(login("ann@kangoeroeschool.com", "pw", true)).rejects.toBeInstanceOf(AccountDisabledError);
    // Nothing was written for the account and no login was recorded.
    expect(h.calls.some((c) => c.startsWith("set:") || c.startsWith("update:"))).toBe(false);
    expect(h.calls).not.toContain("event:login");
  });

  it("is also refused when the server reports the account as disabled", async () => {
    h.authEvent = { status: "disabled" };
    await expect(login("ann@kangoeroeschool.com", "pw", true)).rejects.toBeInstanceOf(AccountDisabledError);
    expect(h.calls.some((c) => c.startsWith("set:userDirectory"))).toBe(false);
  });

  it("an active or missing assignment is not a suspension", async () => {
    expect(await isAccessSuspended("u1")).toBe(false);
    h.assignment = { exists: true, active: true };
    expect(await isAccessSuspended("u1")).toBe(false);
    h.assignment = { exists: true, active: false };
    expect(await isAccessSuspended("u1")).toBe(true);
  });

  it("the message for a disabled account is non-technical", () => {
    expect(authErrorMessage(new AccountDisabledError())).toMatch(/disabled/i);
  });
});

describe("registration", () => {
  const input = { fullName: "Ann Lee", email: "Ann@KangoeroeSchool.com", password: "Str0ng!Passw0rd", confirmPassword: "Str0ng!Passw0rd" };

  it("creates the account, sends verification and audits registration", async () => {
    await register(input);
    expect(h.calls.slice(0, 3)).toEqual(["createUser", "updateProfile", "sendVerification"]);
    expect(h.calls).toContain("event:registration");
  });

  it("a duplicate address creates nothing: no profile, no verification mail, no audit event", async () => {
    h.createError = Object.assign(new Error("exists"), { code: "auth/email-already-in-use" });
    await expect(register(input)).rejects.toMatchObject({ code: "auth/email-already-in-use" });
    expect(h.calls).toEqual(["createUser"]);
    expect(authErrorMessage(h.createError)).toBe("An account already exists for this email address. Sign in instead.");
  });

  it("rejects a non-school address before Firebase is called", async () => {
    await expect(register({ ...input, email: "ann@gmail.com" })).rejects.toThrow(AIMS_REGISTRATION_DOMAIN_MESSAGE);
    expect(h.calls).toEqual([]);
  });
});

describe("Google sign-in", () => {
  it("hints the school domain and records a real login for a verified school account", async () => {
    h.popupUser = { ...h.user, providerData: [{ providerId: "google.com" }] };
    await googleLogin(true);
    expect(h.customParams).toEqual([{ hd: "kangoeroeschool.com" }]);
    expect(h.calls).toContain("event:login");
    expect(h.persistence).toEqual(["local"]);
  });

  it("does not trust the 'hd' hint: a non-school Google account is signed out and refused", async () => {
    h.popupUser = { ...h.user, email: "ann@gmail.com", providerData: [{ providerId: "google.com" }] };
    await expect(googleLogin(true)).rejects.toThrow(AIMS_ACCESS_MESSAGE);
    expect(h.calls).toEqual(["popup", "signOut"]);
  });

  it("refuses an unverified Google account", async () => {
    h.popupUser = { ...h.user, emailVerified: false, providerData: [{ providerId: "google.com" }] };
    await expect(googleLogin(false)).rejects.toThrow(AIMS_ACCESS_MESSAGE);
    expect(h.calls).toEqual(["popup", "signOut"]);
  });

  it("a suspended Google account is refused before any profile is written", async () => {
    h.popupUser = { ...h.user, providerData: [{ providerId: "google.com" }] };
    h.assignment = { exists: true, active: false };
    await expect(googleLogin(true)).rejects.toBeInstanceOf(AccountDisabledError);
    expect(h.calls.some((c) => c.startsWith("set:") || c.startsWith("update:"))).toBe(false);
  });
});
