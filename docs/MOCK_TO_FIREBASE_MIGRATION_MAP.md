# Mock-to-Firebase Migration Map

Pages continue to call provider-neutral repository contracts.

| Current contract/action | Firebase adapter | Trusted boundary | Order/tests/rollback |
|---|---|---|---|
| asset query/create/edit/code | `assets` queries/writes | code allocation/correction functions + Rules | references → assets; emulator/adapter parity; export rollback |
| inventory query and stock actions | items/balances queries | stock/transfer functions | items → balances; concurrency tests |
| assignment/borrow/repair/maintenance | workflow collections | transition functions | assets first; lifecycle parity tests |
| movement/audit/disposal | append/audit collections | corrections, freezing, adjustments, disposal functions | operational data first; immutability tests |
| report/notification/activity | definition/result/event collections | generation, fan-out, append activity | aggregates after source migration |
| users/roles/settings | Auth plus profile/access/settings | invite/access functions and Rules | first controlled phase; last-admin tests |
| assistant query/history | AI collections | provider callable function | last phase; redaction/mutation tests |
| attachments | Storage metadata adapters | scanning/processing functions | after owning records; orphan cleanup tests |

Migration uses export, transform, dry-run import, count/hash reconciliation and reversible provider switching. No page imports Firebase directly.
