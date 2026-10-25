import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const components = read("./components.css");
const list = read("./list.css");
const shell = read("./shell.css");
const midnight = read("./midnight-phase3b.css");
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

  it("keeps both table axes aligned in one bounded data viewport", () => {
    expect(components).toMatch(/\.table-scroll\s*\{[^}]*overflow-x: auto/s);
    expect(components).not.toContain("max-height: calc(100vh - 264px)");
    expect(shell).toContain('position:sticky;');
    expect(shell).toContain('top:var(--aims-table-header-offset)');
    expect(shell).toContain('--aims-table-header-offset:calc(var(--aims-topbar-offset) + var(--aims-page-header-offset) + var(--aims-toolbar-offset))');
    expect(shell).toMatch(/:is\(\.desktop-table,\.table-scroll,\.dm-table-wrap\)\{[^}]*max-height:calc\(100dvh - var\(--aims-table-header-offset\) - 16px\)[^}]*overflow-x:auto;[^}]*overflow-y:auto;/s);
    expect(shell).toMatch(/:is\(\.desktop-table,\.table-scroll,\.dm-table-wrap\) table>thead>tr>th\{[^}]*top:0;/s);
    expect(shell).toContain('margin-bottom:calc(-1 * var(--aims-data-toolbar-height))');
    expect(shell).toContain('.authenticated-app .page table>thead>tr>th{');
    expect(midnight).not.toMatch(/table thead th,[^{]+\{[^}]*top:\s*0/s);
  });

  it("preserves the approved ICT asset column-header bar", () => {
    expect(shell).toMatch(/position:sticky;[^}]*background:var\(--color-table-header\)/s);
    expect(components).toMatch(
      /\.data-table-assets \.desktop-table thead th\s*\{[^}]*height: 56px[^}]*background: var\(--color-table-header\)[^}]*text-transform: none/s,
    );
  });

  it("keeps Main location labels on one line", () => {
    expect(shell).toContain('[data-column-id="location"]');
    expect(shell).toContain('[data-column-id="mainLocation"]');
    expect(shell).toMatch(/data-column-id="main-location"[^}]*white-space:nowrap/s);
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
