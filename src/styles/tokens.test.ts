import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const themes = [
  "kcs-forest-gold",
  "kcs-azure-intelligence",
  "emerald-gloss",
];

describe("theme tokens", () => {
  it.each(themes)("defines %s", (theme) =>
    expect(css).toContain(`[data-theme="${theme}"]`),
  );
  it.each(["kcs-soft-sage", "kcs-skyglass", "kcs-coral-graphite"])(
    "does not expose removed %s",
    (theme) => expect(css).not.toContain(`[data-theme="${theme}"]`),
  );
  it.each([
    "--color-background",
    "--color-surface",
    "--color-primary",
    "--color-accent",
    "--color-text-primary",
    "--color-border",
    "--color-focus-ring",
    "--color-success",
    "--color-warning",
    "--color-danger",
    "--color-info",
    "--color-sidebar-background",
    "--color-input-background",
  ])("defines semantic token %s", (token) => expect(css).toContain(token));

  it.each([
    "--workspace-background: var(--color-background)",
    "--surface-card: var(--color-surface)",
    "--surface-panel: var(--color-surface-secondary)",
    "--surface-elevated: var(--color-surface-elevated)",
    "--surface-border: var(--color-border)",
    "--surface-text-primary: var(--color-text-primary)",
    "--surface-text-secondary: var(--color-text-secondary)",
  ])("maps unified surface token %s", (token) => expect(css).toContain(token));

  it("defines the legacy semantic aliases through canonical theme-aware tokens", () => {
    expect(css).toContain("--color-text: var(--color-text-primary)");
    expect(css).toContain(
      "--color-surface-subtle: var(--color-surface-secondary)",
    );
  });
});

describe("typography system", () => {
  it.each([
    "--font-sans",
    "--font-mono",
    "--text-xs",
    "--text-sm",
    "--text-md",
    "--text-base",
    "--text-4xl",
    "--leading-normal",
    "--tracking-wider",
  ])("defines %s", (token) => expect(css).toContain(token));

  it("provides tabular numeral and monospace utilities", () => {
    expect(css).toContain(".tabular-nums");
    expect(css).toContain(".type-mono");
  });
});
