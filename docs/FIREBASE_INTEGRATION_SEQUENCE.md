# Firebase Integration Sequence

Every phase requires emulator configuration, passing adapter/rules/migration tests, reconciliation evidence, sign-off and a documented rollback to the previous provider/data export.

1. **A—Foundation:** project/environment/emulators/provider composition; no production data.
2. **B—Identity:** Authentication, profiles, roles, permissions and default-deny Rules.
3. **C—Reference/settings:** categories, locations, departments and settings.
4. **D—Assets:** asset repository, atomic codes and Storage attachments.
5. **E—Inventory:** items, balances, stock operations and movements.
6. **F—Operations:** assignments, borrowing, repairs and maintenance.
7. **G—Assurance:** audits, discrepancies, corrective actions and disposal.
8. **H—Intelligence:** reports, notifications, activity logs and schedules.
9. **I—AI/hardening:** provider function, sensitive-query filters, rate limits and production review.

Do not enter a phase until the preceding exit criteria pass; do not combine production migration with first-time Rules testing.
