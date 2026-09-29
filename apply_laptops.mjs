import fs from 'fs';
import xlsx from 'xlsx';

const token = process.argv[2];
if (!token) {
  console.error("No token provided");
  process.exit(1);
}

// 1. Read existing AIMS assets
const aimsDataFile = 'C:/Users/Administrator/.gemini/antigravity/brain/cfed000b-5bdc-4ef7-b92a-776bac235642/.system_generated/steps/193/output.txt';
const aimsContent = fs.readFileSync(aimsDataFile, 'utf8');
const aimsRaw = JSON.parse(aimsContent);

const aimsAssets = {};
if (aimsRaw.documents) {
  aimsRaw.documents.forEach(doc => {
    const fields = doc.fields || {};
    const code = fields.code?.stringValue;
    if (code) {
      aimsAssets[code] = true;
    }
  });
}

// 2. Read Source Excel
const sourceFile = 'C:/Users/Administrator/Downloads/AI Webapp Projects/AIMS Asset & Inventory Management System/docs/MASTER INVENTORY 2026.xlsx';
const workbook = xlsx.readFile(sourceFile);
const sheet = workbook.Sheets['LAPTOP'];
const rawSourceData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

const headerRowIndex = rawSourceData.findIndex(row => row && row[0] && String(row[0]).includes('INV-'));
const headers = rawSourceData[headerRowIndex].map(h => String(h).replace(/\n/g, ' ').trim());
const rows = rawSourceData.slice(headerRowIndex + 1);

const colIndex = (name) => headers.findIndex(h => h.includes(name));
const colInvCode = colIndex('INV-');
const colBrandModel = colIndex('BRAND');
const colSpecs = colIndex('SPECS');
const colSn = colIndex('S/N');
const colUser = colIndex('USER');
const colLocation = colIndex('LOCATION');
const colCondition = colIndex('CONDITION');
const colContract = colIndex('BRUIKLEEN');
const colCharger = colIndex('CHARGER');
const colBag = colIndex('BAG');
const colMouse = colIndex('MOUSE');
const colPurchase = colIndex('PURCHASE');

function standardizeBrand(brandModelStr) {
  if (!brandModelStr) return { brand: '', model: '' };
  const str = String(brandModelStr).trim();
  const lowerStr = str.toLowerCase();
  let brand = ''; let model = str;
  if (lowerStr.includes('dell')) { brand = 'Dell'; model = str.replace(/dell\s*-\s*|dell\s+/i, '').trim(); }
  else if (lowerStr.includes('lenovo')) { brand = 'Lenovo'; model = str.replace(/lenovo\s*-\s*|lenovo\s+/i, '').trim(); }
  else if (lowerStr.includes('hp')) { brand = 'HP'; model = str.replace(/hp\s*-\s*|hp\s+/i, '').trim(); }
  else if (lowerStr.includes('asus')) { brand = 'Asus'; model = str.replace(/asus\s*-\s*|asus\s+/i, '').trim(); }
  else { return { brand: '', model: str, ambiguous: true }; }
  model = model.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return { brand, model, ambiguous: false };
}

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
  for (const row of rows) {
    if (!row || !row[colInvCode]) continue;
    const rawCode = String(row[colInvCode]).trim();
    if (!rawCode) continue;

    if (aimsAssets[rawCode]) {
      continue;
    }

    const rawBrandModel = row[colBrandModel] ? String(row[colBrandModel]).trim() : '';
    const rawSpecs = row[colSpecs] ? String(row[colSpecs]).trim() : '';
    const rawSn = row[colSn] ? String(row[colSn]).trim() : '';
    const rawUser = row[colUser] ? String(row[colUser]).trim() : '';
    const rawLocation = row[colLocation] ? String(row[colLocation]).trim() : '';
    const rawCondition = row[colCondition] ? String(row[colCondition]).trim() === '0.5' ? '50%' : String(row[colCondition]).trim() : '';
    const rawContract = row[colContract] ? String(row[colContract]).trim() : '';
    const rawCharger = row[colCharger] ? String(row[colCharger]).trim() : '';
    const rawBag = row[colBag] ? String(row[colBag]).trim() : '';
    const rawMouse = row[colMouse] ? String(row[colMouse]).trim() : '';
    const rawPurchase = row[colPurchase] ? String(row[colPurchase]).trim() : '';

    const { brand, model, ambiguous: ambiguousBrand } = standardizeBrand(rawBrandModel);
    
    let notesArr = [];
    if (ambiguousBrand && rawBrandModel) notesArr.push(`Legacy Brand-Model: ${rawBrandModel}`);
    if (rawContract) notesArr.push(`Bruikleen contract: ${rawContract}`);
    if (rawCharger) notesArr.push(`Charger: ${rawCharger}`);
    if (rawBag) notesArr.push(`Laptop bag: ${rawBag}`);
    if (rawMouse) notesArr.push(`Mouse: ${rawMouse}`);
    
    let assignedTo = '';
    const nonUsers = ['DAGLAPTOP', 'DAG LAPTOP', 'FREE', 'FINANCE BACK UP', 'ICT AFDELING', 'TERUG NAAR DE LEVERANCIER'];
    if (rawUser) {
      if (nonUsers.some(nu => rawUser.toUpperCase().includes(nu))) {
        notesArr.push(`Legacy gebruiker: ${rawUser}`);
      } else {
        assignedTo = rawUser;
      }
    }

    let location = rawLocation;
    if (rawLocation && !['ICT', 'STORAGE', 'FINANCE', 'HRM', 'KO/NSO', 'KCS BASIS', 'KH', 'ADMIN/SECR'].includes(rawLocation.toUpperCase())) {
       notesArr.push(`Legacy locatie: ${rawLocation}`);
       location = '';
    }

    let condition = rawCondition;
    if (rawCondition === '0.5') condition = '50%';
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
    
    let purchaseYear = rawPurchase;
    if (rawPurchase === '2O24') {
      notesArr.push(`Legacy aanschafjaar: 2O24`);
      purchaseYear = '';
    }

    if (rawSpecs) notesArr.push(`Specificaties: ${rawSpecs.replace(/\n/g, ', ')}`);

    // Flag anomalies exactly as requested
    if (rawCode === 'KHL02') notesArr.push(`INV_CODE_REVIEW_REQUIRED`);
    if (rawCode === 'KSCL40') notesArr.push(`INV_CODE_REVIEW_REQUIRED`);
    if (rawCode === 'KSCL44') notesArr.push(`INV_CODE_REVIEW_REQUIRED`);
    if (rawCondition === '50%' || rawCondition === '0.5') notesArr.push(`CONDITION_REVIEW_REQUIRED`);
    if (rawPurchase === '2O24') notesArr.push(`PURCHASE_YEAR_REVIEW_REQUIRED`);
    if (rawSn === '5CG9044D49') notesArr.push(`SERIAL_NUMBER_DUPLICATE_REVIEW_REQUIRED`);

    const match = rawCode.match(/^([A-Z]+)(\d+)$/);
    const codePrefix = match ? match[1] : '';
    const codeNumber = match ? parseInt(match[2], 10) : 0;

    const payload = {
      code: stringValue(rawCode),
      codePrefix: stringValue(codePrefix),
      codeNumber: integerValue(codeNumber),
      category: stringValue("Laptops"),
      name: stringValue("Laptop"),
      brand: stringValue(brand),
      model: stringValue(model),
      serialNumber: stringValue(rawSn),
      condition: stringValue(condition),
      status: stringValue("Available"),
      department: stringValue(""),
      location: stringValue(location),
      assignedTo: stringValue(assignedTo),
      purchaseDate: stringValue(purchaseYear),
      notes: stringValue(notesArr.join('\n')),
      type: stringValue("Device"),
      createdAt: { timestampValue: new Date().toISOString() },
      updatedAt: { timestampValue: new Date().toISOString() },
    };

    await uploadDocument(payload);
    created++;
    console.log(`Created ${rawCode}`);
  }
  console.log(`Finished creating ${created} missing laptops.`);
}

main().catch(console.error);
