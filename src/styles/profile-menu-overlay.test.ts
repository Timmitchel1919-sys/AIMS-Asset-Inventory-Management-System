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
    expect(shell).toContain('className="topbar app-topbar"');
    expect(shell).toContain("<GlobalSearch />");
    expect(shell).not.toContain('className="sidebar-profile"');
  });

  it("dims the complete module surface with the shared account scrim", () => {
    expect(styles).toMatch(
      /\.account-sheet-scrim[^}]+position:\s*fixed[^}]+inset:\s*0[^}]+background:\s*rgba\(5, 10, 20, 0\.35\)/s,
    );
  });

  it("anchors the account panel to the right side of the global top bar", () => {
    expect(styles).toMatch(
      /\.app-topbar \.topbar-profile-menu[^}]+position:\s*absolute[^}]+right:\s*0/s,
    );
    expect(styles).toContain("animation: topbar-profile-open 160ms ease-out both");
  });

  it("keeps the profile trigger on the far-right top-bar track", () => {
    expect(styles).toMatch(
      /\.authenticated-app > \.app-topbar[^}]+grid-template-columns:[^}]+/s,
    );
    expect(styles).toMatch(/\.app-topbar \.top-actions[^}]+justify-self:\s*end/s);
  });
});
