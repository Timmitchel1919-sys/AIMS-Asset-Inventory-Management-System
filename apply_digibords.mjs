import fs from 'fs';

const token = process.argv[2];
if (!token) {
  console.error("No token provided");
  process.exit(1);
}

const rawTsv = fs.readFileSync('digibords.tsv', 'utf-8');
const lines = rawTsv.split('\n').map(l => l.trim()).filter(l => l.length > 0);
const header = lines[0].split('\t');

const rows = lines.slice(1);

function stringValue(val) { return { stringValue: val || "" }; }
function integerValue(val) { return { integerValue: String(val) }; }

async function uploadDocument(payload) {
  const url = `https://firestore.googleapis.com/v1/projects/aims-asset-inventory-system/databases/(default)/documents/assets`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: payload })
  });
  if (!response.ok) {
    const err = await response.text();
    console.error(`Error uploading:`, err);
  }
}

async function main() {
  let created = 0;
  
  const seenCodes = {};
  
  // Columns:
  // 0: SCREEN CODE
  // 1: LOCATIE GROEP
  // 2: ADMIN INVENTORY LOCATION
  // 3: PASSWORD
  // 4: \ (Description)
  // 5: BRAND
  // 6: MODULE MINI DESKTOP
  // 7: WIFI USER NAME
  // 8: WIFI PASSWORD
  // 9: Column 11
  // 10: OPMERKINGEN
  // 11: Column 1
  
  for (const colsRaw of rows) {
    const cols = colsRaw.split('\t');
    const rawCode = cols[0] ? cols[0].trim() : '';
    if (!rawCode) continue;

    if (seenCodes[rawCode]) {
      seenCodes[rawCode].push(cols);
    } else {
      seenCodes[rawCode] = [cols];
    }
  }

  for (const rawCode of Object.keys(seenCodes)) {
    const rowsForCode = seenCodes[rawCode];
    
    // We will merge duplicates or just take the first one and flag it
    const cols = rowsForCode[0];
    const isDuplicate = rowsForCode.length > 1;

    const rawLocatieGroep = cols[1] ? cols[1].trim() : '';
    const rawAdminInvLoc = cols[2] ? cols[2].trim() : '';
    const rawPassword = cols[3] ? cols[3].trim() : '';
    const rawDesc = cols[4] ? cols[4].trim() : '';
    const rawBrand = cols[5] ? cols[5].trim() : '';
    const rawModule = cols[6] ? cols[6].trim() : '';
    const rawWifiUser = cols[7] ? cols[7].trim() : '';
    const rawWifiPass = cols[8] ? cols[8].trim() : '';
    const rawOpmerkingen = cols[10] ? cols[10].trim() : '';
    const rawCol1 = cols[11] ? cols[11].trim() : '';

    let brand = ''; let model = '';
    if (rawBrand) {
      brand = rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1).toLowerCase();
      if (brand === 'Sharpp') brand = 'Sharp'; // fix typo
    }
    if (rawDesc) {
      model = rawDesc;
    }

    let notesArr = [];
    if (rawPassword) notesArr.push(`Password: ${rawPassword}`);
    if (rawWifiUser) notesArr.push(`Wifi User: ${rawWifiUser}`);
    if (rawWifiPass) notesArr.push(`Wifi Password: ${rawWifiPass}`);
    if (rawModule) notesArr.push(`Module Mini Desktop: ${rawModule}`);
    if (rawAdminInvLoc) notesArr.push(`Admin Inventory Location: ${rawAdminInvLoc}`);
    if (rawCol1) notesArr.push(`Extra locatie info: ${rawCol1}`);
    if (rawOpmerkingen) notesArr.push(`Opmerkingen: ${rawOpmerkingen}`);

    let location = rawLocatieGroep;
    // Condition defaults to Good unless notes say it's bad
    let condition = 'Good';
    if (rawOpmerkingen.toLowerCase().includes('defect') || rawOpmerkingen.toLowerCase().includes('streep') || rawOpmerkingen.toLowerCase().includes('gaat niet aan')) {
      condition = 'Bad';
    }

    if (isDuplicate) {
      notesArr.push(`INV_CODE_DUPLICATE_REVIEW_REQUIRED: Found multiple entries in source for ${rawCode}`);
    }

    const match = rawCode.match(/^([A-Z]+)(\d+)$/i);
    const codePrefix = match ? match[1].toUpperCase() : '';
    const codeNumber = match ? parseInt(match[2], 10) : 0;

    const payload = {
      code: stringValue(rawCode),
      codePrefix: stringValue(codePrefix),
      codeNumber: integerValue(codeNumber),
      category: stringValue("Digibords"),
      name: stringValue("Digibord"),
      brand: stringValue(brand),
      model: stringValue(model),
      condition: stringValue(condition),
      status: stringValue("Available"),
      department: stringValue(""),
      location: stringValue(location),
      assignedTo: stringValue(""),
      notes: stringValue(notesArr.join('\n')),
      type: stringValue("Device"),
      createdAt: { timestampValue: new Date().toISOString() },
      updatedAt: { timestampValue: new Date().toISOString() },
    };

    await uploadDocument(payload);
    created++;
    console.log(`Created ${rawCode}`);
  }
  console.log(`Finished creating ${created} missing digibords.`);
}

main().catch(console.error);
