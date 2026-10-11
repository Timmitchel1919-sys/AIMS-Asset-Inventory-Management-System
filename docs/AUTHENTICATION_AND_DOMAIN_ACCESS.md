# Authentication and domain access

The organization domain is centralized in `src/auth/aimsEmailPolicy.ts`. Email/password registration validates the exact domain, creates the Firebase user, sends verification, and withholds profile/data access until verification. “Check verification” reloads the Firebase user and forces an ID-token refresh. Google sign-in uses the same post-auth domain and verification checks; the `hd` hint is not treated as authorization.

On startup, `onAuthStateChanged` resolves the session before protected routes render. Wrong-domain accounts are signed out without loading Firestore. Valid unverified accounts see the verification screen. Only verified school users mount the production repository. Anonymous login is possible only in explicit Vite development demo mode and must be disabled in the production Firebase Console.

A freshly verified, self-registered user has no Auth custom claims yet, so the app calls the trusted `provisionUserAccess` Cloud Function, which creates the first `accessAssignments/{uid}` document with the default `warehouse-staff` grant (see `functions/accessDefaults.js`, kept in sync with `src/auth/permissions.ts`). This makes the account usable immediately; an administrator can later replace or customize the assignment. The call is idempotent and never overwrites an existing (for example suspended or administrator-tuned) assignment, and a transient failure never blocks sign-in.

Sign-out unmounts the per-user repository and its listener. The application does not use a persistent React Query business-data cache.

## Layer 1 hardening: account status, presence, sign-in audit

**Identity.** The Firebase Auth UID is the key everywhere (`users/{uid}`, `userDirectory/{uid}`, `presence/{uid}`, `accessAssignments/{uid}`). The email is an attribute and may change.

**Account state vs. presence.** The Users module shows two independent badges. *Account state* is `active`, `disabled` or `pending_verification`; *presence* is `online` or `offline`. A disabled or unverified account is never shown Online.

- `pending_verification` is written when the account registers (`recordAuthEvent("registration")`), so it appears in the Users module before verification.
- `disabled` means the Firebase Auth account is disabled **or** its `accessAssignments` entry is suspended (`active: false`). The Users page overlays the live assignment so an administrator's suspension shows immediately. A disabled account is signed straight back out and sees the "account disabled" page.
- Presence is a heartbeat (`presence/{uid}`, every 45 s, plus on tab-visible / focus / network-online). A record older than 130 s is Offline, which covers a closed tab, a crash, a lost network and an expired session. A deliberate sign-out writes Offline immediately. Firestore has no server-side disconnect hook, so a hard crash can show Online for up to about two minutes.

**Trusted sign-in recording.** The `recordAuthEvent` callable (`functions/authEvents.js`) derives `emailVerified`, `disabled` and the provider from Firebase Auth (Admin SDK), never from the request. It updates `userDirectory` (status, verification, `lastLoginAt`), `users.lastLoginAt`, and writes an `activityLogs` entry with an `AUTH_*` event: `AUTH_REGISTRATION`, `AUTH_LOGIN`, `AUTH_LOGIN_BLOCKED`, `AUTH_LOGOUT`, `AUTH_EMAIL_VERIFIED`, `AUTH_PASSWORD_CHANGED`. Audit details hold only the provider and derived status. The client only names the event; reporting is best-effort and bounded by a timeout so it can never block sign-in or sign-out.

**Rules.** Clients cannot change `status` or `emailVerified` in `userDirectory`, can stamp `lastLoginAt` only with the current server time, can seed only an `active`, verified directory entry (a fallback if the function is unreachable), and cannot write `AUTH_*` audit events. Presence is writable only by its owner. Device Management remains owner-only in Rules, in the router and in the manifest.

**Errors.** Sign-in failures (wrong password, unknown address, bad credential) share one message so the form cannot be used to discover accounts; "forgot password" looks identical for unknown addresses. Messages follow the AIMS language (English/Dutch) and never show raw Firebase errors.

**Known limits.**
- A password-reset *request* happens before sign-in, so it is not written to the AIMS audit log (Firebase Authentication keeps its own record). A completed reset is not detectable by AIMS either; only a signed-in password change is audited.
- Every verified, non-suspended school account currently has the full-rights access policy (see `firestore.rules`, `hasPermission`). That is a product decision, not changed here; it means a regular user can edit access assignments other than granting the `owner` role. Only the verified Owner email can reach Device Management and hold the owner role.
