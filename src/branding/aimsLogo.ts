import type { ThemeId } from "../domain/types";

/**
 * The single source of truth for AIMS logo artwork.
 *
 * There are exactly two official assets and no more. Do not add recoloured,
 * cropped, resized or "variant" copies — point every placement at one of these
 * two files and let {@link resolveAimsLogoSrc} decide which one applies.
 *
 *  - `blue`  — the primary AIMS logo. Used everywhere by default.
 *  - `green` — the Green-theme logo. Used for one placement only: the brand
 *              mark at the top-left of the left sidebar while the Green
 *              (Emerald) theme is active. It never replaces any other logo.
 *
 * Both files are transparent PNGs; keep them transparent.
 */
export const AIMS_LOGO_SRC = {
  blue: "/aims-logo-blue.png",
  green: "/aims-logo-green.png",
} as const;

/** Meaningful branding alt text. Decorative repeats pass `alt=""` instead. */
export const AIMS_LOGO_ALT = "AIMS — Asset & Inventory Management System";

/**
 * Where an AIMS logo is being rendered.
 *
 *  - `sidebar` — the top-left brand mark of the authenticated left sidebar.
 *                This is the ONLY theme-reactive placement.
 *  - `primary` — every other location (login, splash, header, reports, legal
 *                pages, download page, …). Always the blue logo.
 */
export type AimsLogoPlacement = "sidebar" | "primary";

/**
 * Resolves the official artwork for a placement under the active theme.
 *
 * Only `placement === "sidebar"` under the Green (Emerald) theme yields the
 * green artwork; every other placement, and every other theme, yields blue.
 */
export function resolveAimsLogoSrc(
  placement: AimsLogoPlacement,
  theme: ThemeId,
): string {
  if (placement === "sidebar" && theme === "aimsEmeraldGloss") {
    return AIMS_LOGO_SRC.green;
  }
  return AIMS_LOGO_SRC.blue;
}
