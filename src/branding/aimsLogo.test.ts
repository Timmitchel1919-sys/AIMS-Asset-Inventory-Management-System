import { describe, expect, it } from "vitest";
import type { ThemeId } from "../domain/types";
import { AIMS_LOGO_SRC, resolveAimsLogoSrc } from "./aimsLogo";

const THEMES: ThemeId[] = [
  "aimsAzureGlass",
  "aimsMidnight",
  "aimsEmeraldGloss",
  "aimsLight",
];

describe("resolveAimsLogoSrc", () => {
  it("uses the green artwork only for the sidebar under the Green theme", () => {
    expect(resolveAimsLogoSrc("sidebar", "aimsEmeraldGloss")).toBe(
      AIMS_LOGO_SRC.green,
    );
  });

  it("keeps the sidebar blue under every non-Green theme", () => {
    for (const theme of THEMES.filter((t) => t !== "aimsEmeraldGloss")) {
      expect(resolveAimsLogoSrc("sidebar", theme)).toBe(AIMS_LOGO_SRC.blue);
    }
  });

  it("keeps every other placement blue under every theme, Green included", () => {
    for (const theme of THEMES) {
      expect(resolveAimsLogoSrc("primary", theme)).toBe(AIMS_LOGO_SRC.blue);
    }
  });

  it("exposes exactly the two official PNG assets and nothing else", () => {
    expect(AIMS_LOGO_SRC).toEqual({
      blue: "/aims-logo-blue.png",
      green: "/aims-logo-green.png",
    });
  });
});
