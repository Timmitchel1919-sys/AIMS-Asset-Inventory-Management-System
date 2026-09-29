import fs from 'fs';

async function generateReport(token) {
  const rawCategories = JSON.parse(fs.readFileSync('categories_dump.json', 'utf8'));

  const mappings = {
    "cat-0032": { cat: "Computers", sub: "Laptops", name: "Laptop" }, 
    "cat-0066": { cat: "Computers", sub: "Desktops", name: "Desktop PC" }, 
    "cat-0063": { cat: "Computers", sub: "Mini computers", name: "Desktop Mini PC" }, 
    "cat-0062": { cat: "Display & Presentation", sub: "Interactive displays", name: "Digiboard" }, 
    "cat-0064": { cat: "Display & Presentation", sub: "Monitors", name: "Monitor" }, 
    "cat-0065": { cat: "Display & Presentation", sub: "Projectors", name: "Projector / Beamer" }, 
    "cat-0067": { cat: "Network", sub: "Routers", name: "Router" }, 
    "cat-0068": { cat: "Network", sub: "Switches", name: "Switch" }, 
    "cat-0069": { cat: "Network", sub: "Wireless", name: "Access Point" }, 
    "cat-0070": { cat: "Peripherals", sub: "Keyboards", name: "Wired Keyboard" }, 
    "cat-0071": { cat: "Peripherals", sub: "Keyboards", name: "Wireless Keyboard" }, 
    "cat-0072": { cat: "Peripherals", sub: "Mice", name: "Wired Mouse" }, 
    "cat-0073": { cat: "Peripherals", sub: "Mice", name: "Wireless Mouse" }, 
    "cat-0074": { cat: "Peripherals", sub: "Cameras", name: "Camera" }, 
    "cat-0075": { cat: "Cables & Adapters", sub: "Video Cables", name: "HDMI Cable" }, 
    "cat-0076": { cat: "Cables & Adapters", sub: "Video Cables", name: "VGA Cable" }, 
    "cat-0077": { cat: "Cables & Adapters", sub: "Power Cables", name: "Power Cable" }, 
    "cat-0078": { cat: "Cables & Adapters", sub: "USB Cables", name: "USB Touch Cable" }, 
    "cat-0079": { cat: "Cables & Adapters", sub: "Network Cables", name: "Cat6 Network Cable" }, 
    "cat-0080": { cat: "Mobile Devices", sub: "Smartphones", name: "Smartphone" }, 
    "cat-0081": { cat: "Mobile Devices", sub: "Tablets", name: "Tablet" }, 
  };

  const assetQuery = {
    structuredQuery: {
      from: [{ collectionId: "assets" }],
      select: { fields: [{ fieldPath: "category" }] }
    }
  };
  const res = await fetch('https://firestore.googleapis.com/v1/projects/aims-asset-inventory-system/databases/(default)/documents:runQuery', { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(assetQuery)
  });
  const data = await res.json();
  const assetCounts = {};
  for (const d of data) {
    if (d.document && d.document.fields && d.document.fields.category) {
      const cat = d.document.fields.category.stringValue;
      assetCounts[cat] = (assetCounts[cat] || 0) + 1;
    }
  }

  let output = "# Migration Mapping Report\n\n";

  for (const cat of rawCategories) {
    const map = mappings[cat.id];
    if (!map) {
      output += `WARNING: Unknown category ${cat.id} (${cat.name})\n`;
      continue;
    }
    
    const activeCount = assetCounts[cat.name] || 0;
    
    output += `Current record: ${cat.name} (${cat.id})\n`;
    output += `Current Parent: ${cat.parent || '-'}\n`;
    output += `Proposed Category: ${map.cat}\n`;
    output += `Proposed Sub-category: ${map.sub}\n`;
    output += `Proposed Asset name: ${map.name}\n`;
    output += `Tracking type: ${cat.type}\n`;
    output += `Code group if known: ${cat.codeGroup || '-'}\n`;
    output += `Active asset references: ${activeCount}\n`;
    output += `Migration action: Update record details.level="asset_name", details.categoryId, details.subCategoryId. Update name to "${map.name}". `;
    if (activeCount > 0 && map.name !== cat.name) {
       output += `WARNING: Will also need to update "category" string in ${activeCount} existing assets from "${cat.name}" to "${map.name}".\n`;
    } else {
       output += `\n`;
    }
    output += `--------------------------------------------------\n`;
  }

  fs.writeFileSync('MIGRATION_MAPPING.md', output);
  console.log("Wrote MIGRATION_MAPPING.md");
}

const token = process.argv[2];
generateReport(token).catch(console.error);
