# Authentication and domain access

The organization domain is centralized in `src/auth/aimsEmailPolicy.ts`. Email/password registration validates the exact domain, creates the Firebase user, sends verification, and withholds profile/data access until verification. “Check verification” reloads the Firebase user and forces an ID-token refresh. Google sign-in uses the same post-auth domain and verification checks; the `hd` hint is not treated as authorization.

On startup, `onAuthStateChanged` resolves the session before protected routes render. Wrong-domain accounts are signed out without loading Firestore. Valid unverified accounts see the verification screen. Only verified school users mount the production repository. Anonymous login is possible only in explicit Vite development demo mode and must be disabled in the production Firebase Console.

Sign-out unmounts the per-user repository and its listener. The application does not use a persistent React Query business-data cache.
