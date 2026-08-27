# Asset Status and Condition Standard

The authoritative frontend maps are `src/domain/assetStatus.ts` and `src/domain/assetCondition.ts`. Status and condition are independent semantic fields. Records retain their existing domain values and never store presentation colors.

| Canonical status | English | Dutch | Color | Icon |
|---|---|---|---|---|
| `available` | Available | Beschikbaar | `#0D9488` | Circle check |
| `assigned` | Assigned | Toegewezen | `#7C3AED` | Arrow up-right |
| `borrowed` | Borrowed | Geleend | `#EAB308` | Arrows left-right |
| `reserved` | Reserved | Gereserveerd | `#2563EB` | Clock |
| `underMaintenance` | Under Maintenance | In onderhoud | `#D97706` | Cog |
| `underRepair` | Under Repair | In reparatie | `#DB2777` | Wrench |
| `damaged` | Damaged | Beschadigd | `#B91C1C` | Warning triangle |
| `archived` | Archived | Gearchiveerd | `#64748B` | Closed box |

| Canonical condition | English | Dutch | Color |
|---|---|---|---|
| `good` | Good | Goed | `#22C55E` |
| `fair` | Fair | Redelijk | `#F97316` |
| `poor` | Poor | Slecht | `#DC2626` |

`StatusBadge`/`AssetStatusBadge` and `ConditionBadge` are the reusable presentations. Status badges use an icon and label; condition badges use a simple colored dot and label. Both have neutral fallbacks for unknown legacy values and remain legible in tables, details, mobile layouts, themes, and print.

Lifecycle workflows may change status without changing condition. Assigning an asset sets `Assigned`, starting a repair sets `Under Repair`, and archiving sets `Archived`; in each case the existing condition is preserved. Condition changes only through an explicit condition update.

Normalization recognizes `allocated`, `issued to employee`, and `assigned-to-user` as `assigned`; `inactive archive`, `historical`, and `retired record` as `archived`; and `under-repair`, `under_repair`, `in repair`, and `repair` as `underRepair`. Unknown values are retained in the normalization report with `manualReview: true`.
