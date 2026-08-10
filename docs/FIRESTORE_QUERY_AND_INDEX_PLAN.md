# Firestore Query and Index Plan

All queries require authenticated scope constraints and cursor pagination; unrestricted client full scans are prohibited.

| Area | Query/index pattern | Aggregation/function boundary |
|---|---|---|
| Assets/inventory | scope + status/category/location, ordered code/name/updatedAt | count/low-stock summaries; balance writes trusted |
| Assignments/borrows | department/location + status + dueDate | overdue counts and atomic asset availability |
| Repairs/maintenance | scope + status/technician + dueDate | backlog counts and recurrence generation |
| Movements | scope + type + occurredAt desc | append-only writes and correction function |
| Audits/discrepancies/actions | audit/scope + status/assignee + updatedAt | frozen sample and adjustment function |
| Notifications/activity | recipient/module + read/outcome/severity + createdAt desc | fan-out; sensitive activity access |
| Reports | owner/shared/type + updatedAt; results by definition/generatedAt | heavy/scheduled generation function |
| Management dashboards | pre-aggregated period + scope documents | scheduled/event-driven aggregates |

Each compound filter/order combination needs an emulator-verified composite index. Counts should use aggregation queries or trusted summary documents. Cursor IDs and scope must be validated server-side.
