import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const components = read("./components.css");
const global = read("./global.css");
const assets = read("./assets.css");
const dashboard = read("../pages/Dashboard.tsx");

describe("unified workspace surface system", () => {
  it("uses the shared workspace and card tokens in the application shell", () => {
    expect(global).toContain("background:var(--workspace-background)");
    expect(components).toMatch(/\.app\s*\{[^}]*background: var\(--workspace-background\)/s);
    expect(components).toMatch(/\.main\s*\{[^}]*background: var\(--workspace-background\)/s);
    expect(components).toMatch(/\.card\s*\{[^}]*background: var\(--surface-card\)/s);
  });

  it("keeps text-only page descriptions on the workspace surface", () => {
    expect(components).toMatch(
      /\.page-title p\s*\{[^}]*background: transparent;[^}]*color: var\(--surface-text-secondary\)/s,
    );
  });

  it("does not force the ICT asset category menu to light-theme white", () => {
    expect(assets).toContain("background: var(--surface-elevated) !important");
    expect(assets).not.toContain("background: #ffffff !important");
  });

  it("uses the stable dashboard title without a personalized greeting", () => {
    expect(dashboard).toContain("<h1>Dashboard</h1>");
    expect(dashboard).not.toContain("Good morning");
    expect(dashboard).not.toContain("Goedemorgen");
  });
});
