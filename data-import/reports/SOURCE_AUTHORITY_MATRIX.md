# AIMS Source Authority Matrix

| Data domain | Primary authority | Secondary source | Conflict rule |
|---|---|---|---|
| Existing validated production record | AIMS Firestore | Master inventory | Preserve AIMS until a reviewed migration decision explicitly replaces fields. |
| Current asset identity and state | MASTER INVENTORY 2026.xlsx | History Log.xlsx | Master inventory wins for current state after duplicate and identifier validation. |
| Historical lifecycle event | History Log.xlsx | AIMS activity/workflow records | Preserve the original event date and text; do not overwrite a newer native AIMS event. |
| Asset code and sequence | AIMS code-group allocator | Source workbooks | Preserve only valid unique codes; otherwise request allocation from the existing code-group service. |
| Category, location and department | Existing AIMS reference data | Master inventory | Normalize case/whitespace only; create a candidate only when clearly legitimate and non-duplicate. |
| AnyDesk / TeamViewer ID | Master inventory, then device history | AIMS technical metadata | Import as restricted technical metadata only after one canonical asset match. |
| Administrator password | None | Any source column | Always exclude before normalization, reporting, logs and generated output. |

## Safety state

The source workbooks have not been extracted because the required approved spreadsheet runtime (`@oai/artifact-tool`) is unavailable in this session. This matrix records deterministic authority rules but does not claim row-level reconciliation is complete.
