import { describe, expect, it } from "vitest";
import { authErrorMessage, validateRegistration } from "./firebaseAuth";

describe("registration validation", () => {
  it("requires a strong matching password and valid profile", () => {
    const errors = validateRegistration(
      { fullName: "", email: "bad", password: "weak" },
      "different",
    );
    expect(errors).toMatchObject({
      fullName: expect.any(String),
      email: expect.any(String),
      password: expect.any(String),
      confirmPassword: expect.any(String),
    });
  });
  it("normalizes policy independently from form display", () => {
    const errors = validateRegistration(
      {
        fullName: "AIMS User",
        email: "person@kangoeroeschool.com",
        password: "Strong123",
      },
      "Strong123",
    );
    expect(errors.email).toBeUndefined();
    expect(errors.password).toBeUndefined();
    expect(errors.confirmPassword).toBeUndefined();
  });
  it("rejects non-school registration before Firebase is called", () =>
    expect(
      validateRegistration(
        {
          fullName: "AIMS User",
          email: "person@gmail.com",
          password: "Strong123",
        },
        "Strong123",
      ).email,
    ).toContain("@kangoeroeschool.com"));
});

describe("Firebase failure messages", () => {
  it.each([
    ["auth/operation-not-allowed", "Anonymous Authentication is disabled"],
    ["auth/admin-restricted-operation", "Anonymous Authentication is disabled"],
    ["auth/unauthorized-domain", "localhost is not authorized"],
    ["auth/network-request-failed", "Unable to reach Firebase"],
    ["permission-denied", "Firebase blocked access"],
    ["auth/api-key-not-valid", "Firebase configuration is invalid"],
    ["auth/configuration-not-found", "not configured correctly"],
  ])("maps %s", (code, message) =>
    expect(authErrorMessage({ code })).toContain(message),
  );
});
