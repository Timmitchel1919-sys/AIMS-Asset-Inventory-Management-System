# Firebase Storage Plan

| Path | Types and indicative limits | Access/retention |
|---|---|---|
| `assets/{assetId}/images/{fileId}` | JPEG/PNG/WebP; 10 MB; bounded count | scoped asset access; archive retention |
| `assets/{assetId}/documents/{fileId}` | PDF/images; 20 MB | sensitive classification metadata |
| `repairs/{repairId}/evidence/{fileId}` | images/PDF; 20 MB | repair-authorized roles |
| `maintenance/{taskId}/evidence/{fileId}` | images/PDF; 20 MB | task scope |
| `audits/{auditId}/evidence/{fileId}` | images/PDF; 25 MB | audit permission; legal retention |
| `disposals/{requestId}/evidence/{fileId}` | images/PDF; 25 MB | restricted approval scope |
| `imports/{uid}/{uploadId}` | CSV/XLSX; 25 MB; temporary | owner/admin; delete after validated processing |
| `exports/{uid}/{exportId}` | generated CSV/XLSX/PDF | short expiry; sensitive download authorization |
| `users/{uid}/profile/{fileId}` | JPEG/PNG/WebP; 5 MB | self/admin |

Use generated safe file IDs, original-name metadata, content-type/size checks in Rules and trusted processing. Avoid permanent public download tokens for sensitive files. Malware scanning is not implemented and must be added through a trusted scanning pipeline before production.
