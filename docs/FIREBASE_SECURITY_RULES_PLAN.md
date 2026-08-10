# Firebase Security Rules Plan

Default deny. Require authentication, active profile state and explicit role/scope for every collection. Rules validate allowed fields, types, immutable IDs/references/timestamps, archive transitions and sensitive-field separation.

- Users/roles/settings: self-read minimum; privileged writes through trusted functions for role/security changes.
- Assets/inventory/workflows: scoped reads; ordinary edits field-limited; code, quantity, approval, completion and correction fields function-only.
- Movements/activity: client read by permission; append only from trusted backend.
- Audits/reports/AI: frozen audit fields protected; sensitive results and conversations owner/scoped; provider execution server-only.
- Notifications: recipient reads/status updates; fan-out function-only.
- Storage: path ownership plus matching Firestore authorization, content type/size metadata and sensitive evidence restrictions.

Test with Emulator Suite for anonymous, disabled/suspended, each role, department/location scope, explicit denial, immutable fields, sensitive fields and cross-tenant/record guessing. Rules are defense enforcement; UI guards remain usability controls.
