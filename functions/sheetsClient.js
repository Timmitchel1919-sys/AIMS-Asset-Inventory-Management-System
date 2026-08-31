/**
 * Phase 3 — Google Sheets API client (write to the Sheet only).
 *
 * Uses Application Default Credentials: on Cloud Functions this is the
 * function's runtime service account. That account must be granted access by
 * sharing the target spreadsheet with its email as an Editor — see
 * SHEETS_EXPORT.md. No service-account key file is used or stored.
 *
 * Only three operations are needed for a one-way export:
 *   - read the tab list         GET  spreadsheets/{id}
 *   - create any missing tabs   POST spreadsheets/{id}:batchUpdate
 *   - replace a tab's values    POST values/{range}:clear  +  PUT values/{range}
 *
 * Nothing here reads or writes Firestore.
 */

import { GoogleAuth } from "google-auth-library";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

let authClientPromise;
async function accessToken() {
  if (!authClientPromise) {
    authClientPromise = new GoogleAuth({ scopes: [SCOPE] }).getClient();
  }
  const client = await authClientPromise;
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Could not obtain a Google access token.");
  return token;
}

async function api(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message || "";
    } catch {
      /* ignore */
    }
    throw new Error(`Sheets API ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.status === 204 ? null : res.json();
}

const quote = (title) => `'${String(title).replace(/'/g, "''")}'`;

/**
 * Replace the full contents of the given tabs with `workbook`.
 * @param {string} spreadsheetId
 * @param {Record<string, string[][]>} workbook  tab -> [headerRow, ...rows]
 * @returns {Promise<Record<string, number>>} tab -> data-row count written
 */
export async function exportWorkbook(spreadsheetId, workbook) {
  if (!spreadsheetId) throw new Error("A target spreadsheet id is required.");
  const token = await accessToken();
  const titles = Object.keys(workbook);

  const meta = await api(
    token,
    `${BASE}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties(title)`,
  );
  const existing = new Set((meta.sheets || []).map((sheet) => sheet.properties?.title));
  const missing = titles.filter((title) => !existing.has(title));

  if (missing.length) {
    await api(
      token,
      `${BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
        }),
      },
    );
  }

  const summary = {};
  for (const title of titles) {
    const values = workbook[title];
    const range = `${quote(title)}!A1:ZZ`;
    await api(
      token,
      `${BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`,
      { method: "POST", body: "{}" },
    );
    await api(
      token,
      `${BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
        `${quote(title)}!A1`,
      )}?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values }) },
    );
    summary[title] = Math.max(0, values.length - 1);
  }
  return summary;
}
