# AIMS ⇄ Google Sheets — operations runbook

Status: **activated** (2026‑08‑31). The AIMS → Sheet export runs automatically;
the Sheet → AIMS write‑back is admin‑triggered with a preview step.

## The moving parts

| Thing | Value |
| --- | --- |
| Workbook | `AIMS ⇄ Master Data` — id `1zcnrrE_IvXhBWcbGSWLtESLw4mrLiSC-NddNDnDUBEM` |
| Runtime service account (must stay Editor on the sheet) | `460678524013-compute@developer.gserviceaccount.com` |
| Region | `southamerica-east1` |
| Functions | `exportAimsToSheets`, `importAimsFromSheets`, `resolveSyncConflict`, `getSyncHealth`, `scheduledSheetExport` |
| Scheduler job | `firebase-schedule-scheduledSheetExport-southamerica-east1` — `every 24 hours` (~17:35 UTC), `retryCount 2` |
| Health | `syncHealth/latest` doc + `syncRuns` collection (last ~120) |
| Config | `functions/.env` → `AIMS_SYNC_SPREADSHEET_ID`; cadence is the `SYNC_EXPORT_SCHEDULE` literal in `functions/index.js` |

## Daily operation

- **Automatic:** `scheduledSheetExport` full‑replaces every tab nightly. Full
  replace = drift repair for AIMS → Sheet, so a missed run self‑heals next tick.
- **On demand (export):** Settings → Integrations → **Export now**.
- **Write‑back (Sheet → AIMS):** Settings → Integrations → **Preview changes**,
  review the conflict/error list, then **Apply N change(s)** (two‑click). New
  asset rows are reported, never auto‑created. Identifier / status / location /
  assignment edits are held as conflicts.
- **Conflicts:** `/admin/sync-conflicts` — inspect each, **Apply sheet value**
  (manual fields only) or **Dismiss**. `stale-version` → **Export & re-check**.
- **Trash / Restore:** set a data‑tab `Status` to `Archived` to trash; set a
  Trash‑tab `Restore` cell to `RESTORE` to bring it back. Applied via the same
  Preview → Apply flow.

## Checks

```bash
# functions healthy
gcloud functions list --project aims-asset-inventory-system \
  --format="table(name,state,updateTime)"

# scheduler enabled + last result (empty status = success)
gcloud scheduler jobs describe firebase-schedule-scheduledSheetExport-southamerica-east1 \
  --project aims-asset-inventory-system --location southamerica-east1 \
  --format="yaml(state,status,lastAttemptTime)"

# latest run health (or read syncHealth/latest in the Firestore console)
TOKEN=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firestore.googleapis.com/v1/projects/aims-asset-inventory-system/databases/(default)/documents/syncHealth/latest"

# function logs
gcloud functions logs read scheduledSheetExport \
  --project aims-asset-inventory-system --region southamerica-east1 --limit 40
```

The Settings → Integrations panel also shows `Last sync run (…): <time> ✓/✗`.

## Runbook

**Force a run now**
```bash
gcloud scheduler jobs run firebase-schedule-scheduledSheetExport-southamerica-east1 \
  --project aims-asset-inventory-system --location southamerica-east1
```

**Pause / resume the automatic export**
```bash
gcloud scheduler jobs pause  firebase-schedule-scheduledSheetExport-southamerica-east1 \
  --project aims-asset-inventory-system --location southamerica-east1
gcloud scheduler jobs resume firebase-schedule-scheduledSheetExport-southamerica-east1 \
  --project aims-asset-inventory-system --location southamerica-east1
```

**Change the cadence** — edit `SYNC_EXPORT_SCHEDULE` in `functions/index.js`,
then redeploy functions (on Windows: `subst X: <repo>` → `cd X:\` →
`FUNCTIONS_DISCOVERY_TIMEOUT=120 firebase deploy --only functions`).

**Point at a different sheet** — set `AIMS_SYNC_SPREADSHEET_ID` in
`functions/.env`, share the new sheet with the service account (Editor),
redeploy functions.

**Rollback the sheet** — the workbook keeps Google Sheets version history
(File → Version history). The export never deletes tabs, only replaces cell
values. A bad export is fixed by restoring a version or re‑running the export
after fixing the source data.

**Something is wrong**
- Export failing: check `syncHealth/latest.error` and function logs. Most
  likely the sheet was un‑shared from the service account, or the Sheets API
  was disabled.
- Import applied something wrong: it was one `runTransaction` per record with a
  `Sync Version` guard, so re‑export and inspect `/admin/sync-conflicts`; fix
  the record in AIMS (the source of truth) and re‑export.
- Never edit `Record ID`, `Business Code`, `Sync Version` or the other
  system columns in the sheet.

## Not enabled

Firestore‑trigger event sync + a per‑record `syncQueue`, Apps Script live
`onEdit` triggers, asset creation from the sheet. The write‑back is deliberately
manual + reviewed.
