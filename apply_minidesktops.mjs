import fs from 'fs';

const token = process.argv[2];
if (!token) {
  console.error("No token provided");
  process.exit(1);
}

const rawTsv = fs.readFileSync('minidesktops.tsv', 'utf-8');

// robust TSV parsing that handles quotes
const rows = [];
let currentRow = [];
let currentCell = '';
let inQuotes = false;

for (let i = 0; i < rawTsv.length; i++) {
  const char = rawTsv[i];
  if (char === '"') {
    if (inQuotes && rawTsv[i+1] === '"') {
      currentCell += '"';
      i++;
    } else {
      inQuotes = !inQuotes;
    }
  } else if (char === '\t' && !inQuotes) {
    currentRow.push(currentCell);
    currentCell = '';
  } else if (char === '\n' && !inQuotes) {
    // Handle windows \r\n
    if (currentCell.endsWith('\r')) currentCell = currentCell.slice(0, -1);
    currentRow.push(currentCell);
    rows.push(currentRow);
    currentRow = [];
    currentCell = '';
  } else {
    currentCell += char;
  }
}
if (currentCell || currentRow.length > 0) {
  if (currentCell.endsWith('\r')) currentCell = currentCell.slice(0, -1);
  currentRow.push(currentCell);
  rows.push(currentRow);
}

// Remove header
rows.shift();

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
  
  const seenSerialNumbers = {};
  
  // Columns: INV-CODE, USER, BRAND - MODEL, SPECS, P/N, S/N, LOCATION, CONDITION, PURCHASE, OPM
  // Note: Column 1 in prompt is "/" which means empty user
  
  for (const cols of rows) {
    if (cols.length < 2) continue;
    const rawSn = cols[5] ? cols[5].trim() : '';
    const rawCode = cols[0] ? cols[0].trim() : '';
    if (rawSn) {
      if (seenSerialNumbers[rawSn]) seenSerialNumbers[rawSn].push(rawCode);
      else seenSerialNumbers[rawSn] = [rawCode];
    }
  }

  for (const cols of rows) {
    const rawCode = cols[0] ? cols[0].trim() : '';
    if (!rawCode) continue;

    const rawUser = cols[1] && cols[1].trim() !== '/' ? cols[1].trim() : '';
    const rawBrandModel = cols[2] ? cols[2].trim() : '';
    const rawSpecs = cols[3] ? cols[3].trim() : '';
    const rawPn = cols[4] ? cols[4].trim() : '';
    const rawSn = cols[5] ? cols[5].trim() : '';
    const rawLocation = cols[6] ? cols[6].trim() : '';
    const rawCondition = cols[7] ? cols[7].trim() : '';
    const rawPurchase = cols[8] ? cols[8].trim() : '';

    let brand = ''; let model = rawBrandModel;
    if (rawBrandModel.toUpperCase().includes('HP')) {
      brand = 'HP';
      model = rawBrandModel.replace(/hp\s*-\s*|hp\s+/i, '').trim();
    }
    if (model) {
      model = model.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    let notesArr = [];
    if (rawPn) notesArr.push(`P/N: ${rawPn}`);
    
    let location = rawLocation;
    if (rawLocation && !['ICT KANTOOR'].includes(rawLocation.toUpperCase())) {
       notesArr.push(`Legacy locatie: ${rawLocation}`);
       location = '';
    }

    let condition = rawCondition;
    if (rawCondition) {
      const ucCondition = condition.toUpperCase().trim();
      if (ucCondition === 'GOOD') condition = 'Good';
      else if (ucCondition === 'BAD') condition = 'Bad';
      else if (ucCondition === 'USE FOR PARTS') condition = 'Use for Parts';
      else {
        notesArr.push(`Legacy conditie: ${rawCondition}`);
        condition = '';
      }
    }

    if (rawSpecs) notesArr.push(`Specificaties: ${rawSpecs.replace(/\n/g, ' ')}`);

    if (rawSn && seenSerialNumbers[rawSn].length > 1) {
      notesArr.push(`SERIAL_NUMBER_DUPLICATE_REVIEW_REQUIRED`);
    }

    // Wait, KCSMD06 and KCSMD08 both have S/N `8CC9480166`
    // This will trigger the SERIAL_NUMBER_DUPLICATE_REVIEW_REQUIRED automatically.
    
    const match = rawCode.match(/^([A-Z]+)-?(\d+)$/i);
    const codePrefix = match ? match[1].toUpperCase() : '';
    const codeNumber = match ? parseInt(match[2], 10) : 0;

    const payload = {
      code: stringValue(rawCode),
      codePrefix: stringValue(codePrefix),
      codeNumber: integerValue(codeNumber),
      category: stringValue("Desktops"),
      name: stringValue("Mini Desktop"),
      brand: stringValue(brand),
      model: stringValue(model),
      serialNumber: stringValue(rawSn),
      condition: stringValue(condition),
      status: stringValue("Available"),
      department: stringValue(""),
      location: stringValue(location),
      assignedTo: stringValue(rawUser),
      purchaseDate: stringValue(rawPurchase),
      notes: stringValue(notesArr.join('\n')),
      type: stringValue("Device"),
      createdAt: { timestampValue: new Date().toISOString() },
      updatedAt: { timestampValue: new Date().toISOString() },
    };

    await uploadDocument(payload);
    created++;
    console.log(`Created ${rawCode}`);
  }
  console.log(`Finished creating ${created} missing mini desktops.`);
}

main().catch(console.error);
