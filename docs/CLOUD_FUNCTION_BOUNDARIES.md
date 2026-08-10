# Cloud Function Boundaries

| Function group | Trigger/caller and validation | Transaction/idempotency/logging |
|---|---|---|
| `allocateAssetCode`, `correctAssetCode` | callable admin/ICT; validate group, reason and uniqueness | transaction ledger; request key; append activity |
| `inviteUser`, `syncUserAccess` | callable admin; protect last admin and high-risk roles | Auth/profile/assignment consistency; revoke tokens |
| `adjustStock`, `transferStock` | callable authorized staff; quantity, location, reason, approval | balance + movement transaction; retry-safe reference |
| `assignAsset`, `processBorrow`, `processReturn` | workflow caller; eligibility, approval and conflicts | asset/workflow/movement atomic update |
| `completeRepair`, `generateMaintenanceTasks`, `correctMovement` | callable/scheduled; state and recurrence validation | state transition plus immutable events |
| `freezeAuditSample`, `applyAuditAdjustment`, `completeDisposal` | privileged callable; segregation and evidence | frozen snapshot/stock/asset transaction |
| `generateReport`, `runScheduledReports`, `fanOutNotifications` | callable/scheduled; scope/sensitive-field policy | result IDs and retry-safe delivery |
| `appendActivity`, `applyRetention` | internal/event/scheduled | append-only/redacted events; legal holds |
| `queryAiProvider` | callable; intent, permission, scope, redaction and rate limit | no mutation; logged request/result references |

Every function needs structured safe errors, authorization re-checks, emulator tests, correlation IDs, bounded retries and idempotency keys where the caller may retry.
