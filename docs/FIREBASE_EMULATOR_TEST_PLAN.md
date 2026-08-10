# Firebase Emulator Test Plan

No emulator tests run in Wave 9 because Firebase is not connected.

Planned suites cover Authentication states; profile/claim refresh; Firestore and Storage default deny; each role/scope/explicit denial; immutable activity/movement/audit fields; file ownership/type/size; callable authorization; retries/idempotency; and retention/legal hold.

Concurrency cases:

- simultaneous KCS code allocation;
- stock issues/transfers exceeding a balance;
- duplicate assignment or borrow issue;
- conflicting returns/corrections;
- frozen audit sample mutation;
- append-only activity attempts.

CI will start isolated emulators, seed minimal fixtures, execute deny/allow and transaction tests, export logs, and destroy state. Production credentials are forbidden.
