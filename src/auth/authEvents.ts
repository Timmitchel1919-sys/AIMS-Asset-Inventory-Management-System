/**
 * Client side of the trusted `recordAuthEvent` Cloud Function.
 *
 * The browser only NAMES an event (login, logout, …). The function derives
 * the account status, verification and sign-in time from Firebase Auth on the
 * server, updates the Users directory and writes the audit entry, so none of
 * it can be forged from the client. Reporting is best-effort: it must never
 * block or break authentication, and it never carries a password or token.
 */
import { httpsCallable } from "firebase/functions";
import { firebaseFunctions } from "../lib/firebase";
import type { AccountStatus } from "./accountStatus";

export type AuthEventName =
  | "registration"
  | "login"
  | "logout"
  | "email_verified"
  | "password_changed"
  | "session";

export type AuthEventResult = {
  ok: boolean;
  status: AccountStatus;
  emailVerified: boolean;
};

const DEFAULT_TIMEOUT_MS = 8000;

export async function reportAuthEvent(
  event: AuthEventName,
  profile?: { department?: string | null; jobTitle?: string | null },
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<AuthEventResult | null> {
  if (!firebaseFunctions) return null;
  try {
    const call = httpsCallable<
      { event: AuthEventName; profile?: { department?: string; jobTitle?: string } },
      AuthEventResult
    >(firebaseFunctions, "recordAuthEvent")({
      event,
      ...(profile
        ? {
            profile: {
              ...(profile.department ? { department: profile.department } : {}),
              ...(profile.jobTitle ? { jobTitle: profile.jobTitle } : {}),
            },
          }
        : {}),
    });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const result = await Promise.race([call, timeout]);
    return result ? result.data : null;
  } catch (error) {
    if (import.meta.env.DEV) console.error(`AIMS auth event "${event}" not recorded:`, error);
    return null;
  }
}
