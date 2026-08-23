# Normalized migration output

Normalized JSON files are intentionally not generated until both source workbooks can be processed by the approved spreadsheet runtime. Empty placeholder datasets would be misleading and are therefore not emitted.

The first populated execution must remain `DRY_RUN`; it must never contact production Firebase.
