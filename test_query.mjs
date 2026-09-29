const token = process.argv[2];
const res = await fetch('https://firestore.googleapis.com/v1/projects/aims-asset-inventory-system/databases/(default)/documents/assets?pageSize=5', { headers: { 'Authorization': `Bearer ${token}` } });
const data = await res.json();
console.log(JSON.stringify(data.documents.map(d => Object.keys(d.fields)), null, 2));
