const token = process.argv[2];

async function fetchAll(collectionName) {
  let docs = [];
  let pageToken = '';
  do {
    let url = `https://firestore.googleapis.com/v1/projects/aims-asset-inventory-system/databases/(default)/documents/${collectionName}?pageSize=300`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

async function updateDoc(docName, newCode, codePrefix, codeNumber) {
  // We should also update codePrefix and codeNumber if they exist, to ensure consistency
  let updateMask = `updateMask.fieldPaths=code&updateMask.fieldPaths=codePrefix&updateMask.fieldPaths=codeNumber`;
  const payload = { 
    fields: { 
      code: { stringValue: newCode },
      codePrefix: { stringValue: codePrefix },
      codeNumber: { integerValue: String(codeNumber) }
    } 
  };
  
  const url = `https://firestore.googleapis.com/v1/${docName}?${updateMask}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) console.error(`Failed to update ${docName}`, await res.text());
}

async function fixCollection(collectionName) {
  console.log(`Checking ${collectionName}...`);
  const docs = await fetchAll(collectionName);
  let updated = 0;
  for (const doc of docs) {
    if (!doc.fields || !doc.fields.code) continue;
    const code = doc.fields.code.stringValue;
    if (!code) continue;

    // Match exactly: Letters followed by Numbers, NO hyphen
    const match = code.match(/^([A-Za-z]+)(\d+)$/);
    if (match) {
      const prefix = match[1].toUpperCase();
      const numberStr = match[2];
      const numberInt = parseInt(numberStr, 10);
      const newCode = `${prefix}-${numberStr}`; // Wait, should we pad it? The prompt says "KCSDB-01". The original had "01". 
      // We keep the original number string intact to not change the zeros, just inject a hyphen.
      
      console.log(`Updating ${code} -> ${newCode}`);
      await updateDoc(doc.name, newCode, prefix, numberInt);
      updated++;
    }
  }
  console.log(`Finished ${collectionName}, updated ${updated} documents.`);
}

async function run() {
  await fixCollection('assets');
  await fixCollection('inventory');
}

run().catch(console.error);
