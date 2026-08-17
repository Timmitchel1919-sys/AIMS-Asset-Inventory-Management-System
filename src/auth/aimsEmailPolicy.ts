export const AIMS_ORGANIZATION_DOMAIN = "kangoeroeschool.com" as const;
export const AIMS_ACCOUNT_TYPE = "school-user" as const;
export const SELF_REGISTRATION_ENABLED =
  String(
    import.meta.env.VITE_SELF_REGISTRATION_ENABLED ?? "true",
  ).toLowerCase() === "true";
export const DEMO_AUTH_MODE =
  import.meta.env.DEV && import.meta.env.VITE_DEMO_AUTH_MODE === "true";
if (import.meta.env.DEV) console.info("AIMS demo auth mode:", DEMO_AUTH_MODE);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
export function isAuthorizedAimsEmail(email?: string | null) {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  const separator = normalized.lastIndexOf("@");
  return (
    separator > 0 &&
    normalized.slice(separator + 1) === AIMS_ORGANIZATION_DOMAIN
  );
}
export function isEmailAllowedForCurrentMode(email?: string | null) {
  return DEMO_AUTH_MODE ? !!email : isAuthorizedAimsEmail(email);
}
export function isVerificationRequired() {
  return !DEMO_AUTH_MODE;
}
export function canFirebaseUserAccess(
  input: { isAnonymous: boolean; email?: string | null },
  demoMode = DEMO_AUTH_MODE,
) {
  return input.isAnonymous
    ? demoMode
    : isAuthorizedAimsEmail(input.email) || (demoMode && !!input.email);
}

export const AIMS_ACCESS_MESSAGE =
  "AIMS is available only to users with a @kangoeroeschool.com account.";
export const AIMS_LOGIN_DOMAIN_MESSAGE =
  "Use your @kangoeroeschool.com email address to access AIMS.";
export const AIMS_REGISTRATION_DOMAIN_MESSAGE =
  "Registration is available only to @kangoeroeschool.com users.";
