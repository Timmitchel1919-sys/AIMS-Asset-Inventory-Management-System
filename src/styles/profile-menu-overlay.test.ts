import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("profile menu focus treatment", () => {
  const shell = readFileSync(
    resolve(process.cwd(), "src/components/shell.tsx"),
    "utf8",
  );
  const styles = readFileSync(
    resolve(process.cwd(), "src/styles/shell.css"),
    "utf8",
  );

  it("exposes the account-menu state on the application shell", () => {
    expect(shell).toContain('data-profile-menu-open={profileOpen ? "true" : "false"}');
    expect(shell).not.toContain("sidebar-profile__role");
  });

  it("dims the complete module surface with the shared account scrim", () => {
    expect(styles).toMatch(
      /\.account-sheet-scrim[^}]+position:\s*fixed[^}]+inset:\s*0[^}]+background:\s*rgba\(5, 10, 20, 0\.35\)/s,
    );
  });

  it("renders the account panel outside the transformed sidebar", () => {
    expect(shell).toMatch(/<\/aside>\s*\{profileOpen && \(/s);
    expect(shell).toContain('className="profile-menu app-profile-menu"');
    expect(styles).toMatch(
      /\.authenticated-app > \.app-profile-menu[^}]+position:\s*fixed[^}]+z-index:\s*61/s,
    );
    expect(styles).toContain("animation: account-menu-open 160ms ease-out both");
  });

  it("provides an account trigger in the mobile bottom navigation", () => {
    expect(shell).toContain('className="bottom-nav__profile"');
    expect(shell).toContain('app.setMobileOpen(false);');
  });

  it("uses the active module highlight for profile hover and keyboard focus", () => {
    expect(styles).toMatch(
      /\.app-sidebar \.sidebar-profile:hover,[^}]+\.app-sidebar \.sidebar-profile:focus-visible[^}]+background:\s*var\(--color-sidebar-active-background, var\(--color-sidebar-active\)\)[^}]+color:\s*var\(--color-sidebar-active-text\)/s,
    );
  });
});
