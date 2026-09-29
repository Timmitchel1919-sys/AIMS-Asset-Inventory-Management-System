import fs from "fs";

async function fetchCategories(token) {
  const query = {
    structuredQuery: {
      from: [{ collectionId: "categories" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "kind" },
          op: "EQUAL",
          value: { stringValue: "category" }
        }
      }
    }
  };
  const res = await fetch('https://firestore.googleapis.com/v1/projects/aims-asset-inventory-system/databases/(default)/documents:runQuery', { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(query)
  });
  const data = await res.json();
  const records = data.map(d => {
    if (!d.document) return null;
    const fields = d.document.fields;
    return {
      id: d.document.name.split('/').pop(),
      name: fields.name?.stringValue,
      parent: fields.parent?.stringValue,
      type: fields.type?.stringValue,
      status: fields.status?.stringValue,
      codeGroup: fields.details?.mapValue?.fields?.codeGroup?.stringValue || fields.details?.mapValue?.fields?.codePrefix?.stringValue
    };
  }).filter(Boolean);
  
  fs.writeFileSync("categories_dump.json", JSON.stringify(records, null, 2));
  console.log(`Exported ${records.length} categories.`);
}

const token = process.argv[2];
fetchCategories(token).catch(console.error);
