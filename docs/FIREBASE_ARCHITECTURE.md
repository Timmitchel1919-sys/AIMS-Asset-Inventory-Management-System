# Firebase architecture

Production renders `FirebaseRepositoryProvider` only after Firebase Auth has resolved a verified `@kangoeroeschool.com` user. It implements the existing `InventoryRepository` contract and hydrates Firestore records into the application's established snapshot API, preserving routes and workflows. Mutations run the existing domain workflow validation, write changed documents atomically, attach server audit metadata, and surface normalized Firebase errors. Inventory quantity/reservation changes use Firestore transactions; asset-code allocation uses a transaction plus immutable `assetCodes/{code}` reservations.

Mock data remains available only for Vite development when `VITE_DEMO_AUTH_MODE=true`, automated tests, and presentation mode. Production never falls back to mock data if Firebase fails.

The UI has one bounded real-time listener for notifications. Other collections load on authorized repository startup. Transaction-dependent operations require the backend and are not presented as safe offline operations.

Rollback: restore the prior application build, but do not roll back rules to authenticated-only demo rules. Firestore exports/backups and data migrations are operational concerns outside client startup.
