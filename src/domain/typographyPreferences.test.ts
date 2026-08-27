import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILIES,
  FONT_SIZES,
  resolveFontFamily,
  resolveFontSize,
} from "./typographyPreferences";

describe("typography preferences", () => {
  it("exposes only the approved values", () => {
    expect(FONT_FAMILIES).toEqual(["Inter", "Montserrat", "Source Sans 3", "Roboto", "Open Sans"]);
    expect(FONT_SIZES).toEqual([12, 13, 14, 15, 16]);
  });

  it("preserves supported values", () => {
    expect(resolveFontFamily("Montserrat")).toBe("Montserrat");
    expect(resolveFontSize(16)).toBe(16);
  });

  it("falls back safely for corrupt or missing values", () => {
    expect(resolveFontFamily("Comic Sans")).toBe(DEFAULT_FONT_FAMILY);
    expect(resolveFontFamily(undefined)).toBe(DEFAULT_FONT_FAMILY);
    expect(resolveFontSize(18)).toBe(DEFAULT_FONT_SIZE);
    expect(resolveFontSize("14")).toBe(DEFAULT_FONT_SIZE);
  });
});
