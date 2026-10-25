import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "dashboard-bento.css"), "utf8");

describe("dashboard-bento.css isolation", () => {
  it("every selector in the stylesheet is scoped to Midnight/Dark or the theme gate", () => {
    const rules = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .map((chunk) => chunk.split("{")[0].trim())
      .filter(Boolean);

    const ALLOWED_UNSCOPED = new Set([
      ".bento-theme-gate",
      ".bento-theme-gate h2",
      ".bento-theme-gate p",
    ]);

    for (const raw of rules) {
      // Each rule may contain multiple selectors separated by commas.
      for (const selector of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (selector.startsWith("@")) continue; // at-rules

        // Allow explicit gate selectors used in the theme-gate screen only.
        if (ALLOWED_UNSCOPED.has(selector)) continue;

        expect(
          selector.startsWith('html[data-theme="dark"]'),
          `Unscoped selector detected: "${selector}" — must live under html[data-theme="dark"]`,
        ).toBe(true);
      }
    }
  });

  it("does not redefine any shared --color-* token", () => {
    // Shared global tokens must not be overwritten by this preview stylesheet.
    const forbidden = /--color-[a-z-]+\s*:/i;
    const lines = css.split("\n");
    const violations: string[] = [];
    for (const line of lines) {
      const m = line.match(forbidden);
      if (m) violations.push(line.trim());
    }
    expect(violations).toEqual([]);
  });
});
