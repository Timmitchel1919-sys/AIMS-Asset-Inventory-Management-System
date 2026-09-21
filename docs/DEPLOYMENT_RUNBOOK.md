# AIMS — `provisionUserAccess` deployment/rollout runbook

Status: **ready to deploy** (2026-09-21). The fix is implemented and verified;
the function still needs a manual deploy (see [Deploy](#deploy-two-parts---ci-only-covers-2)).

## Why

A freshly registered, email-verified `@kangoeroeschool.com` account has no Auth
custom claims and no `accessAssignments/{uid}` document yet, so Firestore Rules
deny every operational read/write — the account appears to "log in but has no
access". The new callable `provisionUserAccess` creates the baseline
`warehouse-staff` assignment (role + 21 permissions from
`functions/accessDefaults.js`, kept in sync with `rolePermissions["warehouse-staff"]`
in `src/auth/permissions.ts`). The web app calls it idempotently at the end of
`ensureAimsUserProfile` (`src/auth/firebaseAuth.ts`), so provisioning happens
before the dashboard ever reads data. It never overwrites an existing
(admin-customized or suspended) assignment, and a transient failure never blocks
sign-in.

Applies to every verified school-domain account, including the requested ones:
`despercev@kangoeroeschool.com`, `sastropawiroe@kangoeroeschool.com`,
`macleanj@kangoeroeschool.com`, `sanoesij@kangoeroeschool.com`,
`Manager-ICT@kangoeroeschool.com`.

## Deploy (two parts — CI only covers #2)

1. **Functions** (manual; GitHub Actions only deploys Hosting):

   ```bash
   firebase use aims-asset-inventory-system
   firebase deploy --only functions:provisionUserAccess
   ```

   `firebase deploy --only functions` also works; it additionally touches the
   existing Sheets functions.

2. **Hosting** (the client must call the new function):

   ```bash
   npm run build && firebase deploy --only hosting
   ```

   or merge to `main` (`.github/workflows/firebase-hosting-merge.yml`).

3. **Firestore rules: unchanged** — no redeploy needed.

## Rollout effect

- No data migration. Both pre-existing accounts and new registrations get
  `accessAssignments/{uid}` on their **next login** after email verification.
- If someone logs in *before* functions are deployed, login still succeeds (the
  provisioning call is non-fatal); the account is provisioned the next time they
  sign in after the deploy.

## Verify

1. Deploy output shows
   `✓  functions[provisionUserAccess(southamerica-east1)]: Successful`.
2. Sign in with a fresh verified school account (or one of the five). The
   dashboard loads data; no permission errors in the browser console / network
   tab.
3. Firebase Console → Firestore → `accessAssignments/{uid}` → `active: true`,
   `role: "warehouse-staff"`, `denials: []`, `allRecords: true`, 21 permissions,
   no `admin.*` permissions.

## Optional — zero-touch pre-provision

Admins (`admin.users.manage`, via Console or Admin SDK — client delete is
blocked and create requires the permission) can seed a doc before a user's first
login. Values must satisfy `validAccessAssignment` (`firestore.rules`, ~line 400):

```jsonc
// accessAssignments/<uid>
{
  "uid": "<uid>",
  "role": "warehouse-staff",
  "permissions": [ /* 21 perms from functions/accessDefaults.js */ ],
  "denials": [],
  "active": true,
  "allRecords": true,
  "departmentIds": [],
  "locationIds": [],
  "createdAt": "<serverTimestamp>",
  "createdBy": "<uid-or-admin>",
  "updatedAt": "<serverTimestamp>",
  "updatedBy": "<uid-or-admin>"
}
```

Use the `uid` from Authentication (or the matching `users/{uid}` document).
Simpler default: let first login self-provision.

## Rollback

1. **Stop provisioning:** remove the `provisionUserAccess` export from
   `functions/index.js`, redeploy functions; remove `ensureDefaultAccessAssignment`
   from `src/auth/firebaseAuth.ts`, rebuild + redeploy hosting.
2. **Existing assignments persist** — they are data, not code. To fully revoke,
   delete the `accessAssignments/{uid}` documents via Console / Admin SDK.
3. The function cannot `create` over an existing/suspended assignment, so there
   is no escalation or self-re-enable path.

## Monitoring

```bash
firebase functions:log --only provisionUserAccess
```

Each call returns/logs `created`, `existing`, or `suspended`. Suspended users
(`active: false`) are returned untouched.

## Sanity checks

```bash
node --test functions/accessDefaults.test.mjs   # 3 tests, guards default-grant parity
npm run typecheck
```

No changes to `firestore.rules` or `firestore.emulator.test.ts` were needed, so
the rules/emulator security tests stay valid.
