# AIMS → Google Sheets export (Phase 3)

One-way, read-only export of the live Firestore data into the mirror workbook
described in the Phase 2 scaffold spec. **No write-back**, no sync metadata is
stored in Firestore, and nothing here can modify or delete AIMS data.

| Piece | File |
| --- | --- |
| Pure transform (Firestore rows → tab matrix) | `sheetsExport.js` |
| Google Sheets API client (ADC auth, write-only) | `sheetsClient.js` |
| Callable `exportAimsToSheets` | `index.js` |

## Tests (`npm test` → `node --test`, CI: `.github/workflows/functions-tests.yml`)

51 tests, no emulator — `functions/testUtils.mjs` provides an in-memory
Firestore fake (transactions, batches, queries, `FieldValue`) and a fake Google
Sheets v4 backend (`installFakeSheets` stubs `global.fetch`;
`sheetsClient.__setTokenProvider` swaps out ADC).

- `sheetsExport.test.mjs` — `buildWorkbook` shape, redaction, archived→Trash
- `sheetsImport.test.mjs` — `planImport` policy, trash/restore intents,
  contradictions, `forcePatch`
- `applyImport.test.mjs` — executor: patch + version bump, version-race skip,
  idempotency, ref/code-group create, trash/restore, history correction
- `sheetsClient.test.mjs` / `sheetsClient.integration.test.mjs` — `withRetry`
  back-off, `exportWorkbook` create-missing-tab + replace, 429 retry through the
  client, `readTabs`, `writeCells` A1 targeting
- `roundtrip.test.mjs` — export → import is the identity; a single edit yields
  exactly one update / conflict / trash
- `syncRuns.test.mjs` — `recordRun` / `readHealth`

## What it does

`exportAimsToSheets` (admin-only `onCall`, region `southamerica-east1`):

1. reads `assets`, `inventoryItems`, `assetHistoryEvents`, `locations`,
   `departments`, `categories`, `codeGroups`;
2. builds the 9 tabs (`Master Inventory … Sync Log`) with the exact spec
   headers, excluding soft-deleted rows (which are listed on `Trash`);
3. creates any missing tabs, then **fully replaces** each tab's contents.

Idempotent: run it as often as you like. System columns are written as
`Sync Version = 0`, `Sync Status = SYNCED`, `Source = AIMS`, with a stamped
`Last Synced At` and a `Row Hash` — forward-compatible with the Phase 4 engine.

Never exported: `remoteAccess` (AnyDesk / TeamViewer), the raw `sourceData`
dump, and any credential-like `technicalSpecifications` key.

## One-time setup (required before deploy)

1. **Create the Google Sheet** (or use the one from Phase 2) and copy its id
   from the URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`.

2. **Enable the Sheets API** on the GCP project:

   ```
   gcloud services enable sheets.googleapis.com --project aims-asset-inventory-system
   ```

3. **Share the Sheet with the function's runtime service account** as
   **Editor**. For 2nd-gen functions that is the compute service account:

   ```
   <PROJECT_NUMBER>-compute@developer.gserviceaccount.com
   ```

   (find it with `gcloud iam service-accounts list --project aims-asset-inventory-system`).
   Sharing the single spreadsheet is the whole grant — no key file, no
   project-wide role.

4. **Set the spreadsheet id** — put it in `functions/.env` (git-ignored):

   ```
   AIMS_SYNC_SPREADSHEET_ID=<ID>
   ```

   or pass `{ spreadsheetId: "<ID>" }` in the call.

## Deploy

```
cd functions && npm install
npm test
firebase deploy --only functions:exportAimsToSheets
```

### Deploying from Windows

The project's absolute path contains spaces **and** an `&`
(`…\Ai Projects New\AIMS Asset & Inventory Management System…`), which breaks
the Firebase CLI's functions-discovery step on Windows (`'Inventory' is not
recognized…`). Deploy through a mapped drive and give discovery more time:

```powershell
subst X: "C:\Users\Administrator\Downloads\Ai Projects New\AIMS Asset & Inventory Management System CodeX + Firebase"
cd X:\
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "120"
firebase deploy --only functions:exportAimsToSheets --project aims-asset-inventory-system
subst X: /D   # cleanup
```

Hosting is unaffected — it deploys from GitHub Actions on Linux.

## Run

From an authenticated AIMS admin session:

```js
import { getFunctions, httpsCallable } from "firebase/functions";
const fn = httpsCallable(getFunctions(app, "southamerica-east1"), "exportAimsToSheets");
const { data } = await fn({}); // or fn({ spreadsheetId })
// data => { ok: true, syncedAt, rows: { "Master Inventory": 312, ... } }
```

## Import — Sheets → AIMS (Phase 4)

`importAimsFromSheets` (admin-only `onCall`) reads the sheet back into AIMS.
**Dry-run by default** — it returns a plan and writes nothing unless called with
`{ apply: true }` (the Settings UI does this only after an explicit confirm).

| File | Role |
| --- | --- |
| `sheetsImport.js` | pure planner — diffs sheet rows against Firestore, classifies every change |
| `applyImport.js` | executes an approved plan (transactions, `syncVersion` guard) |
| `sheetsImport.test.mjs` | planner unit tests |

Policy (hybrid):

- **identifier** fields (`Serial Number`, `On Hand`, `Reserved`, code-group
  `Prefix` / ranges / `Next Available Number`) — a change is a **conflict**,
  never applied.
- **manual** fields (`Status`, `Condition`, `Location`, `Department`,
  `Assigned To`, `Category`, reference parent/manager/status) — a change is a
  **conflict**, held for a human.
- **apply** fields (names, free text, most numbers, dates) — the sheet wins.
- A row with *any* conflicting field is held whole.
- `Sync Version` mismatch (doc changed in AIMS since last export) → **conflict**.
- Blank `Record ID`: **Locations / Departments / Categories / Code Groups** are
  created; **Master Inventory / Inventory Stock** rows are only reported
  (`needsAimsCreate`).
- `History Log` `Correction` cell → appends a new `correction` event; the cell
  is then cleared.

### Trash / Restore (Phase 5)

- **Trash from a data tab:** set a row's `Status` cell to `Archived`
  (Master Inventory, Locations, Departments, Categories). The planner reads this
  as a soft-delete intent — the record is archived (`status: "Archived"`,
  `isArchived: true`, `archivedAt/By`), not field-edited. `Sync Version` is still
  checked. A row for a record already archived in AIMS is a `record-archived`
  conflict (restore it from the Trash tab instead).
- **Restore from the Trash tab:** set the `Restore` cell to `RESTORE`. The record
  is un-archived (`status` back to `Available` / `Active`; code groups clear
  `archived`), the `Restore` cell is cleared and `Sync Status` set to `RESTORED`.
  A re-export rebuilds the Trash tab so the row drops off.
- Trashing the same record on a data tab while restoring it on the Trash tab in
  one run is a `contradictory` conflict — neither is applied.
- Archiving is soft only; nothing is hard-deleted, so the AIMS hard-delete guards
  (location with active assets, etc.) do not apply here.

On `apply`, each affected row's system columns (and new `Record ID`s) are pushed
back to the sheet so it stays coherent without a full re-export.

Run from the UI: **Settings → Integrations → "Preview changes"**, review the
conflicts/errors, then **"Apply N change(s)"** (two-click confirm).

## Conflicts review (Phase 6)

`resolveSyncConflict` (admin `onCall`) force-applies the sheet's value for the
chosen held fields of ONE `protected-field` conflict. Identifier fields are
refused; enums are validated; the `Sync Version` guard and sheet write-back are
the same as a normal apply. `sheetsImport.forcePatch()` builds the patch (pure,
unit-tested).

UI: **Settings → Integrations → "Review N conflicts →"** opens
`/admin/sync-conflicts` (`src/pages/SyncConflicts.tsx`). It runs a dry-run
preview, groups conflicts by tab with per-field from→to, and per
`protected-field` conflict offers a two-click **"Apply sheet value"**.
`stale-version` conflicts get an **Export & re-check** shortcut. Dismissals are
per-browser (`localStorage`), not shared.

## Scheduling & health (Phase 8)

- **`scheduledSheetExport`** (`onSchedule`, `America/Paramaribo`) auto-runs the
  full export on the `SYNC_EXPORT_SCHEDULE` cron (literal in `index.js`, default
  `every 24 hours` — change there + redeploy). Full replace = drift repair for
  AIMS → Sheet. Cloud Scheduler retries (`retryCount: 2`) on failure.
- **Transient-failure retry:** `sheetsClient.withRetry` wraps every Sheets API
  call — 3 attempts, exponential back-off + jitter, on `429/500/502/503/504`.
  A run that still fails is its own dead-letter: the cron retries next tick and
  a manual run surfaces the error.
- **`recordRun`** writes every export / import / resolve / scheduled run to
  `syncRuns` (trimmed to ~120) and overwrites `syncHealth/latest`.
- **`getSyncHealth`** (admin `onCall`) returns `syncHealth/latest` + the last 20
  runs. Settings → Integrations shows the latest run's time / status.

## Not yet built

Firestore-trigger event sync + a per-record `syncQueue`, Apps Script live
triggers, asset creation from the sheet.
