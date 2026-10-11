// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendPasswordResetEmail = vi.fn();
vi.mock("firebase/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/auth")>()),
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
}));
vi.mock("../lib/firebase", () => ({
  requireFirebase: () => ({ auth: {}, db: {} }),
  firebaseFunctions: null,
}));

import {
  AccountDisabledError,
  AIMS_DISABLED_MESSAGE,
  authErrorMessage,
  forgotPassword,
  localizeAuthMessage,
  validateRegistration,
} from "./firebaseAuth";

const setLanguage = (language: "en" | "nl") => localStorage.setItem("kcs-language", language);

beforeEach(() => {
  localStorage.clear();
  sendPasswordResetEmail.mockReset();
});
afterEach(() => localStorage.clear());

describe("sign-in errors do not enable account enumeration", () => {
  it.each(["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"])(
    "%s gives one generic message",
    (code) => {
      expect(authErrorMessage({ code })).toBe("Unable to sign in with the provided credentials.");
    },
  );
  it("never leaks a raw Firebase error object or code to the user", () => {
    const message = authErrorMessage(
      Object.assign(new Error("Firebase: Error (auth/some-internal-thing)."), { code: "auth/some-internal-thing" }),
    );
    expect(message).toBe("We could not complete that request. Please try again.");
    expect(message).not.toMatch(/auth\/|Firebase:/);
  });
  it("a disabled account says so without any technical detail", () => {
    expect(authErrorMessage({ code: "auth/user-disabled" })).toBe("This account has been disabled.");
    expect(authErrorMessage(new AccountDisabledError())).toBe(AIMS_DISABLED_MESSAGE);
  });
  it("maps popup, weak-password and expired-link failures", () => {
    expect(authErrorMessage({ code: "auth/popup-blocked" })).toMatch(/pop-ups/);
    expect(authErrorMessage({ code: "auth/cancelled-popup-request" })).toMatch(/cancelled/);
    expect(authErrorMessage({ code: "auth/weak-password" })).toMatch(/too weak/);
    expect(authErrorMessage({ code: "auth/expired-action-code" })).toMatch(/expired/);
  });
});

describe("authentication messages follow the AIMS language", () => {
  it("is English by default and Dutch when the preference is nl", () => {
    expect(authErrorMessage({ code: "auth/too-many-requests" })).toMatch(/Too many attempts/);
    setLanguage("nl");
    expect(authErrorMessage({ code: "auth/too-many-requests" })).toMatch(/Te veel pogingen/);
    expect(authErrorMessage({ code: "auth/invalid-credential" })).toMatch(/Inloggen is niet gelukt/);
    expect(authErrorMessage(new AccountDisabledError())).toMatch(/uitgeschakeld/);
  });
  it("registration validation messages are localized too", () => {
    setLanguage("nl");
    const errors = validateRegistration({ fullName: "", email: "x@gmail.com", password: "weak" }, "other");
    expect(errors.fullName).toBe("Vul uw volledige naam in.");
    expect(errors.email).toMatch(/@kangoeroeschool\.com/);
    expect(errors.password).toMatch(/hoofdletter/);
    expect(errors.confirmPassword).toMatch(/komen niet overeen/);
  });
  it("unknown messages pass through unchanged", () => {
    setLanguage("nl");
    expect(localizeAuthMessage("something else")).toBe("something else");
  });
  it("every Dutch translation key is an English message used by the app", () => {
    setLanguage("nl");
    for (const english of [
      "Full name is required.",
      "Passwords do not match.",
      "This account has been disabled.",
      "The current password is not correct.",
    ])
      expect(localizeAuthMessage(english)).not.toBe(english);
  });
});

describe("password reset", () => {
  it("looks identical for an unknown address (no account enumeration)", async () => {
    sendPasswordResetEmail.mockRejectedValue({ code: "auth/user-not-found" });
    await expect(forgotPassword("nobody@kangoeroeschool.com")).resolves.toBeUndefined();
  });
  it("normalizes the address before sending", async () => {
    sendPasswordResetEmail.mockResolvedValue(undefined);
    await forgotPassword("  Person@KangoeroeSchool.com ");
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({}, "person@kangoeroeschool.com");
  });
  it("still reports real faults such as network failure", async () => {
    sendPasswordResetEmail.mockRejectedValue({ code: "auth/network-request-failed" });
    await expect(forgotPassword("a@kangoeroeschool.com")).rejects.toMatchObject({ code: "auth/network-request-failed" });
  });
});
