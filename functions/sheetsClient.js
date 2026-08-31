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
async function adcToken() {
  if (!authClientPromise) {
    authClientPromise = new GoogleAuth({ scopes: [SCOPE] }).getClient();
  }
  const client = await authClientPromise;
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Could not obtain a Google access token.");
  return token;
}

let tokenProvider = adcToken;
const accessToken = () => tokenProvider();

/** Test seam — override how an access token is obtained. */
export function __setTokenProvider(fn) {
  tokenProvider = fn || adcToken;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Run `fn`, retrying with exponential back-off + jitter while `isRetryable`
 * says the failure is transient. Exported for testing.
 */
export async function withRetry(fn, { retries = 3, isRetryable, baseMs = 300 } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (error) {
      attempt += 1;
      if (attempt > retries || (isRetryable && !isRetryable(error))) throw error;
      const backoff = baseMs * 2 ** (attempt - 1) + Math.floor(Math.random() * baseMs);
      await sleep(backoff);
    }
  }
}

async function api(token, url, init = {}) {
  return withRetry(
    async () => {
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
        const err = new Error(
          `Sheets API ${res.status}${detail ? `: ${detail}` : ""}`,
        );
        err.status = res.status;
        throw err;
      }
      return res.status === 204 ? null : res.json();
    },
    { isRetryable: (e) => RETRYABLE_STATUS.has(e?.status) },
  );
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

const A1COL = (n) => {
  let s = "";
  n += 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/**
 * Read whole tabs. Phase 4 read side.
 * @returns {Promise<Record<string, string[][]>>} tab -> raw value grid
 */
export async function readTabs(spreadsheetId, tabs) {
  if (!spreadsheetId) throw new Error("A target spreadsheet id is required.");
  const token = await accessToken();
  const params = tabs
    .map((t) => `ranges=${encodeURIComponent(`${quote(t)}!A1:ZZ`)}`)
    .join("&");
  const body = await api(
    token,
    `${BASE}/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params}&majorDimension=ROWS`,
  );
  const out = {};
  (body.valueRanges || []).forEach((vr, i) => {
    // range like 'Master Inventory'!A1:ZZ1000 -> strip the !… and unquote
    const raw = (vr.range || "").split("!")[0].replace(/^'|'$/g, "").replace(/''/g, "'");
    out[raw || tabs[i]] = vr.values || [];
  });
  return out;
}

/**
 * Push individual cell values back to the sheet.
 * @param {Array<{ tab: string, row: number, cells: Record<string,string> }>} writeBack
 * @param {Record<string, string[]>} headersByTab  tab -> header row (for column lookup)
 */
export async function writeCells(spreadsheetId, writeBack, headersByTab) {
  if (!writeBack.length) return 0;
  const token = await accessToken();
  const data = [];
  for (const wb of writeBack) {
    const header = headersByTab[wb.tab] || [];
    for (const [col, value] of Object.entries(wb.cells)) {
      const idx = header.indexOf(col);
      if (idx < 0) continue;
      data.push({
        range: `${quote(wb.tab)}!${A1COL(idx)}${wb.row}`,
        values: [[value]],
      });
    }
  }
  if (!data.length) return 0;
  await api(
    token,
    `${BASE}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    },
  );
  return data.length;
}
