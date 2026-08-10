# Data Migration Readiness

Inventory current mock seeds separately from real KCS source files. Obtain signed-off users, roles, reference hierarchies, asset codes, serials, quantities, open workflows and historical ledgers.

Pipeline:

1. Profile and preserve source exports.
2. Normalize official codes, dates, quantities, categories, locations and departments.
3. Detect duplicate code/serial/email identities and unresolved references.
4. Validate against import schemas without writing production.
5. Dry-run into emulators.
6. Reconcile counts, totals, references and sampled histories.
7. Obtain operational/data-owner sign-off.
8. Schedule controlled migration with read-only window and backups.
9. Reconcile again; roll back provider/data snapshot on failure.

Mock data is never promoted as production truth.
