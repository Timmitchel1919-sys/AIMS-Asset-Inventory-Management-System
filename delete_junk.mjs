const token = process.argv[2];
async function deleteDoc(code) {
  const queryUrl = `https://firestore.googleapis.com/v1/projects/aims-asset-inventory-system/databases/(default)/documents:runQuery`;
  const queryPayload = {
    structuredQuery: {
      from: [{ collectionId: "assets" }],
      where: { fieldFilter: { field: { fieldPath: "code" }, op: "EQUAL", value: { stringValue: code } } }
    }
  };
  const res = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(queryPayload)
  });
  const results = await res.json();
  for (const r of results) {
    if (r.document) {
      const docName = r.document.name;
      console.log('Deleting', docName);
      await fetch(`https://firestore.googleapis.com/v1/${docName}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  }
}
async function run() {
  await deleteDoc('5B');
  await deleteDoc('SHARP');
}
run();
