/**
 * Retype 220 Device-typed assets to the owner's new middeltype vocabulary
 * based on codePrefix.
 * Usage: node scripts/retype-device-assets.mjs --dry-run | --apply
 */
import { execFileSync } from "node:child_process";

const projectId = "aims-asset-inventory-system";
const apply = process.argv.includes("--apply");
if (!apply && !process.argv.includes("--dry-run"))
  throw new Error("Use --dry-run or --apply.");

// codePrefix → nieuwe middeltype. Anything missing wordt overgeslagen en
// in het rapport als "untyped" vermeld.
const MAPPING = {
  KCSL: "Computer",
  KCSDESK: "Computer",
  KCSMD: "Computer",
  KHL: "Computer",
  KCSPW: "Computer",
  KSCL: "Computer", // typo-variant van KCSL
  KCSDB: "Display & Presentation",
  MON: "Display & Presentation",
  PR: "Printer",
  SCN: "Printer",
  UPS: "Battery backup/UPS",
  KCSMOB: "Mobiel",
  TAB: "Tablet",
};

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const gcloud =
  "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd";
const token = execFileSync(
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ["-NoProfile", "-Command", `& '${gcloud}' auth print-access-token`],
  { encoding: "utf8" },
).trim();

async function api(path, options = {}) {
  const r = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
async function list(coll) {
  const docs = [];
  let tok = "";
  do {
    const q = new URLSearchParams({ pageSize: "500" });
    if (tok) q.set("pageToken", tok);
    const r = await api(`/${coll}?${q}`);
    docs.push(...(r.documents || []));
    tok = r.nextPageToken || "";
  } while (tok);
  return docs;
}
const dec = (v) => (v && "stringValue" in v ? v.stringValue : undefined);
const now = new Date().toISOString();

const assets = await list("assets");
const devices = assets.filter((d) => dec(d.fields.type) === "Device");

const plan = [];
const untyped = [];
for (const d of devices) {
  const prefix = dec(d.fields.codePrefix) || "";
  const newType = MAPPING[prefix];
  if (!newType) {
    untyped.push({ code: dec(d.fields.code), prefix });
    continue;
  }
  plan.push({
    name: d.name,
    code: dec(d.fields.code),
    prefix,
    after: newType,
    updateTime: d.updateTime,
  });
}

const summary = Object.fromEntries(
  Object.values(MAPPING)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((type) => [
      type,
      plan.filter((p) => p.after === type).length,
    ]),
);
const untypedSummary = untyped.reduce((acc, u) => {
  acc[u.prefix] = (acc[u.prefix] || 0) + 1;
  return acc;
}, {});

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      total: plan.length,
      perType: summary,
      skipped: untyped.length,
      skippedPerPrefix: untypedSummary,
    },
    null,
    2,
  ),
);
if (!apply) process.exit(0);

const writes = plan.map((p) => ({
  update: {
    name: p.name,
    fields: {
      type: { stringValue: p.after },
      updatedAt: { timestampValue: now },
      updatedBy: { stringValue: "owner-device-retype" },
      lastUpdated: { stringValue: now.slice(0, 10) },
      lastModifiedBy: { stringValue: "owner-device-retype" },
    },
  },
  updateMask: {
    fieldPaths: [
      "type",
      "updatedAt",
      "updatedBy",
      "lastUpdated",
      "lastModifiedBy",
    ],
  },
  currentDocument: { updateTime: p.updateTime },
}));
writes.push({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/activityLogs/device-retype-${Date.now()}`,
    fields: {
      action: { stringValue: "assets.type.bulkRetype" },
      entityType: { stringValue: "asset" },
      entityId: { stringValue: "device-retype-batch" },
      actorUserId: { stringValue: "owner-device-retype" },
      actorEmail: { stringValue: "aliendas@kangoeroeschool.com" },
      reason: {
        stringValue:
          "Retype Device assets by codePrefix to new Middeltype vocabulary.",
      },
      after: {
        mapValue: {
          fields: Object.fromEntries(
            Object.entries(summary).map(([k, v]) => [
              k,
              { integerValue: String(v) },
            ]),
          ),
        },
      },
      createdAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
      updatedBy: { stringValue: "owner-device-retype" },
    },
  },
});

// Writes moeten in batches van <= 500 per commit.
for (let i = 0; i < writes.length; i += 400) {
  const chunk = writes.slice(i, i + 400);
  await api(":commit", { method: "POST", body: JSON.stringify({ writes: chunk }) });
}
console.log(JSON.stringify({ applied: true, writes: writes.length }, null, 2));
