# Firebase deployment checklist

1. Confirm `.firebaserc` targets the intended production project and inspect the Firestore edition/location. Never seed production with demo data.
2. Configure the six `VITE_FIREBASE_*` values; keep `VITE_DEMO_AUTH_MODE=false` and `VITE_USE_FIREBASE_EMULATORS=false`.
3. Enable only Email/Password and, if required, Google. Disable Anonymous Authentication. Restrict authorized domains and brand verification/reset/email-change templates.
4. Review `firestore.rules`, `storage.rules`, and `firestore.indexes.json`. Run unit/build and Emulator Suite authorization tests.
5. Deploy with `npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes,storage` and deploy Hosting separately after approval.
6. Smoke-test verified, unverified, wrong-domain, lookalike-domain, signed-out, logout, refresh, mobile, and installed-PWA sessions. Confirm direct unauthorized Firestore access returns `permission-denied`.
7. Monitor permission errors/read volume. Roll back the app build if required; retain secure rules and restore data only from an approved export.

No deployment or production data migration runs automatically from this repository.
