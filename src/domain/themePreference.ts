import type { ThemeId } from "./types";

type ThemePreferenceActions = {
  current: ThemeId;
  next: ThemeId;
  apply: (theme: ThemeId) => void;
  persist: (theme: ThemeId) => Promise<void>;
};

function isPermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  return (
    code === "permission-denied" ||
    (typeof message === "string" &&
      message.toLowerCase().includes("permission"))
  );
}

/**
 * Applies a theme optimistically. A Firestore permission error no longer
 * reverts the local choice: the user keeps the theme they picked on this
 * device and the error is bubbled so the caller can surface a message.
 * Other persistence failures (network, invalid data) still roll back so
 * the UI reflects what actually landed.
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
    if (!isPermissionError(error)) {
      apply(current);
    }
    throw error;
  }
}
