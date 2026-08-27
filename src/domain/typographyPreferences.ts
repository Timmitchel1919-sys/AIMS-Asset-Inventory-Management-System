export const FONT_FAMILIES = [
  "Inter",
  "Montserrat",
  "Source Sans 3",
  "Roboto",
  "Open Sans",
] as const;

export const FONT_SIZES = [12, 13, 14, 15, 16] as const;

export type FontFamily = (typeof FONT_FAMILIES)[number];
export type FontSize = (typeof FONT_SIZES)[number];

export const DEFAULT_FONT_FAMILY: FontFamily = "Inter";
export const DEFAULT_FONT_SIZE: FontSize = 14;

export const FONT_FAMILY_STACKS: Record<FontFamily, string> = {
  Inter: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  Montserrat: 'Montserrat, Inter, system-ui, sans-serif',
  "Source Sans 3": '"Source Sans 3", Inter, system-ui, sans-serif',
  Roboto: 'Roboto, Inter, system-ui, sans-serif',
  "Open Sans": '"Open Sans", Inter, system-ui, sans-serif',
};

export function resolveFontFamily(value: unknown): FontFamily {
  return FONT_FAMILIES.includes(value as FontFamily)
    ? (value as FontFamily)
    : DEFAULT_FONT_FAMILY;
}

export function resolveFontSize(value: unknown): FontSize {
  return FONT_SIZES.includes(value as FontSize)
    ? (value as FontSize)
    : DEFAULT_FONT_SIZE;
}
