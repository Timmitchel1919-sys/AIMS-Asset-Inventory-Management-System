import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { buildWorkbook, TAB_HEADERS } from "./sheetsExport.js";
import { exportWorkbook, readTabs, writeCells } from "./sheetsClient.js";
import {
  collectionForTab,
  forcePatch,
  IMPORT_TABS,
  planImport,
} from "./sheetsImport.js";
import { applyPlan } from "./applyImport.js";

initializeApp();
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
// Not a secret — a spreadsheet id is not sensitive. Set it in functions/.env
// (or .env.aims-asset-inventory-system), or pass { spreadsheetId } in the call.
const syncSpreadsheetId = defineString("AIMS_SYNC_SPREADSHEET_ID", {
  default: "",
});
const SCHOOL_DOMAIN = "kangoeroeschool.com";
const BOOTSTRAP_ADMIN_UID = "VogTjC6S1aXHO6ySBbdiQ7LNOYG3";

function authorized(request) {
  const email = String(request.auth?.token?.email || "")
    .trim()
    .toLowerCase();
  return (
    request.auth?.token?.email_verified === true &&
    email.endsWith(`@${SCHOOL_DOMAIN}`)
  );
}

function isAdmin(request) {
  if (!authorized(request)) return false;
  const token = request.auth?.token || {};
  const permissions = Array.isArray(token.permissions) ? token.permissions : [];
  return (
    request.auth?.uid === BOOTSTRAP_ADMIN_UID ||
    token.role === "administrator" ||
    token.admin === true ||
    permissions.includes("admin.access") ||
    permissions.includes("admin.system.configure")
  );
}

export const askAimsAssistant = onCall(
  {
    region: "southamerica-east1",
    secrets: [anthropicApiKey],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    if (!authorized(request))
      throw new HttpsError(
        "permission-denied",
        "A verified school account is required.",
      );
    const query = String(request.data?.query || "")
      .trim()
      .slice(0, 2000);
    const language = request.data?.language === "nl" ? "nl" : "en";
    const context = request.data?.context;
    if (!query)
      throw new HttpsError("invalid-argument", "A question is required.");
    if (!context || JSON.stringify(context).length > 120000)
      throw new HttpsError(
        "invalid-argument",
        "Assistant context is invalid or too large.",
      );

    const system =
      language === "nl"
        ? "Je bent de behulpzame AIMS-platformassistent. Voer een normaal gesprek en beantwoord algemene vragen over het gebruik, de schermen, modules en workflows van AIMS aan de hand van platformGuide. Gebruik voor actuele aantallen en records uitsluitend permittedCategories en verzin nooit gegevens. Leg bij actievragen duidelijk uit welke stappen de gebruiker zelf in AIMS kan volgen; voer zelf geen wijzigingen uit. Als toegang ontbreekt, leg de rolbeperking uit. Antwoord helder en natuurlijk in het Nederlands. Retourneer uitsluitend geldige JSON met answer, workflowKey en citationIds."
        : "You are the helpful AIMS platform assistant. Hold a natural conversation and answer general questions about using AIMS, its screens, modules, and workflows using platformGuide. For current counts and records, use only permittedCategories and never invent data. For action requests, clearly explain the steps the user can follow in AIMS; never perform changes yourself. Explain role restrictions when access is missing. Answer clearly and naturally in English. Return only valid JSON with answer, workflowKey, and citationIds.";
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicApiKey.value(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        temperature: 0.2,
        system,
        messages: [
          {
            role: "user",
            content: `${language === "nl" ? "Vraag" : "Question"}: ${query}\n\nContext: ${JSON.stringify(context)}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      console.error("Anthropic request failed", response.status);
      throw new HttpsError(
        "unavailable",
        "The AI provider is temporarily unavailable.",
      );
    }
    const payload = await response.json();
    const text = payload?.content?.find((item) => item.type === "text")?.text;
    if (!text)
      throw new HttpsError("internal", "The AI provider returned no answer.");
    try {
      return JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      return { answer: text, workflowKey: "none", citationIds: [] };
    }
  },
);

/**
 * Phase 3 — one-way export: read the live Firestore collections and rewrite
 * the mirror Google Sheet. Read-only against Firestore; no write-back, no sync
 * metadata is stored. Admin-only. Idempotent — each run fully replaces the
 * tab contents.
 */
export const exportAimsToSheets = onCall(
  {
    region: "southamerica-east1",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    if (!isAdmin(request))
      throw new HttpsError(
        "permission-denied",
        "An AIMS administrator account is required.",
      );

    const spreadsheetId = String(
      request.data?.spreadsheetId || syncSpreadsheetId.value() || "",
    ).trim();
    if (!spreadsheetId)
      throw new HttpsError(
        "failed-precondition",
        "No target spreadsheet is configured. Set AIMS_SYNC_SPREADSHEET_ID.",
      );

    const db = getFirestore();
    const names = [
      "assets",
      "inventoryItems",
      "assetHistoryEvents",
      "locations",
      "departments",
      "categories",
      "codeGroups",
    ];

    let collections;
    try {
      const snapshots = await Promise.all(
        names.map((name) => db.collection(name).get()),
      );
      collections = Object.fromEntries(
        names.map((name, index) => [
          name,
          snapshots[index].docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        ]),
      );
    } catch (error) {
      console.error("Firestore read for export failed", error?.message);
      throw new HttpsError("internal", "Could not read AIMS data for export.");
    }

    const syncedAt = new Date().toISOString();
    const workbook = buildWorkbook(collections, { syncedAt });

    let rows;
    try {
      rows = await exportWorkbook(spreadsheetId, workbook);
    } catch (error) {
      console.error("Sheets export failed", error?.message);
      throw new HttpsError(
        "unavailable",
        "The export to Google Sheets could not be completed.",
      );
    }

    return { ok: true, syncedAt, rows };
  },
);

/**
 * Phase 4 — Sheets -> AIMS write-back. Dry-run by default: returns a plan and
 * writes nothing. Pass { apply: true } (only from an explicit, confirmed admin
 * action) to execute it. Identifier / status / location / assignment changes are
 * reported as conflicts and never applied; new asset rows are reported, not
 * created. On apply, the affected rows' system columns are pushed back so the
 * sheet stays coherent.
 */
export const importAimsFromSheets = onCall(
  {
    region: "southamerica-east1",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    if (!isAdmin(request))
      throw new HttpsError(
        "permission-denied",
        "An AIMS administrator account is required.",
      );

    const spreadsheetId = String(
      request.data?.spreadsheetId || syncSpreadsheetId.value() || "",
    ).trim();
    if (!spreadsheetId)
      throw new HttpsError(
        "failed-precondition",
        "No target spreadsheet is configured. Set AIMS_SYNC_SPREADSHEET_ID.",
      );

    const apply = request.data?.apply === true;
    const db = getFirestore();
    const names = [
      "assets",
      "inventoryItems",
      "locations",
      "departments",
      "categories",
      "codeGroups",
    ];

    let current;
    try {
      const snapshots = await Promise.all(
        names.map((name) => db.collection(name).get()),
      );
      current = Object.fromEntries(
        names.map((name, index) => [
          name,
          snapshots[index].docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        ]),
      );
    } catch (error) {
      console.error("Firestore read for import failed", error?.message);
      throw new HttpsError("internal", "Could not read AIMS data for import.");
    }

    let workbook;
    try {
      workbook = await readTabs(spreadsheetId, [
        ...IMPORT_TABS,
        "History Log",
        "Trash",
      ]);
    } catch (error) {
      console.error("Sheets read failed", error?.message);
      throw new HttpsError(
        "unavailable",
        "The Google Sheet could not be read. Check that it is shared with the service account.",
      );
    }

    const syncedAt = new Date().toISOString();
    const plan = planImport({ workbook, current }, { syncedAt });

    const cap = (arr) => arr.slice(0, 500);
    if (!apply) {
      return {
        ok: true,
        applied: false,
        syncedAt,
        summary: plan.summary,
        updates: cap(plan.updates),
        creates: cap(plan.creates),
        trashes: cap(plan.trashes),
        restores: cap(plan.restores),
        conflicts: cap(plan.conflicts),
        corrections: cap(plan.corrections),
        needsAimsCreate: cap(plan.needsAimsCreate),
        errors: cap(plan.errors),
      };
    }

    let results;
    try {
      results = await applyPlan(db, FieldValue, plan);
    } catch (error) {
      console.error("Import apply failed", error?.message);
      throw new HttpsError("internal", "Applying the import failed part-way.");
    }

    let cellsWritten = 0;
    try {
      cellsWritten = await writeCells(
        spreadsheetId,
        results.writeBack,
        TAB_HEADERS,
      );
    } catch (error) {
      console.error("Sheet write-back failed (non-fatal)", error?.message);
    }

    return {
      ok: true,
      applied: true,
      syncedAt,
      summary: {
        updated: results.updated.length,
        created: results.created.length,
        trashed: results.trashed.length,
        restored: results.restored.length,
        corrected: results.corrected.length,
        skipped: results.skipped.length,
        conflicts: plan.summary.conflicts,
        needsAimsCreate: plan.summary.needsAimsCreate,
        errors: plan.summary.errors,
        cellsWritten,
      },
      results: {
        updated: cap(results.updated),
        created: cap(results.created),
        trashed: cap(results.trashed),
        restored: cap(results.restored),
        corrected: cap(results.corrected),
        skipped: cap(results.skipped),
      },
      conflicts: cap(plan.conflicts),
      needsAimsCreate: cap(plan.needsAimsCreate),
      errors: cap(plan.errors),
    };
  },
);

/**
 * Phase 6 — resolve one `protected-field` conflict by force-applying the sheet's
 * value for the chosen fields (identifier fields are refused). Admin-only. Same
 * `Sync Version` guard and sheet write-back as a normal apply.
 */
export const resolveSyncConflict = onCall(
  { region: "southamerica-east1", timeoutSeconds: 120, memory: "256MiB" },
  async (request) => {
    if (!isAdmin(request))
      throw new HttpsError(
        "permission-denied",
        "An AIMS administrator account is required.",
      );

    const spreadsheetId = String(
      request.data?.spreadsheetId || syncSpreadsheetId.value() || "",
    ).trim();
    const tab = String(request.data?.tab || "").trim();
    const rowNum = Number(request.data?.row || 0);
    const recordId = String(request.data?.recordId || "").trim();
    const fields = Array.isArray(request.data?.fields)
      ? request.data.fields.map((f) => String(f))
      : [];
    if (!spreadsheetId || !tab || !rowNum || !recordId || !fields.length)
      throw new HttpsError(
        "invalid-argument",
        "tab, row, recordId and fields are required.",
      );

    let grid;
    try {
      const wb = await readTabs(spreadsheetId, [tab]);
      grid = wb[tab];
    } catch (error) {
      console.error("Sheets read failed", error?.message);
      throw new HttpsError("unavailable", "The Google Sheet could not be read.");
    }
    if (!grid || grid.length < 2 || !grid[rowNum - 1])
      throw new HttpsError("failed-precondition", "That sheet row no longer exists.");
    const header = grid[0].map((h) => String(h ?? ""));
    const row = grid[rowNum - 1].map((c) => String(c ?? ""));
    const idCol = header.indexOf("Record ID");
    if (idCol < 0 || row[idCol].trim() !== recordId)
      throw new HttpsError(
        "failed-precondition",
        "The sheet row's Record ID no longer matches — re-export and re-check.",
      );

    const db = getFirestore();
    const { collection, baseVersion, patch, changes, noop, errors } = forcePatch({
      tab,
      header,
      row,
      doc: await db
        .collection(collectionForTab(tab) || "__none__")
        .doc(recordId)
        .get()
        .then((s) => (s.exists ? { id: s.id, ...s.data() } : {})),
      fields,
    });
    if (errors.length)
      throw new HttpsError("failed-precondition", errors.join("; "));
    if (!Object.keys(patch).length)
      return { ok: true, applied: false, message: "Nothing to apply — the sheet already matches AIMS.", noop };

    const ref = db.collection(collection).doc(recordId);
    let newVersion;
    try {
      newVersion = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error("record vanished");
        const current = Number(snap.data().syncVersion ?? 0) || 0;
        if (current !== baseVersion) throw new Error("version-race");
        const next = current + 1;
        tx.set(
          ref,
          {
            ...patch,
            syncVersion: next,
            syncSource: "SHEETS",
            updatedBy: "sheets-sync",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return next;
      });
    } catch (error) {
      if (error.message === "version-race")
        throw new HttpsError(
          "failed-precondition",
          "This record changed in AIMS since the sheet was exported. Re-export and re-check.",
        );
      throw new HttpsError("internal", "The conflict could not be resolved.");
    }

    const now = new Date().toISOString();
    try {
      await writeCells(
        spreadsheetId,
        [
          {
            tab,
            row: rowNum,
            cells: {
              "Sync Version": String(newVersion),
              "Sync Status": "SYNCED",
              Source: "SHEETS",
              "Updated At": now,
              "Last Synced At": now,
            },
          },
        ],
        TAB_HEADERS,
      );
    } catch (error) {
      console.error("Write-back failed (non-fatal)", error?.message);
    }

    return { ok: true, applied: true, syncVersion: newVersion, changes };
  },
);
