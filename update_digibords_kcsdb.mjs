const token = process.argv[2];
if (!token) {
  console.error("No token provided. Usage: node update_digibords_kcsdb.mjs <access_token> [--dry-run]");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

async function fetchAll(collectionName, filters = []) {
  let docs = [];
  let pageToken = '';
  do {
    let url = `https://firestore.googleapis.com/v1/projects/aims-asset-inventory-system/databases/(default)/documents/${collectionName}?pageSize=300`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.error) {
      console.error('Fetch error:', data.error);
      break;
    }
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

function stringValue(val) { return { stringValue: val == null ? "" : String(val) }; }
function integerValue(val) { return { integerValue: String(val) }; }

async function updateDoc(docName, fields) {
  const updateMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const payload = { fields };
  const url = `https://firestore.googleapis.com/v1/${docName}?${updateMask}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to update ${docName}:`, err);
    return false;
  }
  return true;
}

async function run() {
  const docs = await fetchAll('assets');
  const kcsdb = docs.filter(d => {
    const f = d.fields || {};
    const code = f.code?.stringValue || '';
    if (!code.startsWith('KCSDB')) return false;
    const m = code.match(/^KCSDB-(\d+)$/i) || code.match(/^KCSDB(\d+)$/i);
    if (!m) return false;
    const n = parseInt(m[1], 10);
    return n >= 1 && n <= 62;
  });

  console.log(`Found ${kcsdb.length} KCSDB assets in range 01-62`);

  let updated = 0;
  for (const doc of kcsdb) {
    const f = doc.fields || {};
    const code = f.code?.stringValue || '';
    const brandRaw = (f.brand?.stringValue || '').toLowerCase();
    const isSharp = brandRaw.includes('sharp');

    // Sharp digiborden are the 80 inch units (model PN-L862B, per the sheet).
    // Prowise / Riotouch / Samsung (and any other) are the 55 inch units and
    // must have their model cleared.
    const name = isSharp ? 'Digibord 80 inch' : 'Digibord 55 inch';
    const model = isSharp ? 'PN-L862B' : '';

    // barcode takes the value of the inventory code (inv.code)
    const invCode = f.invCode?.stringValue || code;

    const fields = {
      barcode: stringValue(invCode),
      category: stringValue('Display & Presentation'),
      categoryId: stringValue('cat-0083'),
      assetTypeId: stringValue('serialized'),
      type: stringValue('Digibord'),
      name: stringValue(name),
      model: stringValue(model),
      updatedAt: { timestampValue: new Date().toISOString() }
    };

    if (dryRun) {
      console.log(`[DRY] ${code} brand=${brandRaw || '(empty)'} -> name=${name} model=${model||'(empty)'} barcode=${invCode}`);
    } else {
      const ok = await updateDoc(doc.name, fields);
      if (ok) {
        console.log(`Updated ${code}`);
        updated++;
      }
    }
  }
  console.log(dryRun ? 'Dry run complete' : `Finished updating ${updated} assets`);
}

run().catch(console.error);
