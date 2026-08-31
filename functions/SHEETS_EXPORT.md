# AIMS → Google Sheets export (Phase 3)

One-way, read-only export of the live Firestore data into the mirror workbook
described in the Phase 2 scaffold spec. **No write-back**, no sync metadata is
stored in Firestore, and nothing here can modify or delete AIMS data.

| Piece | File |
| --- | --- |
| Pure transform (Firestore rows → tab matrix) | `sheetsExport.js` |
| Google Sheets API client (ADC auth, write-only) | `sheetsClient.js` |
| Callable `exportAimsToSheets` | `index.js` |
| Unit tests (`node --test`) | `sheetsExport.test.mjs` |

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

## Run

From an authenticated AIMS admin session:

```js
import { getFunctions, httpsCallable } from "firebase/functions";
const fn = httpsCallable(getFunctions(app, "southamerica-east1"), "exportAimsToSheets");
const { data } = await fn({}); // or fn({ spreadsheetId })
// data => { ok: true, syncedAt, rows: { "Master Inventory": 312, ... } }
```

## Not in this phase

Sheets → AIMS write-back, the `Sync Version` concurrency engine, Trash/Restore
round-trip, conflict handling, Apps Script triggers, scheduled runs. Those are
Phase 4+.
