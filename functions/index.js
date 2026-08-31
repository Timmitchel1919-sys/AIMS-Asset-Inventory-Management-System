import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { buildWorkbook } from "./sheetsExport.js";
import { exportWorkbook } from "./sheetsClient.js";

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
