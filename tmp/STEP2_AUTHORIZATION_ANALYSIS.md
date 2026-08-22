# Step 2 authorization analysis

## Authority

- Firebase Authentication establishes identity and verified school-domain access.
- `users/{uid}` is self-managed profile data and is never an authorization source.
- Effective permissions must come from trusted Auth custom claims or `accessAssignments/{uid}`.
- Explicit denials override grants. Inactive access assignments grant nothing.

## Current gaps

- Operational Firestore writes currently require only a verified school account.
- Repository commands do not check an effective actor permission before mutating state.
- Production has no trusted function/Admin SDK workflow that provisions claims or the first access assignment.
- Unfiltered collection loads are incompatible with strict department/location Rules query constraints.
- Financial and personal fields share documents with ordinary operational fields; Firestore Rules cannot mask fields inside a readable document.
- Last-active-administrator protection exists only as a pure domain helper, not in a trusted transaction.

## Query inventory

- `FirebaseInventoryRepository.initialize()` uses unfiltered `getDocs(collection(...))` for every repository collection and for categories, locations, departments and system settings.
- Notifications use one unfiltered `onSnapshot(collection(...))` listener.
- `UserDirectory` listens to the non-sensitive `userDirectory` collection.
- No production `where`, `orderBy`, or `limit` filters currently establish record scope.

## Phase delivered in this change

- Fail-closed workflow-action to permission mapping in the Firebase repository.
- Per-collection read/create/update permission checks in Firestore Rules.
- Trusted `accessAssignments/{uid}` schema with grants, denials, activation and bounded scopes.
- Tests for unauthorised operational reads/writes, explicit denial precedence and permitted repository workflows.

## Required follow-up for complete scope/field enforcement

- Add trusted callable functions for bootstrap, access assignment changes, session revocation and last-admin transactions.
- Add normalized `departmentId` and `locationId` to scoped records and query every collection with matching constraints.
- Move financial fields and private/personnel fields into separately permissioned documents before enabling non-global scoped reads.
