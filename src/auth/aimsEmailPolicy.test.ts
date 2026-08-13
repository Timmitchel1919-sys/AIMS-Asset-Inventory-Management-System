import { describe, expect, it } from "vitest";
import {
  canFirebaseUserAccess,
  isAuthorizedAimsEmail,
  normalizeEmail,
} from "./aimsEmailPolicy";

describe("AIMS email authorization policy", () => {
  it.each([
    "user@kangoeroeschool.com",
    "USER@KANGOEROESCHOOL.COM",
    "  ict.support@kangoeroeschool.com  ",
  ])("allows exact school email %s", (email) =>
    expect(isAuthorizedAimsEmail(email)).toBe(true),
  );
  it.each([
    "user@gmail.com",
    "user@kangoeroeschool.co",
    "user@fakekangoeroeschool.com",
    "user@kangoeroeschool.com.example.org",
    "@kangoeroeschool.com",
    "",
  ])("rejects unauthorized email %s", (email) =>
    expect(isAuthorizedAimsEmail(email)).toBe(false),
  );
  it("normalizes casing and whitespace", () =>
    expect(normalizeEmail(" USER@KANGOEROESCHOOL.COM ")).toBe(
      "user@kangoeroeschool.com",
    ));
});

describe("anonymous route access policy", () => {
  it("allows anonymous Firebase users only in demo mode", () => {
    expect(
      canFirebaseUserAccess({ isAnonymous: true, email: null }, true),
    ).toBe(true);
    expect(
      canFirebaseUserAccess({ isAnonymous: true, email: null }, false),
    ).toBe(false);
  });
  it("keeps the production school-domain requirement", () => {
    expect(
      canFirebaseUserAccess(
        { isAnonymous: false, email: "user@kangoeroeschool.com" },
        false,
      ),
    ).toBe(true);
    expect(
      canFirebaseUserAccess(
        { isAnonymous: false, email: "user@example.com" },
        false,
      ),
    ).toBe(false);
  });
});
