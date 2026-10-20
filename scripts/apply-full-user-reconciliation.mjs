import { execFileSync } from "node:child_process";

const projectId = "aims-asset-inventory-system";
const apply = process.argv.includes("--apply");
if (!apply && !process.argv.includes("--dry-run")) {
  console.log("Running in dry-run mode by default. Pass --apply to write.");
}

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const gcloud = "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd";
const token = execFileSync(
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ["-NoProfile", "-Command", `& '${gcloud}' auth print-access-token`],
  { encoding: "utf8" },
).trim();

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function list(collection) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const result = await api(`/${collection}?${query}`);
    documents.push(...(result.documents || []));
    pageToken = result.nextPageToken || "";
  } while (pageToken);
  return documents;
}

function decode(value) {
  if (!value) return undefined;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
  throw new Error(`Unsupported Firestore value: ${JSON.stringify(value)}`);
}

function data(document) {
  return Object.fromEntries(Object.entries(document.fields || {}).map(([key, item]) => [key, decode(item)]));
}

function encode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
}

const idOf = (document) => document.name.split("/").at(-1);

// Helpers for title casing
function titleCaseWord(w) {
  if (!w) return "";
  // Check special acronyms
  const upper = w.toUpperCase();
  if (upper === "ICT" || upper === "KCS" || upper === "KH" || upper === "HP" || upper === "PC" || upper === "USB" || upper === "UPS" || upper === "AP" || upper === "IT") {
    return upper;
  }
  // Check patterns like 3B, 4B, 1A
  if (/^\d+[A-Z]$/i.test(w)) {
    return w.toUpperCase();
  }
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function normalizeTitleCase(str) {
  if (!str) return str;
  return str.split(/(\s+)/).map(part => {
    if (/^\s+$/.test(part)) return part;
    return titleCaseWord(part);
  }).join("");
}

function normalizeSublocation(sub) {
  if (!sub) return "";
  const trimmed = sub.trim();
  const upper = trimmed.toUpperCase();
  if (upper === "ICT KANTOOR" || upper === "ICT KANTOOR" || upper === "ICT-KANTOOR") {
    return "ICT Kantoor";
  }
  if (upper === "ICT STORAGE" || upper === "ICT-STORAGE") {
    return "ICT Storage";
  }
  if (upper === "COMPUTER LOKAAL" || upper === "COMPUTERLOKAAL") {
    return "Computer lokaal";
  }
  // Check patterns like 3B, 4B, 7B, 1A, etc.
  if (/^\d+[A-Z]$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  // Check Groep patterns
  const mGroep = trimmed.match(/^Groep\s*(\d+[A-Z])$/i);
  if (mGroep) {
    return `Groep ${mGroep[1].toUpperCase()}`;
  }
  // Check Cabin patterns
  const mCabin = trimmed.match(/^Cabin\s*(\d+)$/i);
  if (mCabin) {
    return `Cabin ${mCabin[1]}`;
  }
  // Check Lokaal patterns
  const mLok = trimmed.match(/^Lokaal\s*(\d+)$/i);
  if (mLok) {
    return `Lokaal ${mLok[1]}`;
  }
  return normalizeTitleCase(trimmed);
}

function normalizeMainLocation(loc) {
  if (!loc) return "";
  const trimmed = loc.trim();
  const upper = trimmed.toUpperCase();
  if (upper.includes("BOVEBOUW") || upper.includes("BOVENBOUW") || upper.includes("BOVEN BOUW")) {
    return "KCS Boven bouw";
  }
  if (upper.includes("BASIS")) {
    return "KCS Basis";
  }
  if (upper.includes("KANGOEROE HIGH") || upper === "KH") {
    return "Kangoeroe High";
  }
  if (upper.includes("CABIN")) {
    return "Cabin";
  }
  return normalizeTitleCase(trimmed);
}

const [assetDocs, refDocs, locDocs] = await Promise.all([list("assets"), list("references"), list("locations")]);
const assets = assetDocs.map((doc) => ({ document: doc, id: idOf(doc), ...data(doc) }));
const refs = refDocs.map((doc) => ({ document: doc, id: idOf(doc), ...data(doc) }));
const locations = locDocs.map((doc) => ({ document: doc, id: idOf(doc), ...data(doc) }));

console.log(`Loaded ${assets.length} assets, ${refs.length} references, and ${locations.length} locations from Firestore.`);
console.log("Locations:", locations.map(l => ({ id: l.id, name: l.name, type: l.type })));

let updatedAssetsCount = 0;
const patches = [];

for (const asset of assets) {
  const updates = {};
  const code = asset.code || "";
  const codeUpper = code.toUpperCase();

  // 1. Barcode must equal inv.code
  if (asset.barcode !== code) {
    updates.barcode = code;
  }

  // 2. Sharp brand and digiborden
  const brandRaw = String(asset.brand || "");
  const nameRaw = String(asset.name || "");
  const modelRaw = String(asset.model || "");

  if (codeUpper.startsWith("KCSDB") || brandRaw.toLowerCase().includes("sharp")) {
    if (brandRaw.toLowerCase().includes("sharp")) {
      updates.brand = "Sharp";
      if (brandRaw.toLowerCase().includes("55 inch") || nameRaw.toLowerCase().includes("55 inch")) {
        updates.name = "Digibord 55 inch";
      } else if (brandRaw.toLowerCase().includes("80 inch") || nameRaw.toLowerCase().includes("80 inch")) {
        updates.name = "Digibord 80 inch";
      }
    }
  }

  // 3. Category mapping
  // Digiborden, Beamers/Projectors, Monitors -> Display & Presentation
  if (
    codeUpper.startsWith("KCSDB") ||
    codeUpper.startsWith("KCSBD") ||
    codeUpper.startsWith("KCSMON") ||
    nameRaw.toLowerCase().includes("digibord") ||
    nameRaw.toLowerCase().includes("projector") ||
    nameRaw.toLowerCase().includes("beamer") ||
    nameRaw.toLowerCase().includes("monitor") ||
    asset.category === "MONITOR" ||
    asset.category === "Digibords"
  ) {
    if (asset.category !== "Display & Presentation") {
      updates.category = "Display & Presentation";
    }
  }
  // Keyboards, mice -> Peripherals
  else if (
    codeUpper.startsWith("KB-") ||
    nameRaw.toLowerCase().includes("keyboard") ||
    nameRaw.toLowerCase().includes("keyborad") ||
    nameRaw.toLowerCase().includes("muis") ||
    nameRaw.toLowerCase().includes("mouse") ||
    asset.category === "MUIS WIRED"
  ) {
    if (asset.category !== "Peripherals") {
      updates.category = "Peripherals";
    }
    // Fix typo in name if "Keyborad" -> "Keyboard wired"
    if (nameRaw.toLowerCase().includes("keyborad")) {
      updates.name = "Keyboard wired";
    }
  }
  // Battery backup -> Power & Electrical
  else if (
    codeUpper.startsWith("KCSPW") ||
    nameRaw.toLowerCase().includes("ups") ||
    nameRaw.toLowerCase().includes("smart-ups") ||
    nameRaw.toLowerCase().includes("battery")
  ) {
    if (asset.category !== "Power & Electrical") {
      updates.category = "Power & Electrical";
    }
  }
  // Routers, Access Points, Switches, internet cable -> Network & Internet
  else if (
    codeUpper.startsWith("KCSRT") ||
    nameRaw.toLowerCase().includes("router") ||
    nameRaw.toLowerCase().includes("switch") ||
    nameRaw.toLowerCase().includes("access point") ||
    nameRaw.toLowerCase().includes("cable") ||
    asset.category === "Network"
  ) {
    if (asset.category !== "Network & Internet") {
      updates.category = "Network & Internet";
    }
  }
  // Mini desktops, desktops, laptops -> Computers
  else if (
    codeUpper.startsWith("KCSMD") ||
    codeUpper.startsWith("KCSL") ||
    codeUpper.startsWith("KCSDESK") ||
    nameRaw.toLowerCase().includes("laptop") ||
    nameRaw.toLowerCase().includes("desktop") ||
    asset.category === "Laptops" ||
    asset.category === "Desktops"
  ) {
    if (asset.category !== "Computers") {
      updates.category = "Computers";
    }
  }

  // 4. Name capitalization: First letter Capital, rest lowercase (unless digits or inch or model)
  const currentName = updates.name || asset.name || "";
  if (currentName) {
    // Ensure first letter is capitalized
    const normalizedName = currentName.charAt(0).toUpperCase() + currentName.slice(1);
    if (normalizedName !== currentName) {
      updates.name = normalizedName;
    }
  }

  // 5. Brand normalization
  const currentBrand = updates.brand || asset.brand || "";
  if (currentBrand) {
    if (currentBrand.toLowerCase() === "sharp") {
      updates.brand = "Sharp";
    } else if (currentBrand.toUpperCase() === "HP") {
      updates.brand = "HP";
    } else if (currentBrand.toUpperCase() === "DELL") {
      updates.brand = "Dell";
    } else if (currentBrand.toUpperCase() === "PROWISE") {
      updates.brand = "Prowise";
    } else if (currentBrand.toUpperCase() === "SAMSUNG") {
      updates.brand = "Samsung";
    } else if (currentBrand.toUpperCase() === "LENOVO") {
      updates.brand = "Lenovo";
    } else if (currentBrand.toUpperCase() === "ASUS") {
      updates.brand = "Asus";
    } else if (currentBrand.toUpperCase() === "CANON") {
      updates.brand = "Canon";
    } else {
      const bNorm = titleCaseWord(currentBrand);
      if (bNorm !== currentBrand) updates.brand = bNorm;
    }
  }

  // 6. Location normalization: KCS Basis, KCS Boven bouw, Cabin
  const currentLoc = asset.location || "";
  if (currentLoc) {
    const locNorm = normalizeMainLocation(currentLoc);
    if (locNorm && locNorm !== currentLoc) {
      updates.location = locNorm;
    }
  }

  // 7. Sublocation normalization: ICT Kantoor, 3B, 4B, etc.
  const currentDept = asset.department || "";
  if (currentDept) {
    const deptNorm = normalizeSublocation(currentDept);
    if (deptNorm && deptNorm !== currentDept) {
      updates.department = deptNorm;
    }
  }

  // 8. Replace Naomi Williams with Shaquil Alienda
  if (asset.assignedTo && asset.assignedTo.includes("Naomi")) {
    updates.assignedTo = asset.assignedTo.replace(/Naomi Williams/g, "Shaquil Alienda").replace(/Naomi W\./g, "Shaquil A.");
  }
  if (asset.responsibleEmployee && asset.responsibleEmployee.includes("Naomi")) {
    updates.responsibleEmployee = asset.responsibleEmployee.replace(/Naomi Williams/g, "Shaquil Alienda");
  }

  // 9. Condition: Remove Excellent and Poor -> Good or Fair
  if (asset.condition === "Excellent") {
    updates.condition = "Good";
  } else if (asset.condition === "Poor") {
    updates.condition = "Fair";
  }

  if (Object.keys(updates).length > 0) {
    updatedAssetsCount++;
    patches.push({ id: asset.id, code: asset.code, updates, docName: asset.document.name, updateTime: asset.document.updateTime });
  }
}

console.log(`Assets needing update: ${updatedAssetsCount} of ${assets.length}`);
console.log("Sample 5 patches:", JSON.stringify(patches.slice(0, 5), null, 2));

// Ensure Groep 4B exists in references
const hasGroep4B = refs.some(r => r.name === "Groep 4B" && r.kind === "department");
console.log("References has Groep 4B?", hasGroep4B);

if (apply) {
  console.log("Applying updates to Firestore...");
  let applied = 0;
  for (const patch of patches) {
    const mask = Object.keys(patch.updates).map(k => `updateMask.fieldPaths=${k}`).join("&");
    const fieldsToPatch = {};
    for (const [k, v] of Object.entries(patch.updates)) {
      fieldsToPatch[k] = encode(v);
    }
    const url = `/${patch.docName.replace(/^projects\/[^/]+\/databases\/[^/]+\/documents\//, "")}?${mask}`;
    await api(url, {
      method: "PATCH",
      body: JSON.stringify({ fields: fieldsToPatch }),
    });
    applied++;
    if (applied % 50 === 0) {
      console.log(`Applied ${applied} / ${patches.length}...`);
    }
  }
  console.log(`Successfully updated ${applied} asset documents in Firestore!`);

  if (!hasGroep4B) {
    console.log("Adding Groep 4B reference to Firestore...");
    const refData = {
      name: "Groep 4B",
      kind: "department",
      status: "Active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await api(`/references?documentId=dept-groep-4b`, {
      method: "POST",
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(refData).map(([k, v]) => [k, encode(v)])) }),
    });
    console.log("Created Groep 4B department reference!");
  }
}
