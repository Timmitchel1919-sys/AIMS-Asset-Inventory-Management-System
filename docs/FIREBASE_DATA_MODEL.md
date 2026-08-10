# Firebase Data Model

This is a provider-neutral proposal; no collections were created.

| Collections | Purpose and ID | Primary references/query patterns | Authority, sensitivity and retention |
|---|---|---|---|
| `users`, `roles`, `permissions`, `userRoleAssignments` | UID profiles; stable role/assignment IDs | role, status, department/location scope | Admin/function writes; personal/security fields separated; retain audit references |
| `settings` | category/key documents | category reads and version history | Privileged writes with approval and immutable change log |
| `assets`, `assetCodeGroups`, `assetCodeIssuance`, `assetCodeHistory` | auto IDs; code allocation ledgers | code/serial/category/location/status | Trusted allocation/correction; archive, never destructive history deletion |
| `inventoryItems`, `inventoryBalances` | item and item-location balance IDs | location/category/status/reorder queries | Function transactions for quantity changes; costs sensitive |
| `categories`, `subcategories`, `locations`, `departments` | stable reference IDs | active hierarchy and name lookup | Scoped admin writes; archive linked records |
| `assignments`, `borrows` | auto IDs plus human reference | asset/assignee/status/due date | Function workflow transitions; personal fields restricted |
| `repairs`, `repairParts`, `maintenanceSchedules`, `maintenanceTasks` | workflow/task IDs | asset/status/technician/due date | Authorized operational writes; costs restricted |
| `movements` | append-only IDs | asset/item/date/type/correlation | Function-created immutable ledger |
| `audits`, `auditItems`, `discrepancies`, `correctiveActions` | campaign/item/action IDs | audit/status/assignee/location | Frozen sample fields and approved adjustments protected |
| `disposalRequests` | request IDs | asset/status/date | Segregated approval/completion authority |
| `reportDefinitions`, `reportResults`, `scheduledReports` | definition/result/schedule IDs | owner/type/status/run date | Sensitive snapshots separated and retained by policy |
| `notifications` | recipient notification IDs | recipient/read/status/date | User-scoped reads; trusted fan-out |
| `activityLogs` | server-generated event IDs | module/action/user/date/correlation | Append-only; sensitive metadata redacted; policy retention |
| `aiConversations`, `aiMessages`, `aiSavedResults` | UID-scoped IDs | owner/updated/saved date | Owner/admin policy; sensitive references filtered and retained |

Composite indexes are detailed in `FIRESTORE_QUERY_AND_INDEX_PLAN.md`. Migration sources are current mock seeds/repositories followed by reviewed real KCS imports.
