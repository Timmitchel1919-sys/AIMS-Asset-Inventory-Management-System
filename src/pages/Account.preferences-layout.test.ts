import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const account = read("./Account.tsx");
const components = read("../styles/components.css");

describe("Preferences card layout", () => {
  it("places themes beside language on the top row and date & time underneath", () => {
    expect(components).toContain(
      ".account-settings-grid .themes-settings-card { grid-column: 1; grid-row: 1; }",
    );
    expect(components).toContain(
      ".account-settings-grid .language-settings-card { grid-column: 2; grid-row: 1; }",
    );
    expect(components).toContain(
      ".account-settings-grid .date-time-settings-card { grid-column: 1; grid-row: 2; }",
    );
    // Account.tsx still renders date-time first in the DOM; CSS places it on
    // the second row via grid-row.
    expect(account.indexOf("themes-settings-card")).toBeGreaterThan(-1);
    expect(account.indexOf("date-time-settings-card")).toBeGreaterThan(-1);
    expect(account.indexOf("language-settings-card")).toBeGreaterThan(-1);
  });

  it("keeps date and time formats side by side on larger screens", () => {
    expect(components).toMatch(
      /\.date-time-format-fields\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s,
    );
  });
});
