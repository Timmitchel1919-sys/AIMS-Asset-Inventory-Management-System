# Firebase Data Model

This is the production collection model used by `FirebaseInventoryRepository`.

| Collections | Purpose and ID | Primary references/query patterns | Authority, sensitivity and retention |
|---|---|---|---|
| `users`, `roles`, `permissions`, `userRoleAssignments` | UID profiles; stable role/assignment IDs | role, status, department/location scope | Admin/function writes; personal/security fields separated; retain audit references |
| `systemSettings` | organization singleton documents | settings reads and version history | Writes create immutable activity records |
| `assets`, `codeGroups`, `assetCodes` | stable IDs; transactional code reservations | code/serial/category/location/status | `assetCodes` is immutable; records archive instead of delete |
| `inventoryItems`, `inventoryTransactions`, `inventoryReservations` | item and ledger IDs | location/category/status/reorder queries | Quantity and reservation deltas use transactions |
| `categories`, `subcategories`, `locations`, `departments` | stable reference IDs | active hierarchy and name lookup | Scoped admin writes; archive linked records |
| `assignments`, `borrows` | auto IDs plus human reference | asset/assignee/status/due date | Function workflow transitions; personal fields restricted |
| `repairs`, `repairParts`, `maintenanceSchedules`, `maintenanceTasks` | workflow/task IDs | asset/status/technician/due date | Authorized operational writes; costs restricted |
| `assetMovements` | append-only IDs | asset/item/date/type/correlation | Written atomically with linked asset state |
| `audits`, `auditItems`, `discrepancies`, `correctiveActions` | campaign/item/action IDs | audit/status/assignee/location | Frozen sample fields and approved adjustments protected |
| `disposals` | request IDs | asset/status/date | Retained alongside disposed/archived assets |
| `reportDefinitions`, `reportResults`, `scheduledReports` | definition/result/schedule IDs | owner/type/status/run date | Sensitive snapshots separated and retained by policy |
| `notifications` | recipient notification IDs | recipient/read/status/date | User-scoped reads; trusted fan-out |
| `activityLogs` | server-generated event IDs | module/action/user/date/correlation | Append-only; sensitive metadata redacted; policy retention |
| `aiConversations`, `aiMessages`, `aiSavedResults` | UID-scoped IDs | owner/updated/saved date | Owner/admin policy; sensitive references filtered and retained |

Additional operational collections are `assignments`, `borrows`, `repairs`, `maintenanceRecords`, `audits`, `auditDiscrepancies`, `correctiveActions`, `directoryUsers`, `roles`, `reports`, `reportResults`, and `scheduledReports`. IDs remain the existing domain IDs so relationships survive migration. Mock seeds are not uploaded automatically; only reviewed real KCS imports or an explicitly run development seed may populate a project.
