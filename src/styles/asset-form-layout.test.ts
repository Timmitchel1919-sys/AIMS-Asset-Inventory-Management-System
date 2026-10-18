import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("serialized asset edit form presentation", () => {
  it("pairs barcode with the official code and asset name with serial number", () => {
    const css = readFileSync(new URL("./assets.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.asset-identity-code\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1;/s);
    expect(css).toMatch(/\.asset-identity-barcode\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/s);
    expect(css).toMatch(/\.asset-identity-serial\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*2;/s);
    expect(css).toMatch(/\.asset-identity-name\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*2;/s);
  });

  it("uses the requested location hierarchy labels without changing field names", () => {
    const source = readFileSync(
      new URL("../pages/AssetForm.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('"Main location"');
    expect(source).toContain('"Sub-location"');
    expect(source).toMatch(/label=\{app\.language === "nl" \? "Afdeling" : "Department"\}[\s\S]*register\("responsibleEmployee"\)/);
    expect(source).toMatch(/label=\{app\.language === "nl" \? "Sublocatie" : "Sub-location"\}[\s\S]*register\("department"\)/);
  });
});
