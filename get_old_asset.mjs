const token = process.argv[2];
const query = {
  structuredQuery: {
    from: [{ collectionId: "assets" }],
    where: { fieldFilter: { field: { fieldPath: "code" }, op: "EQUAL", value: { stringValue: "KB-28" } } }
  }
};
async function run() {
  const res2 = await fetch('https://firestore.googleapis.com/v1/projects/aims-asset-inventory-system/databases/(default)/documents:runQuery', { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(query)
  });
  const data = await res2.json();
  console.log(JSON.stringify(data[0].document.fields, null, 2));
}
run();
