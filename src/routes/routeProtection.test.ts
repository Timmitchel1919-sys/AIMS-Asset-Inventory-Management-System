import { describe, expect, it } from "vitest";
import { routeManifest } from "./manifest";

/**
 * Route-protection contract. The router (App.tsx) enforces `public`,
 * `ownerOnly` and `permission`; these tests pin the manifest so a new route
 * cannot become public or lose its owner-only flag by accident. They are a
 * UI-gate check only — the real security boundary is Firestore Rules and the
 * Cloud Functions (see firestore.emulator.test.ts).
 */
describe("route protection manifest", () => {
  it("only the intended pages are reachable without signing in", () => {
    const publicPaths = routeManifest.filter((route) => route.public).map((route) => route.path).sort();
    expect(publicPaths).toEqual(
      [
        "/",
        "/login",
        "/signup",
        "/register",
        "/forgot-password",
        "/verify-email",
        "/access-denied",
        "/terms",
        "/privacy",
        "/support",
        "/download",
        "/q/:token",
      ].sort(),
    );
  });

  it("no protected application module is public", () => {
    for (const path of ["/dashboard", "/assets", "/inventory", "/users", "/assignments", "/reports", "/settings"])
      expect(
        routeManifest.find((route) => route.path === path)?.public,
        `${path} must not be public`,
      ).not.toBe(true);
  });

  it("every Device Management route is owner-only", () => {
    const device = routeManifest.filter((route) => /device/i.test(route.path));
    expect(device.length).toBeGreaterThanOrEqual(7);
    for (const route of device) expect(route.ownerOnly, route.path).toBe(true);
  });

  it("owner-only routes are never public or listed for a non-owner by accident", () => {
    for (const route of routeManifest.filter((route) => route.ownerOnly)) {
      expect(route.public, route.path).not.toBe(true);
    }
  });

  it("every protected data route declares a permission or is explicitly owner-only", () => {
    const allowedWithoutPermission = new Set([
      "/settings/*",
      "/profile",
      "/preferences",
      "/security",
      "/help",
      "/offline",
      "/403",
      "*",
    ]);
    const unguarded = routeManifest
      .filter((route) => !route.public && !route.ownerOnly && !route.permission)
      .map((route) => route.path)
      .filter((path) => !allowedWithoutPermission.has(path));
    expect(unguarded).toEqual([]);
  });
});
