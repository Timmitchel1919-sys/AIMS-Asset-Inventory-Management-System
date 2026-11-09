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
    expect(shell).toMatch(/<\/aside>\s*<header className="topbar app-topbar">[\s\S]+\{profileOpen && \(/);
    expect(shell).toContain('className="profile-menu app-profile-menu"');
    expect(styles).toMatch(
      /\.authenticated-app > \.app-profile-menu[^}]+position:\s*fixed[^}]+z-index:\s*61/s,
    );
    expect(styles).toContain("animation: account-menu-open 160ms ease-out both");
  });

  it("provides the account trigger in the global topbar", () => {
    expect(shell).toContain('className="topbar-profile"');
    expect(shell).not.toContain('className="bottom-nav__profile"');
    expect(shell).not.toContain('className="sidebar-profile"');
  });

  it("gives the topbar profile control visible hover and keyboard focus", () => {
    expect(styles).toMatch(
      /\.topbar-profile:hover,[^}]+\.topbar-profile:focus-visible[^}]+background:\s*var\(--color-surface-hover\)/s,
    );
  });
});
