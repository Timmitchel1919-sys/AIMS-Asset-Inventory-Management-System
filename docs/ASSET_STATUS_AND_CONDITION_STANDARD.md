# Asset Status and Condition Standard

The authoritative frontend map is `src/domain/assetStatus.ts`. Records retain existing domain status/condition values and never store colors.

| Canonical key | English | Dutch | Condition | Semantic color |
|---|---|---|---|---|
| `available` | Available | Beschikbaar | Good / Goed | Green |
| `assigned` | Assigned | Toegewezen | Good / Goed | Purple |
| `borrowed` | Borrowed | Geleend | Good / Goed | Yellow |
| `reserved` | Reserved | Gereserveerd | Good / Goed | Blue |
| `underMaintenance` | Under Maintenance | In Onderhoud | Fair / Redelijk | Orange |
| `underRepair` | Under Repair | In Reparatie | Good / Goed | Magenta |
| `damaged` | Damaged | Beschadigd | Poor / Slecht | Red |
| `archived` | Archived | Gearchiveerd | Good / Goed | Slate Gray |

Asset forms automatically apply and visibly explain the mapped condition. Normal form validation rejects invalid mapped combinations. No override path exists in the current authorization architecture. Unknown legacy values are preserved and shown with a neutral text-and-icon fallback so they remain reportable.

`AssetStatusBadge` is the reusable presentation. It supports compact, standard, solid, table, mobile, and print variants. Text, condition in its accessible name, icon, border, and print-safe grayscale styling ensure meaning never depends on color alone.

Assignments set Assigned/Good and retain prior operational values in assignment history. Repair records preserve previous asset status and condition, then use Under Repair/Good while active. Archiving sets Archived/Good without changing the KCS code or deleting historical records; active workflow selectors continue to exclude archived assets.

Normalization recognizes `allocated`, `issued to employee`, and `assigned-to-user` as `assigned`; `inactive archive`, `historical`, and `retired record` as `archived`; and `under-repair`, `under_repair`, `in repair`, and `repair` as `underRepair`. Unknown values are retained in the normalization report with `manualReview: true`.
