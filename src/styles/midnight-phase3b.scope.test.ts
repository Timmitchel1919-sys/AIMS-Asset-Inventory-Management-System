import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "midnight-phase3b.css"), "utf8");

describe("midnight-phase3b.css — strict theme isolation", () => {
  it("every rule selector is scoped under html[data-theme=\"dark\"]", () => {
    const rules = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .map((chunk) => chunk.split("{")[0].trim())
      .filter(Boolean);

    for (const raw of rules) {
      for (const selector of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (selector.startsWith("@")) continue; // at-rules
        if (selector.startsWith("0%") || selector.startsWith("100%") || selector === "to" || selector === "from") continue; // keyframe steps
        expect(
          selector.startsWith('html[data-theme="dark"]'),
          `Unscoped selector detected: "${selector}" — must live under html[data-theme="dark"]`,
        ).toBe(true);
      }
    }
  });

  it("defines no shared --color-* variables (uses --midnight-* instead)", () => {
    const forbidden = /--color-[a-z-]+\s*:/i;
    const violations = css
      .split("\n")
      .filter((line) => forbidden.test(line) && !line.trim().startsWith("/*"));
    expect(violations).toEqual([]);
  });

  it("does not touch globals (:root / html bare / body bare)", () => {
    const rules = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .map((chunk) => chunk.split("{")[0].trim())
      .filter(Boolean);
    for (const raw of rules) {
      for (const selector of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (selector.startsWith("@")) continue;
        expect(
          selector === ":root" || selector === "html" || selector === "body",
          `Forbidden global selector: "${selector}"`,
        ).toBe(false);
      }
    }
  });
});
