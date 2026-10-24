import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const components = read("./components.css");
const list = read("./list.css");
const shell = read("./shell.css");
const turquoise = read("./turquoise-glass.css");
const globalSearch = read("../components/search/GlobalSearch.tsx");

describe("adaptive scroll navigation architecture", () => {
  it("uses one shell-level scroll state and a sticky topbar", () => {
    expect(shell).toContain('.authenticated-app>.topbar{position:sticky');
    expect(shell).toContain('[data-scroll-navigation="hidden"]>.topbar');
  });

  it("lets data pages expand without a fixed effective viewport height", () => {
    expect(components).toMatch(/\.page\.data-page\s*\{[^}]*min-height: calc\(100dvh - 116px\)[^}]*height: auto/s);
    expect(list).toMatch(/\.data-page\{width:100%;min-height:calc\(100dvh - 116px\);height:auto\}/);
    expect(list.lastIndexOf("height:auto")).toBeGreaterThan(list.lastIndexOf("height:calc(100vh - 75px)"));
  });

  it("keeps horizontal table overflow and sticky table labels", () => {
    expect(components).toMatch(/\.table-scroll\s*\{[^}]*overflow-x: auto[^}]*overflow-y: visible/s);
    expect(components).not.toContain("max-height: calc(100vh - 264px)");
    expect(shell).toContain('position:sticky;');
    expect(shell).toContain('top:var(--aims-table-header-offset)');
    expect(shell).toContain('--aims-table-header-offset:var(--aims-topbar-offset)');
    expect(components).toMatch(/\.migration-assets-table thead th\s*\{[^}]*position: static/s);
  });

  it("keeps settings navigation in natural flow", () => {
    expect(components).toMatch(/\.settings-nav\s*\{[^}]*position: static/s);
  });

  it("opens command search without moving the active page position", () => {
    expect(globalSearch).toContain("focus({ preventScroll: true })");
    expect(globalSearch).toContain("requestAnimationFrame(() => window.scrollTo(scrollX, scrollY))");
    expect(globalSearch).toContain('new Event("aims:reveal-navigation")');
    expect(shell).toMatch(/\.topbar-search \.global-search:focus-within\{position:relative/);
    expect(shell).toContain('transform:none');
    expect(globalSearch).not.toContain('--global-search-overlay-offset');
  });
});

describe("Premium Turquoise module panels", () => {
  it("uses the approved four-times-lighter semantic surface palette", () => {
    expect(turquoise).toContain("--color-surface: rgba(52, 116, 136, 0.9)");
    expect(turquoise).toContain("--color-surface-secondary: rgba(48, 108, 124, 0.86)");
    expect(turquoise).toContain("--color-surface-elevated: rgba(60, 132, 152, 0.94)");
    expect(turquoise).toContain("--color-sidebar-background: linear-gradient(180deg, rgba(7, 19, 23, 0.98)");
  });
});
