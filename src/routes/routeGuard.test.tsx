// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Direct-URL behavior of the real route guard (App.tsx) with a tiny manifest:
 * what a visitor can reach in every authentication state.
 */
const ctx = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));

vi.mock("../context/AppContext", () => ({
  useApp: () => ({ setThemeRoute: () => undefined, ...ctx.state }),
}));
vi.mock("../components/shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));
vi.mock("../components/auth/AuthErrorBanner", () => ({ AuthErrorBanner: () => null }));
vi.mock("../auth/aimsEmailPolicy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auth/aimsEmailPolicy")>()),
  DEMO_AUTH_MODE: false,
}));
vi.mock("./manifest", async () => {
  const lazyPage = (label: string) => {
    const Component = () => <div>{label}</div>;
    return Component;
  };
  const route = (id: string, path: string, extra: Record<string, unknown> = {}) => ({
    id,
    path,
    component: lazyPage(`page:${id}`),
    titleKey: id,
    navigation: false,
    breadcrumb: [],
    mobile: true,
    lazy: true,
    status: "implemented",
    ...extra,
  });
  return {
    routeManifest: [
      route("home", "/", { public: true }),
      route("login", "/login", { public: true }),
      route("signup", "/signup", { public: true }),
      route("verify-email", "/verify-email", { public: true }),
      route("access-denied", "/access-denied", { public: true }),
      route("dashboard", "/dashboard", { permission: "dashboard.view" }),
      route("users", "/users", { permission: "admin.users.manage" }),
      route("device-management", "/device-management", { ownerOnly: true }),
      route("forbidden", "/403", { public: true }),
    ],
  };
});
vi.mock("../auth/permissions", () => ({
  // Mirrors the real policy: every defined role may open every non-owner page.
  can: (role: string | undefined, permission?: string) => !permission || !!role,
}));

import App from "../App";

const signedOut = { user: null, authLoading: false, emailVerified: false, accessDenied: false, sessionExpired: false };
const member = { id: "u1", name: "Ann", email: "ann@kangoeroeschool.com", role: "warehouse-staff" };
const owner = { ...member, role: "owner" };
const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

beforeEach(() => {
  ctx.state = { ...signedOut };
});
afterEach(cleanup);

describe("while the session is being resolved", () => {
  it("shows no protected content and no redirect flash", () => {
    ctx.state = { ...signedOut, authLoading: true };
    at("/dashboard");
    expect(screen.queryByText("page:dashboard")).toBeNull();
    expect(screen.queryByText("page:login")).toBeNull();
    expect(screen.queryByTestId("shell")).toBeNull();
  });
});

describe("signed-out visitor", () => {
  it.each(["/dashboard", "/users", "/device-management"])("is sent to the login page from %s", (path) => {
    at(path);
    expect(screen.getByText("page:login")).toBeInTheDocument();
    expect(screen.queryByTestId("shell")).toBeNull();
  });
  it.each(["/", "/login", "/signup"])("may open the public page %s", (path) => {
    at(path);
    expect(screen.getByText(`page:${path === "/" ? "home" : path.slice(1)}`)).toBeInTheDocument();
  });
  it("cannot open the verification screen", () => {
    at("/verify-email");
    expect(screen.getByText("page:login")).toBeInTheDocument();
  });
});

describe("signed in but not yet verified", () => {
  beforeEach(() => {
    ctx.state = { ...signedOut, user: member, emailVerified: false };
  });
  it.each(["/dashboard", "/users", "/device-management"])("is held on the verification screen for %s", (path) => {
    at(path);
    expect(screen.getByText("page:verify-email")).toBeInTheDocument();
    expect(screen.queryByTestId("shell")).toBeNull();
  });
  it("is sent to verification instead of the login page when opening /login", () => {
    at("/login");
    expect(screen.getByText("page:verify-email")).toBeInTheDocument();
  });
});

describe("verified user", () => {
  it("reaches protected pages inside the shell and is bounced away from login/signup", () => {
    ctx.state = { ...signedOut, user: member, emailVerified: true };
    at("/dashboard");
    expect(screen.getByTestId("shell")).toContainElement(screen.getByText("page:dashboard"));
    cleanup();
    at("/login");
    expect(screen.getByText("page:dashboard")).toBeInTheDocument();
    cleanup();
    at("/signup");
    expect(screen.getByText("page:dashboard")).toBeInTheDocument();
  });

  it("a non-owner who types the Device Management URL never gets the page", () => {
    ctx.state = { ...signedOut, user: member, emailVerified: true };
    at("/device-management");
    expect(screen.queryByText("page:device-management")).toBeNull();
    expect(screen.getByText("Access restricted")).toBeInTheDocument();
  });

  it("an administrator is not the owner: owner-only still refuses them", () => {
    ctx.state = { ...signedOut, user: { ...member, role: "administrator" }, emailVerified: true };
    at("/device-management");
    expect(screen.queryByText("page:device-management")).toBeNull();
  });

  it("the verified owner reaches Device Management", () => {
    ctx.state = { ...signedOut, user: owner, emailVerified: true };
    at("/device-management");
    expect(screen.getByText("page:device-management")).toBeInTheDocument();
  });
});

describe("blocked account", () => {
  it("is always sent to the access-denied page, never into the application", () => {
    ctx.state = { ...signedOut, user: member, emailVerified: true, accessDenied: true };
    at("/dashboard");
    expect(screen.getByText("page:access-denied")).toBeInTheDocument();
    expect(screen.queryByText("page:dashboard")).toBeNull();
  });
});
