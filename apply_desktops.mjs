import fs from 'fs';

const token = process.argv[2];
if (!token) {
  console.error("No token provided");
  process.exit(1);
}

const rawTsv = fs.readFileSync('desktops.tsv', 'utf-8');
const lines = rawTsv.split('\n').map(l => l.trim()).filter(l => l.length > 0);
const header = lines[0].split('\t');

// Skip header
const rows = lines.slice(1);

function stringValue(val) {
  return { stringValue: val || "" };
}
function integerValue(val) {
  return { integerValue: String(val) };
}

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
  
  // First, expand any rows like "13 T/M 18"
  let expandedRows = [];
  for (const row of rows) {
    const cols = row.split('\t');
    const rawCode = cols[0] ? cols[0].trim() : '';
    
    if (rawCode.toUpperCase().includes(' T/M ')) {
      const match = rawCode.match(/(\d+)\s+T\/M\s+(\d+)/i);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        for (let i = start; i <= end; i++) {
          const newCols = [...cols];
          newCols[0] = `KCSDESK-${i.toString().padStart(2, '0')}`;
          expandedRows.push(newCols);
        }
      }
    } else {
      expandedRows.push(cols);
    }
  }

  const seenSerialNumbers = {};
  
  // Find duplicate S/Ns
  for (const cols of expandedRows) {
    const rawSn = cols[4] ? cols[4].trim() : '';
    const rawCode = cols[0] ? cols[0].trim() : '';
    if (rawSn) {
      if (seenSerialNumbers[rawSn]) {
        seenSerialNumbers[rawSn].push(rawCode);
      } else {
        seenSerialNumbers[rawSn] = [rawCode];
      }
    }
  }

  for (const cols of expandedRows) {
    const rawCode = cols[0] ? cols[0].trim() : '';
    if (!rawCode) continue;

    const rawUser = cols[1] ? cols[1].trim() : '';
    const rawBrandModel = cols[2] ? cols[2].trim() : '';
    const rawSpecs = cols[3] ? cols[3].trim() : '';
    const rawSn = cols[4] ? cols[4].trim() : '';
    const rawLocation = cols[5] ? cols[5].trim() : '';
    const rawCondition = cols[6] ? cols[6].trim() : '';
    const rawPurchase = cols[8] ? cols[8].trim() : '';

    let brand = ''; let model = rawBrandModel;
    if (rawBrandModel.toUpperCase().includes('HP')) {
      brand = 'HP';
      model = rawBrandModel.replace(/hp\s*-\s*|hp\s+/i, '').trim();
    }
    model = model.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    let notesArr = [];
    
    let assignedTo = '';
    const nonUsers = ['ICT AFDELING', 'ADMINISTRATIE BOVENBOUW'];
    if (rawUser) {
      if (nonUsers.some(nu => rawUser.toUpperCase().includes(nu))) {
        notesArr.push(`Legacy gebruiker: ${rawUser}`);
      } else {
        assignedTo = rawUser;
      }
    }

    let location = rawLocation;
    if (rawLocation && !['ICT KANTOOR', 'FINANCE', 'HRM'].includes(rawLocation.toUpperCase())) {
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

    if (rawSpecs) notesArr.push(`Specificaties: ${rawSpecs.replace(/\n/g, ', ')}`);

    if (rawSn && seenSerialNumbers[rawSn].length > 1) {
      notesArr.push(`SERIAL_NUMBER_DUPLICATE_REVIEW_REQUIRED`);
    }

    const match = rawCode.match(/^([A-Z]+)-?(\d+)$/i);
    const codePrefix = match ? match[1].toUpperCase() : '';
    const codeNumber = match ? parseInt(match[2], 10) : 0;

    const payload = {
      code: stringValue(rawCode),
      codePrefix: stringValue(codePrefix),
      codeNumber: integerValue(codeNumber),
      category: stringValue("Desktops"),
      name: stringValue("Desktop"),
      brand: stringValue(brand),
      model: stringValue(model),
      serialNumber: stringValue(rawSn),
      condition: stringValue(condition),
      status: stringValue("Available"),
      department: stringValue(""),
      location: stringValue(location),
      assignedTo: stringValue(assignedTo),
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
  console.log(`Finished creating ${created} missing desktops.`);
}

main().catch(console.error);
