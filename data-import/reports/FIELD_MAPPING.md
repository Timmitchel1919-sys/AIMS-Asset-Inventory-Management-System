# AIMS Legacy Field Mapping

| Source field | AIMS destination | Transformation | Validation | Authority | Status |
|---|---|---|---|---|---|
| Asset Code / Code / Device ID | `Asset.code`, `codePrefix`, `codeNumber` | Existing `normalizeAssetCode` | Unique across source, current and archived assets | Master inventory | Prepared |
| Device Name / Name / Item | `Asset.name` | Trim only | Required | Master inventory | Prepared |
| Category / Categorie | `Asset.category` | Case-insensitive canonical match | Existing category or reviewed create candidate | Master inventory | Prepared |
| Brand / Model / Serial Number | Asset identity fields | Trim; serial comparison case-insensitive | Duplicate detection | Master inventory | Prepared |
| Location / Locatie / Room | `Asset.location` and location reference | Case/whitespace canonicalization | Existing or reviewed create candidate | Master inventory | Prepared |
| Department / Afdeling | `Asset.department` | Case/whitespace canonicalization | Existing or human review | Master inventory | Prepared |
| CPU / RAM / SSD / HDD / Windows / Office | `Asset.technicalSpecifications` | Named key/value fields | Restricted length and type | Master inventory | Prepared |
| AnyDesk / TeamViewer | `Asset.remoteAccess` | Trim only | Restricted technical permission | Master inventory | Prepared |
| Date / Datum | `AssetHistoryEvent.occurredAt` | Parse and preserve historical instant | Valid date required | History Log | Prepared |
| Issue / Solution / Notes | Structured history fields | Preserve original text | Length and asset match | History Log | Prepared |
| Admin Password / Password variants | No destination | Remove before processing | `EXCLUDED_SENSITIVE_FIELD` | Never authoritative | Excluded |

Actual workbook headers and row counts remain pending approved spreadsheet extraction.
