# Firebase Authentication Readiness

## Wave 9 proposed authentication architecture

Use email/password with verified email initially; invitations are admin-created trusted-function operations that create the Auth user and Firestore profile. Disabled Auth users and application suspension are distinct: suspension requires profile state plus Rules/function checks. Roles/scopes live in Firestore; compact custom claims may accelerate coarse checks but cannot hold the full permission matrix. Privileged changes update profile/access assignments, refresh claims and revoke sessions where required. Critical actions require recent authentication; password reset, optional MFA, session revocation and token refresh are tested in emulators. Mock users migrate only after identity matching and invitation sign-off.

Validation date: 2026-07-31  
Decision: **NOT READY TO CONNECT**

The application remains provider-neutral and mock-only. No Firebase dependency or configuration was added.

Before Firebase Authentication may be connected, complete and certify:

- Provider-neutral invitation, activation, suspension, reactivation, session and password-reset contracts.
- Effective-permission resolution at route, action, repository, record-scope and sensitive-field layers.
- Last-active-administrator protection in the repository transaction boundary.
- Authentication/security activity schema without tokens or secrets.
- Signed-out, suspended, expired-session, offline and recovery state E2E coverage.
- Emulator-backed adapter tests in a separately authorized integration wave.

Wave 8 does not authorize Firestore rules, claims, Cloud Functions, Storage, real email, MFA or deployment.
