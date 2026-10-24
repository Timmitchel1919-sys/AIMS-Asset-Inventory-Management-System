import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const tokens = read("./tokens.css");
const components = read("./components.css");
const shell = read("./shell.css");

describe("typography system", () => {
  it("defines the semantic type scale and role tokens", () => {
    for (const token of [
      "--text-xs",
      "--text-sm",
      "--text-md",
      "--text-base",
      "--text-lg",
      "--text-4xl",
      "--leading-normal",
      "--leading-relaxed",
      "--tracking-wider",
      "--font-mono",
    ]) {
      expect(tokens).toContain(token);
    }
  });

  it("ties the authenticated type scale to the user base size", () => {
    expect(shell).toMatch(
      /\.authenticated-app\{[^}]*--text-base:var\(--font-size-base\)/s,
    );
    expect(shell).toContain("--text-h1:clamp(28px");
  });

  it("uses tabular numerals for table data and KPI values", () => {
    expect(components).toMatch(/td\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s);
    expect(components).toMatch(
      /\.metric strong\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s,
    );
  });

  it("does not introduce text below 11px in shared component styles", () => {
    expect(components).not.toMatch(/font-size:\s*(?:[0-9]|10)px/);
  });

  it("keeps table headers associated with their semantic size token", () => {
    expect(components).toMatch(
      /th\s*\{[^}]*font-size:\s*var\(--text-xs\)[^}]*text-transform:\s*uppercase/s,
    );
  });
});
