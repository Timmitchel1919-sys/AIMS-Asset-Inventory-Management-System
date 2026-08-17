# Firestore security audit working notes

Target: `aims-system-22e5d`, Standard `(default)` database, native mode.

## Paths and clients

- Auth/profile client: `users/{uid}`.
- Repository collections: `assets`, `inventoryItems`, `assignments`, `borrows`, `repairs`, `maintenanceRecords`, `assetMovements`, `audits`, `auditDiscrepancies`, `correctiveActions`, `disposals`, `notifications`, `activityLogs`, `locationTypes`, `codeGroups`, `directoryUsers`, `roles`, `reports`, `reportResults`, `scheduledReports`, `inventoryReservations`, `inventoryTransactions`.
- Reference collections: `categories`, `locations`, `departments`.
- Configuration/reservations: `systemSettings/{id}`, `assetCodes/{code}`.
- Legal paths: `legalDocuments/{type}`, nested `versions`, `legalConfiguration`, `policyAcknowledgements`.
- Direct query remaining outside repository: none. Repository currently loads bounded collection snapshots without `where/orderBy`; notifications use one listener.

## Attack inventory against current rules

1. Unauthenticated, wrong-domain, unverified, subdomain, and suffix-lookalike access: expected denied.
2. Own profile create/update: allowed only for fixed identity and preference fields.
3. Cross-user profile read/update and self-added `role`, `permissions`, `isAdmin`: expected denied.
4. Operational schema pollution: currently succeeds because `validWrite()` checks only map field count.
5. Type juggling and negative/over-reserved stock: currently succeeds; must be denied.
6. Oversized text/list/map payloads: currently insufficiently bounded.
7. Activity log update/delete: denied; create needs strict immutable schema validation.
8. Asset-code squatting: any verified user can reserve arbitrary codes; must be tied to a valid code group and constrained schema.
9. Code-group sequence tampering: broad operational update currently permits it; sequence-only client allocation needs constrained transitions and administrative configuration changes need claims.
10. Directory user/role/system settings privilege changes: protected by custom-claim permissions, but schemas are not validated.
11. Generic operational updates do not validate required fields on post-update state.
12. Nested legal document versions are currently default-denied, which can break approved legal history access.

## Required test outcomes

- Deny unauthenticated, wrong-domain, unverified, malformed lookalike domains.
- Allow verified exact-domain reads/writes only where collection rules permit.
- Deny cross-user profile access and privilege-field injection.
- Deny invalid inventory quantities and arbitrary fields.
- Deny activity update/delete.
- Deny normal-user admin collection writes; allow trusted permission claims.
- Default-deny unknown collections.

This file is an ignored implementation artifact and is not production documentation.
