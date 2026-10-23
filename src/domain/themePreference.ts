import type { ThemeId } from "./types";

type ThemePreferenceActions = {
  current: ThemeId;
  next: ThemeId;
  apply: (theme: ThemeId) => void;
  persist: (theme: ThemeId) => Promise<void>;
};

/**
 * Applies a theme optimistically, but restores the complete local theme state
 * when the authenticated profile update is rejected.
 */
export async function persistThemePreference({
  current,
  next,
  apply,
  persist,
}: ThemePreferenceActions): Promise<void> {
  if (current === next) return;
  apply(next);
  try {
    await persist(next);
  } catch (error) {
    apply(current);
    throw error;
  }
}
