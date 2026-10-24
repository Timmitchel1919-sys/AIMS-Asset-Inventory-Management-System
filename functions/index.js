import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import {
  DEFAULT_ACCESS_PERMISSIONS,
  DEFAULT_ACCESS_ROLE,
} from "./accessDefaults.js";
import { buildWorkbook, TAB_HEADERS } from "./sheetsExport.js";
import { exportWorkbook, readTabs, writeCells } from "./sheetsClient.js";
import {
  collectionForTab,
  forcePatch,
  IMPORT_TABS,
  planImport,
} from "./sheetsImport.js";
import { applyPlan } from "./applyImport.js";
import { readHealth, recordRun } from "./syncRuns.js";
import {
  MasterDataError,
  archiveMasterData as archiveMasterDataImpl,
  checkDependencies,
} from "./masterData.js";
import {
  DISCOVERY_COMMAND,
  ENROLLMENT_TTL_MS,
  REQUEST_TTL_MS,
  bearerToken,
  normalizeAgentId,
  normalizedDiscoveryResult,
  parseAuthorizedScope,
  randomToken,
  sha256,
  signCommand,
} from "./discovery.js";

initializeApp();
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
// Not a secret — a spreadsheet id is not sensitive. Set it in functions/.env
// (or .env.aims-asset-inventory-system), or pass { spreadsheetId } in the call.
const syncSpreadsheetId = defineString("AIMS_SYNC_SPREADSHEET_ID", {
  default: "",
});
// Cloud Scheduler cron for the automatic sheet refresh. Change here + redeploy
// to adjust the cadence (App Engine cron syntax or "every N hours").
const SYNC_EXPORT_SCHEDULE = "every 24 hours";
const SCHOOL_DOMAIN = "kangoeroeschool.com";
const OWNER_EMAIL = "aliendas@kangoeroeschool.com";

function authorized(request) {
  const email = String(request.auth?.token?.email || "")
    .trim()
    .toLowerCase();
  return (
    request.auth?.token?.email_verified === true &&
    email.endsWith(`@${SCHOOL_DOMAIN}`)
  );
}

// Every verified school account has full ("super admin") rights, including
// the admin-only Cloud Functions below — mirrors hasPermission() in
// firestore.rules and rolePermissions in src/auth/permissions.ts.
function isAdmin(request) {
  return authorized(request);
}

function isOwnerRequest(request) {
  return authorized(request) && String(request.auth?.token?.email || "").trim().toLowerCase() === OWNER_EMAIL;
}

/**
 * Provision the baseline access assignment for a verified school account.
 *
 * A newly registered, email-verified user has no Auth custom claims yet, so
 * Firestore Rules would deny every operational read/write. This trusted
 * function creates the first `accessAssignments/{uid}` document with the
 * default role, matching the application's fallback role. It is idempotent and
 * never overwrites an administrator-customized or suspended assignment. An
 * untouched "pristine" assignment (default role, no denials, all-records, no
 * scope restrictions) is refreshed to the latest default permission set so
 * baseline rights follow product updates automatically.
 */
export const provisionUserAccess = onCall(
  { region: "southamerica-east1", timeoutSeconds: 60, memory: "256MiB" },
  async (request) => {
    if (!authorized(request))
      throw new HttpsError(
        "permission-denied",
        "A verified school account is required.",
      );
    const db = getFirestore();
    const uid = String(request.auth?.uid || "");
    if (!uid)
      throw new HttpsError("unauthenticated", "Sign in to provision access.");
    const ref = db.collection("accessAssignments").doc(uid);
    try {
      const existing = await ref.get();
      if (existing.exists) {
        const data = existing.data();
        if (data?.active === false)
          return { ok: true, active: false, reason: "suspended" };
        const isPristine =
          data?.role === DEFAULT_ACCESS_ROLE &&
          Array.isArray(data?.denials) &&
          data.denials.length === 0 &&
          data?.allRecords === true &&
          Array.isArray(data?.departmentIds) &&
          data.departmentIds.length === 0 &&
          Array.isArray(data?.locationIds) &&
          data.locationIds.length === 0;
        const permissionsMatch =
          Array.isArray(data?.permissions) &&
          data.permissions.length === DEFAULT_ACCESS_PERMISSIONS.length &&
          data.permissions.every((p, i) => p === DEFAULT_ACCESS_PERMISSIONS[i]);
        if (isPristine && !permissionsMatch) {
          await ref.update({
            permissions: DEFAULT_ACCESS_PERMISSIONS,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: uid,
          });
          return { ok: true, active: true, reason: "upgraded" };
        }
        return { ok: true, active: true, reason: "existing" };
      }
      await ref.create({
        uid,
        role: DEFAULT_ACCESS_ROLE,
        permissions: DEFAULT_ACCESS_PERMISSIONS,
        denials: [],
        active: true,
        allRecords: true,
        departmentIds: [],
        locationIds: [],
        createdAt: FieldValue.serverTimestamp(),
        createdBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      });
      return { ok: true, active: true, reason: "created" };
    } catch (error) {
      if (error?.code === 6 || error?.code === "already-exists")
        return { ok: true, active: true, reason: "existing" };
      console.error("Access provisioning failed", error?.message);
      throw new HttpsError(
        "internal",
        "Default access could not be provisioned. Notify ICT Support.",
      );
    }
  },
);

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

const EXPORT_COLLECTIONS = [
  "assets",
  "inventoryItems",
  "assetHistoryEvents",
  "locations",
  "departments",
  "categories",
  "codeGroups",
];

/** Read every synced collection and fully rewrite the mirror sheet. */
async function runFullExport(db, spreadsheetId) {
  const snapshots = await Promise.all(
    EXPORT_COLLECTIONS.map((name) => db.collection(name).get()),
  );
  const collections = Object.fromEntries(
    EXPORT_COLLECTIONS.map((name, index) => [
      name,
      snapshots[index].docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    ]),
  );
  const syncedAt = new Date().toISOString();
  const rows = await exportWorkbook(
    spreadsheetId,
    buildWorkbook(collections, { syncedAt }),
  );
  return { syncedAt, rows };
}

/**
 * Phase 3 — one-way export: read the live Firestore collections and rewrite
 * the mirror Google Sheet. Read-only against Firestore. Admin-only. Idempotent.
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
    const startedAt = Date.now();
    try {
      const { syncedAt, rows } = await runFullExport(db, spreadsheetId);
      await recordRun(db, FieldValue, {
        kind: "export",
        trigger: "manual",
        ok: true,
        startedAt,
        summary: { rows },
      });
      return { ok: true, syncedAt, rows };
    } catch (error) {
      console.error("Sheets export failed", error?.message);
      await recordRun(db, FieldValue, {
        kind: "export",
        trigger: "manual",
        ok: false,
        startedAt,
        error: error?.message,
      });
      throw new HttpsError(
        "unavailable",
        "The export to Google Sheets could not be completed.",
      );
    }
  },
);

/**
 * Phase 8 — automatic sheet refresh on a schedule. Full replace = drift repair
 * for the AIMS -> Sheet direction. Read-only against Firestore.
 */
export const scheduledSheetExport = onSchedule(
  {
    schedule: SYNC_EXPORT_SCHEDULE,
    region: "southamerica-east1",
    timeZone: "America/Paramaribo",
    timeoutSeconds: 300,
    memory: "512MiB",
    retryCount: 2,
  },
  async () => {
    const spreadsheetId = String(syncSpreadsheetId.value() || "").trim();
    const db = getFirestore();
    const startedAt = Date.now();
    if (!spreadsheetId) {
      await recordRun(db, FieldValue, {
        kind: "export",
        trigger: "schedule",
        ok: false,
        startedAt,
        error: "AIMS_SYNC_SPREADSHEET_ID is not set",
      });
      return;
    }
    try {
      const { rows } = await runFullExport(db, spreadsheetId);
      await recordRun(db, FieldValue, {
        kind: "export",
        trigger: "schedule",
        ok: true,
        startedAt,
        summary: { rows },
      });
    } catch (error) {
      console.error("Scheduled export failed", error?.message);
      await recordRun(db, FieldValue, {
        kind: "export",
        trigger: "schedule",
        ok: false,
        startedAt,
        error: error?.message,
      });
      throw error; // let Cloud Scheduler retry (retryCount)
    }
  },
);

/** Phase 8 — latest sync-run health for the admin UI. */
export const getSyncHealth = onCall(
  { region: "southamerica-east1", timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    if (!isAdmin(request))
      throw new HttpsError(
        "permission-denied",
        "An AIMS administrator account is required.",
      );
    try {
      return { ok: true, ...(await readHealth(getFirestore())) };
    } catch (error) {
      console.error("readHealth failed", error?.message);
      return { ok: true, latest: null, recent: [] };
    }
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

    const startedAt = Date.now();
    let results;
    try {
      results = await applyPlan(db, FieldValue, plan);
    } catch (error) {
      console.error("Import apply failed", error?.message);
      await recordRun(db, FieldValue, {
        kind: "import",
        ok: false,
        startedAt,
        error: error?.message,
      });
      throw new HttpsError("internal", "Applying the import failed part-way.");
    }
    await recordRun(db, FieldValue, {
      kind: "import",
      ok: results.skipped.length === 0,
      startedAt,
      summary: {
        updated: results.updated.length,
        created: results.created.length,
        trashed: results.trashed.length,
        restored: results.restored.length,
        corrected: results.corrected.length,
        skipped: results.skipped.length,
        conflicts: plan.summary.conflicts,
      },
    });

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

    await recordRun(db, FieldValue, {
      kind: "resolve",
      ok: true,
      startedAt: Date.now(),
      summary: { tab, recordId, fields, syncVersion: newVersion },
    });
    return { ok: true, applied: true, syncVersion: newVersion, changes };
  },
);

/** Trusted, audited code-group prefix migration. All active AIMS users may request it;
 * direct client writes remain unable to change code prefixes or asset codes. */
export const renameCodeGroupPrefix = onCall(
  { region: "southamerica-east1", timeoutSeconds: 60, memory: "512MiB" },
  async (request) => {
    if (!authorized(request)) throw new HttpsError("permission-denied", "A verified AIMS account is required.");
    const uid = String(request.auth?.uid || "");
    const groupId = String(request.data?.groupId || "").trim();
    const prefix = String(request.data?.prefix || "").trim().toUpperCase();
    const name = String(request.data?.name || "").trim();
    if (!uid || !groupId || !name || !/^[A-Z0-9]{1,16}$/.test(prefix))
      throw new HttpsError("invalid-argument", "A code-group name and an alphanumeric prefix are required.");
    const db = getFirestore();
    const assignment = await db.collection("accessAssignments").doc(uid).get();
    if (!assignment.exists || assignment.data()?.active !== true)
      throw new HttpsError("permission-denied", "Your AIMS access is inactive.");
    const groupRef = db.collection("codeGroups").doc(groupId);
    const group = await groupRef.get();
    if (!group.exists) throw new HttpsError("not-found", "Code group not found.");
    const before = group.data();
    const oldPrefix = String(before.prefix || "").toUpperCase();
    const duplicate = await db.collection("codeGroups").where("prefix", "==", prefix).limit(1).get();
    if (!duplicate.empty && duplicate.docs[0].id !== groupId)
      throw new HttpsError("already-exists", "Code prefix already exists.");
    const assets = await db.collection("assets").where("codePrefix", "==", oldPrefix).get();
    const categories = await db.collection("categories").where("details.codeGroup", "==", oldPrefix).get();
    if (assets.size + categories.size > 400)
      throw new HttpsError("failed-precondition", "Too many linked records for one safe prefix migration. Contact ICT Support.");
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();
    batch.update(groupRef, { name, prefix, updatedAt: now, updatedBy: uid });
    for (const doc of assets.docs) {
      const asset = doc.data(), number = Number(asset.codeNumber);
      const code = `${prefix}-${number < 100 ? String(number).padStart(2, "0") : number}`;
      batch.update(doc.ref, { code, codePrefix: prefix, previousCodes: [...new Set([...(asset.previousCodes || []), asset.code])], lastUpdated: new Date().toISOString().slice(0, 10), lastModifiedBy: uid, updatedAt: now, updatedBy: uid });
    }
    for (const doc of categories.docs) batch.update(doc.ref, { "details.codeGroup": prefix, updatedAt: now, updatedBy: uid });
    batch.set(db.collection("activityLogs").doc(), { action: "codeGroup.prefix.rename", entityType: "codeGroup", entityId: groupId, actorUserId: uid, actorEmail: request.auth.token.email || "", before: { name: before.name, prefix: oldPrefix, linkedAssets: assets.size, linkedCategories: categories.size }, after: { name, prefix }, createdAt: now, updatedAt: now, updatedBy: uid });
    await batch.commit();
    return { ok: true, groupId, prefix, assetsUpdated: assets.size, categoriesUpdated: categories.size };
  },
);
/**
 * Trusted, audited correction of one official asset code. Client writes keep
 * code/codePrefix/codeNumber immutable; this path reserves the replacement
 * code, preserves the old code and records the reason without deleting the
 * asset or its history.
 */
export const correctAssetCode = onCall(
  { region: "southamerica-east1", timeoutSeconds: 60, memory: "256MiB" },
  async (request) => {
    if (!authorized(request))
      throw new HttpsError("permission-denied", "A verified AIMS account is required.");
    const uid = String(request.auth?.uid || "");
    const assetId = String(request.data?.assetId || "").trim();
    const reason = String(request.data?.reason || "").trim();
    const compactCode = String(request.data?.code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    const codeMatch = compactCode.match(/^([A-Z][A-Z0-9]{1,15})-(\d{1,9})$/);
    if (!uid || !assetId || !codeMatch || reason.length < 3 || reason.length > 1000)
      throw new HttpsError("invalid-argument", "Provide an asset, a valid official code, and a correction reason.");
    const [, codePrefix, codeNumberText] = codeMatch;
    const codeNumber = Number(codeNumberText);
    const code = `${codePrefix}-${codeNumber < 100 ? String(codeNumber).padStart(2, "0") : codeNumber}`;
    const db = getFirestore();
    const assignment = await db.collection("accessAssignments").doc(uid).get();
    const assignmentData = assignment.data();
    if (!assignment.exists || assignmentData?.active !== true)
      throw new HttpsError("permission-denied", "Your AIMS access is inactive.");
    if (!['administrator', 'ict-staff'].includes(String(assignmentData.role || '')))
      throw new HttpsError("permission-denied", "Only authorized ICT administrators may correct official asset codes.");
    const assetRef = db.collection("assets").doc(assetId);
    const codeRef = db.collection("assetCodes").doc(code);
    const groupQuery = db.collection("codeGroups").where("prefix", "==", codePrefix).limit(1);
    await db.runTransaction(async (transaction) => {
      const [assetSnapshot, codeSnapshot, groupSnapshot, currentCode, historicCode] = await Promise.all([
        transaction.get(assetRef),
        transaction.get(codeRef),
        transaction.get(groupQuery),
        transaction.get(db.collection("assets").where("code", "==", code).limit(1)),
        transaction.get(db.collection("assets").where("previousCodes", "array-contains", code).limit(1)),
      ]);
      if (!assetSnapshot.exists)
        throw new HttpsError("not-found", "Asset not found.");
      if (groupSnapshot.empty || groupSnapshot.docs[0].data().isActive === false)
        throw new HttpsError("failed-precondition", "The selected code group is not active.");
      const asset = assetSnapshot.data();
      if (asset.code === code) return;
      const usedByAnotherAsset = [currentCode, historicCode].some(
        (snapshot) => !snapshot.empty && snapshot.docs.some((doc) => doc.id !== assetId),
      );
      if (codeSnapshot.exists || usedByAnotherAsset)
        throw new HttpsError("already-exists", "This inventory code has already been used and cannot be reassigned.");
      const now = FieldValue.serverTimestamp();
      transaction.update(assetRef, {
        code,
        codePrefix,
        codeNumber,
        previousCodes: [...new Set([...(asset.previousCodes || []), asset.code])],
        lastUpdated: new Date().toISOString().slice(0, 10),
        lastModifiedBy: uid,
        updatedAt: now,
        updatedBy: uid,
      });
      transaction.set(codeRef, {
        code,
        codeGroupId: groupSnapshot.docs[0].id,
        reservedBy: uid,
        createdAt: now,
      });
      transaction.set(db.collection("activityLogs").doc(), {
        action: "asset.code.correct",
        entityType: "asset",
        entityId: assetId,
        actorUserId: uid,
        actorEmail: request.auth.token.email || "",
        reason,
        before: { code: asset.code, codePrefix: asset.codePrefix, codeNumber: asset.codeNumber },
        after: { code, codePrefix, codeNumber },
        createdAt: now,
        updatedAt: now,
        updatedBy: uid,
      });
    });
    return { ok: true, assetId, code };
  },
);

const masterDataError = (error) =>
  error instanceof MasterDataError
    ? new HttpsError(error.code, error.message, error.details)
    : error;

/** Read-only: what still references a code group, Hoofdlocatie, category or
 * asset type. Available to every verified AIMS account. */
export const checkMasterDataDependencies = onCall(
  { region: "southamerica-east1", timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    if (!authorized(request))
      throw new HttpsError("permission-denied", "A verified AIMS account is required.");
    try {
      return await checkDependencies(getFirestore(), {
        kind: String(request.data?.kind || ""),
        id: String(request.data?.id || ""),
        includeInactive: request.data?.includeInactive === true,
      });
    } catch (error) {
      throw masterDataError(error);
    }
  },
);

/** Trusted, dependency-aware archive/delete of a code group or Hoofdlocatie.
 * Firestore Rules forbid clients from doing this directly, so the deletion
 * policy (authorized administrator accounts only) and the dependency check
 * cannot be bypassed from the browser. */
export const archiveMasterData = onCall(
  { region: "southamerica-east1", timeoutSeconds: 60, memory: "256MiB" },
  async (request) => {
    if (!authorized(request))
      throw new HttpsError("permission-denied", "A verified AIMS account is required.");
    try {
      return await archiveMasterDataImpl(
        getFirestore(),
        {
          uid: String(request.auth?.uid || ""),
          email: String(request.auth?.token?.email || ""),
        },
        {
          kind: String(request.data?.kind || ""),
          id: String(request.data?.id || ""),
          mode: String(request.data?.mode || ""),
          reason: String(request.data?.reason || ""),
        },
        FieldValue.serverTimestamp(),
      );
    } catch (error) {
      throw masterDataError(error);
    }
  },
);

const discoveryOptions = { region: "southamerica-east1", timeoutSeconds: 60, memory: "256MiB" };
const discoveryHttpOptions = { region: "southamerica-east1", timeoutSeconds: 60, memory: "256MiB", cors: false };

function requireOwner(request) {
  if (!isOwnerRequest(request))
    throw new HttpsError("permission-denied", "Only the verified AIMS Owner can administer Network Discovery.");
}

function discoveryAudit(db, action, actor, entityType, entityId, details = {}) {
  const now = FieldValue.serverTimestamp();
  return db.collection("activityLogs").add({
    action,
    entityType,
    entityId,
    actorUserId: actor.uid || "discovery-agent",
    actorEmail: actor.email || "",
    details,
    result: details.result || "Success",
    createdAt: now,
    updatedAt: now,
    updatedBy: actor.uid || "discovery-agent",
  });
}

const httpError = (response, status, message) => response.status(status).json({ ok: false, error: message });
const dateMillis = (value) => typeof value?.toMillis === "function" ? value.toMillis() : Date.parse(value || "");

async function authenticateDiscoveryAgent(db, request) {
  const token = bearerToken(request.headers.authorization);
  if (!token) return null;
  const credentialHash = sha256(token);
  const snapshot = await db.collection("discoveryAgents").where("credentialHash", "==", credentialHash).limit(1).get();
  if (snapshot.empty) return null;
  const document = snapshot.docs[0];
  return { ref: document.ref, id: document.id, data: document.data(), credentialHash };
}

export const createDiscoveryEnrollment = onCall(discoveryOptions, async (request) => {
  requireOwner(request);
  let scope;
  try { scope = parseAuthorizedScope(request.data?.networkScope); }
  catch (error) { throw new HttpsError("invalid-argument", error.message); }
  const token = randomToken();
  const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MS);
  const ref = getFirestore().collection("discoveryEnrollments").doc();
  await ref.set({
    tokenHash: sha256(token),
    agentName: String(request.data?.agentName || "").trim().slice(0, 100) || "Discovery Agent",
    site: String(request.data?.site || "").trim().slice(0, 100) || "KCS",
    networkScope: scope.cidr,
    used: false,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
  });
  await discoveryAudit(getFirestore(), "DISCOVERY_ENROLLMENT_CREATED", { uid: request.auth.uid, email: request.auth.token.email }, "discoveryEnrollment", ref.id, { scope: scope.cidr });
  return { ok: true, enrollmentId: ref.id, enrollmentToken: token, expiresAt: expiresAt.toISOString() };
});

export const manageDiscoveryAgent = onCall(discoveryOptions, async (request) => {
  requireOwner(request);
  const agentId = normalizeAgentId(request.data?.agentId);
  const action = String(request.data?.action || "").toUpperCase();
  if (!["ENABLE", "DISABLE", "REVOKE", "UPDATE_SCOPE"].includes(action))
    throw new HttpsError("invalid-argument", "Unsupported agent action.");
  const db = getFirestore();
  const ref = db.collection("discoveryAgents").doc(agentId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Discovery agent not found.");
  const current = snapshot.data();
  if (current.status === "REVOKED" && action !== "REVOKE")
    throw new HttpsError("failed-precondition", "A revoked agent cannot be re-enabled or modified.");
  const patch = { updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid };
  if (action === "ENABLE") patch.status = "ACTIVE";
  if (action === "DISABLE") patch.status = "DISABLED";
  if (action === "REVOKE") Object.assign(patch, { status: "REVOKED", credentialHash: null, revokedAt: FieldValue.serverTimestamp() });
  if (action === "UPDATE_SCOPE") {
    try { patch.networkScope = parseAuthorizedScope(request.data?.networkScope).cidr; }
    catch (error) { throw new HttpsError("invalid-argument", error.message); }
  }
  await ref.update(patch);
  await discoveryAudit(db, `AGENT_${action === "UPDATE_SCOPE" ? "SCOPE_UPDATED" : action + "D"}`, { uid: request.auth.uid, email: request.auth.token.email }, "discoveryAgent", agentId, { beforeStatus: current.status, scope: patch.networkScope || current.networkScope });
  return { ok: true, agentId, status: patch.status || current.status };
});

export const requestNetworkDiscovery = onCall(discoveryOptions, async (request) => {
  requireOwner(request);
  const agentId = normalizeAgentId(request.data?.agentId);
  const db = getFirestore();
  const agentSnapshot = await db.collection("discoveryAgents").doc(agentId).get();
  if (!agentSnapshot.exists) throw new HttpsError("not-found", "Discovery agent not found.");
  const agent = agentSnapshot.data();
  if (agent.status !== "ACTIVE" || !agent.credentialHash)
    throw new HttpsError("failed-precondition", "Only an active authenticated agent can receive discovery requests.");
  let scope;
  try { scope = parseAuthorizedScope(request.data?.networkScope || agent.networkScope).cidr; }
  catch (error) { throw new HttpsError("invalid-argument", error.message); }
  if (scope !== agent.networkScope) {
    await discoveryAudit(db, "DISCOVERY_SCOPE_REJECTED", { uid: request.auth.uid, email: request.auth.token.email }, "discoveryAgent", agentId, { requestedScope: scope, authorizedScope: agent.networkScope, result: "Blocked" });
    throw new HttpsError("permission-denied", "Requested scope is not authorized for this agent.");
  }
  const ref = db.collection("discoveryRequests").doc();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + REQUEST_TTL_MS);
  const command = { command: DISCOVERY_COMMAND, requestId: ref.id, agentId, scope, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() };
  await ref.set({ ...command, signature: signCommand(command, agent.credentialHash), status: "QUEUED", requestedBy: request.auth.uid, requestedByEmail: request.auth.token.email, createdAt: FieldValue.serverTimestamp(), expiresAtDate: expiresAt });
  await discoveryAudit(db, "DISCOVERY_REQUESTED", { uid: request.auth.uid, email: request.auth.token.email }, "discoveryRequest", ref.id, { agentId, scope, command: DISCOVERY_COMMAND });
  return { ok: true, requestId: ref.id, expiresAt: command.expiresAt };
});

export const registerDiscoveryAgent = onRequest(discoveryHttpOptions, async (request, response) => {
  if (request.method !== "POST") return httpError(response, 405, "POST required.");
  const enrollmentToken = String(request.body?.enrollmentToken || "");
  if (!enrollmentToken) return httpError(response, 401, "Enrollment token required.");
  let agentId;
  try { agentId = normalizeAgentId(request.body?.agentId); }
  catch (error) { return httpError(response, 400, error.message); }
  const db = getFirestore();
  const enrollmentSnapshot = await db.collection("discoveryEnrollments").where("tokenHash", "==", sha256(enrollmentToken)).limit(1).get();
  if (enrollmentSnapshot.empty) return httpError(response, 403, "Invalid enrollment token.");
  const enrollmentRef = enrollmentSnapshot.docs[0].ref;
  const credential = randomToken();
  try {
    await db.runTransaction(async (transaction) => {
      const [enrollment, existing] = await Promise.all([transaction.get(enrollmentRef), transaction.get(db.collection("discoveryAgents").doc(agentId))]);
      const data = enrollment.data();
      if (existing.exists) throw new Error("DUPLICATE_AGENT");
      if (data.used || dateMillis(data.expiresAt) <= Date.now()) throw new Error("INVALID_ENROLLMENT");
      transaction.update(enrollmentRef, { used: true, usedAt: FieldValue.serverTimestamp(), agentId });
      transaction.create(db.collection("discoveryAgents").doc(agentId), {
        agentId,
        agentName: String(request.body?.agentName || data.agentName).trim().slice(0, 100),
        organization: String(request.body?.organization || data.site).trim().slice(0, 100),
        installationId: String(request.body?.installationId || "").trim().slice(0, 100),
        version: String(request.body?.version || "unknown").trim().slice(0, 40),
        operatingSystem: String(request.body?.operatingSystem || "unknown").trim().slice(0, 120),
        networkScope: data.networkScope,
        status: "PENDING",
        registrationState: "REGISTERED_PENDING_APPROVAL",
        credentialHash: sha256(credential),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    if (error.message === "DUPLICATE_AGENT") return httpError(response, 409, "Agent ID already exists.");
    return httpError(response, 403, "Enrollment token is expired or already used.");
  }
  await discoveryAudit(db, "AGENT_REGISTERED", { uid: agentId }, "discoveryAgent", agentId, { status: "PENDING" });
  return response.status(201).json({ ok: true, agentId, credential, networkScope: enrollmentSnapshot.docs[0].data().networkScope, status: "PENDING" });
});

export const discoveryAgentHeartbeat = onRequest(discoveryHttpOptions, async (request, response) => {
  if (request.method !== "POST") return httpError(response, 405, "POST required.");
  const db = getFirestore();
  const agent = await authenticateDiscoveryAgent(db, request);
  if (!agent) return httpError(response, 401, "Invalid agent credential.");
  if (["DISABLED", "REVOKED"].includes(agent.data.status)) return httpError(response, 403, `Agent is ${agent.data.status.toLowerCase()}.`);
  await agent.ref.update({
    lastHeartbeat: FieldValue.serverTimestamp(),
    version: String(request.body?.version || agent.data.version).slice(0, 40),
    operatingSystem: String(request.body?.operatingSystem || agent.data.operatingSystem).slice(0, 120),
    health: { uptimeSeconds: Math.max(0, Number(request.body?.uptimeSeconds) || 0), connectionState: "CONNECTED" },
    updatedAt: FieldValue.serverTimestamp(),
  });
  return response.json({ ok: true, agentId: agent.id, status: agent.data.status, serverTime: new Date().toISOString() });
});

export const pollDiscoveryCommand = onRequest(discoveryHttpOptions, async (request, response) => {
  if (request.method !== "GET") return httpError(response, 405, "GET required.");
  const db = getFirestore();
  const agent = await authenticateDiscoveryAgent(db, request);
  if (!agent) return httpError(response, 401, "Invalid agent credential.");
  if (agent.data.status !== "ACTIVE") return httpError(response, 403, "Agent is not active.");
  const snapshot = await db.collection("discoveryRequests").where("agentId", "==", agent.id).where("status", "==", "QUEUED").limit(10).get();
  for (const document of snapshot.docs.filter((candidate) => dateMillis(candidate.data().expiresAtDate) <= Date.now()))
    await document.ref.update({ status: "EXPIRED", completedAt: FieldValue.serverTimestamp() });
  const candidate = snapshot.docs.find((document) => dateMillis(document.data().expiresAtDate) > Date.now());
  if (!candidate) return response.json({ ok: true, command: null });
  const data = await db.runTransaction(async (transaction) => {
    const current = await transaction.get(candidate.ref);
    const value = current.data();
    if (!current.exists || value.status !== "QUEUED" || dateMillis(value.expiresAtDate) <= Date.now()) return null;
    transaction.update(candidate.ref, { status: "DISPATCHED", startedAt: FieldValue.serverTimestamp() });
    return value;
  });
  if (!data) return response.json({ ok: true, command: null });
  await discoveryAudit(db, "DISCOVERY_STARTED", { uid: agent.id }, "discoveryRequest", candidate.id, { agentId: agent.id, scope: data.scope });
  return response.json({ ok: true, command: { command: data.command, requestId: candidate.id, agentId: data.agentId, scope: data.scope, issuedAt: data.issuedAt, expiresAt: data.expiresAt, signature: data.signature } });
});

export const submitDiscoveryResults = onRequest(discoveryHttpOptions, async (request, response) => {
  if (request.method !== "POST") return httpError(response, 405, "POST required.");
  const db = getFirestore();
  const agent = await authenticateDiscoveryAgent(db, request);
  if (!agent) return httpError(response, 401, "Invalid agent credential.");
  if (agent.data.status !== "ACTIVE") return httpError(response, 403, "Agent is not active.");
  const requestId = String(request.body?.requestId || "");
  const requestRef = db.collection("discoveryRequests").doc(requestId);
  const claim = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists || snapshot.data().agentId !== agent.id) return { error: 404 };
    if (snapshot.data().status !== "DISPATCHED") return { error: 409 };
    if (dateMillis(snapshot.data().expiresAtDate) <= Date.now()) return { error: 410 };
    transaction.update(requestRef, { status: "PROCESSING", processingAt: FieldValue.serverTimestamp() });
    return { error: 0 };
  });
  if (claim.error === 404) return httpError(response, 404, "Discovery request not found.");
  if (claim.error === 409) return httpError(response, 409, "Discovery request is not awaiting results.");
  if (claim.error === 410) return httpError(response, 410, "Discovery request expired.");
  const rawResults = Array.isArray(request.body?.results) ? request.body.results.slice(0, 256) : [];
  let results;
  try { results = rawResults.map((result) => normalizedDiscoveryResult(result, agent.data.networkScope)); }
  catch (error) {
    await requestRef.update({ status: "REJECTED", error: String(error.message).slice(0, 500), completedAt: FieldValue.serverTimestamp() });
    await discoveryAudit(db, "DISCOVERY_SCOPE_REJECTED", { uid: agent.id }, "discoveryRequest", requestId, { error: error.message, result: "Blocked" });
    return httpError(response, 403, error.message);
  }
  const batch = db.batch();
  const prepared = await Promise.all(results.map(async (result) => {
    const id = sha256(`${agent.id}\n${result.macAddress || result.ipAddress}`).slice(0, 40);
    const ref = db.collection("discoveredDevices").doc(id);
    return { result, id, ref, exists: (await ref.get()).exists };
  }));
  for (const { result, id, ref, exists } of prepared) {
    batch.set(ref, { ...result, discoveryId: id, requestId, agentId: agent.id, ...(!exists ? { firstSeen: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() } : {}), lastSeen: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  batch.update(requestRef, { status: "COMPLETED", deviceCount: results.length, durationMs: Math.max(0, Number(request.body?.durationMs) || 0), completedAt: FieldValue.serverTimestamp(), error: null });
  batch.update(agent.ref, { lastScan: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  await discoveryAudit(db, "DISCOVERY_COMPLETED", { uid: agent.id }, "discoveryRequest", requestId, { deviceCount: results.length, scope: agent.data.networkScope });
  return response.json({ ok: true, requestId, deviceCount: results.length });
});
