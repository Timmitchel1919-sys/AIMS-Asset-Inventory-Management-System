import fs from 'fs';
import xlsx from 'xlsx';

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
      aimsAssets[code] = {
        code,
        category: fields.category?.stringValue,
        brand: fields.brand?.stringValue,
        model: fields.model?.stringValue,
        serialNumber: fields.serialNumber?.stringValue,
        condition: fields.condition?.stringValue,
        location: fields.location?.stringValue,
        department: fields.department?.stringValue,
        assignedTo: fields.assignedTo?.stringValue,
        purchaseDate: fields.purchaseDate?.stringValue,
        notes: fields.notes?.stringValue,
        technicalSpecifications: fields.technicalSpecifications?.mapValue?.fields ? Object.keys(fields.technicalSpecifications.mapValue.fields).join(', ') : '',
        status: fields.status?.stringValue
      };
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

// Helper to find column index
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

const summary = {
  totalSourceRecords: 0,
  alreadyCorrect: 0,
  safeUpdates: 0,
  missingFromAIMS: 0,
  conflicts: 0,
  manualReview: 0,
  duplicateInvCodes: 0,
  duplicateSerialNumbers: 0,
  missingSerialNumbers: 0,
  missingLocations: 0,
  missingConditions: 0,
  missingPurchaseYears: 0,
};

const uniqueConditions = new Set();
const uniqueLocations = new Set();
const anomalies = [];
const outputLines = [];

const seenInvCodes = new Set();
const seenSerialNumbers = {};

function standardizeBrand(brandModelStr) {
  if (!brandModelStr) return { brand: '', model: '' };
  const str = String(brandModelStr).trim();
  const lowerStr = str.toLowerCase();
  
  let brand = '';
  let model = str;

  if (lowerStr.includes('dell')) {
    brand = 'Dell';
    model = str.replace(/dell\s*-\s*|dell\s+/i, '').trim();
  } else if (lowerStr.includes('lenovo')) {
    brand = 'Lenovo';
    model = str.replace(/lenovo\s*-\s*|lenovo\s+/i, '').trim();
  } else if (lowerStr.includes('hp')) {
    brand = 'HP';
    model = str.replace(/hp\s*-\s*|hp\s+/i, '').trim();
  } else if (lowerStr.includes('asus')) {
    brand = 'Asus';
    model = str.replace(/asus\s*-\s*|asus\s+/i, '').trim();
  } else {
    // Cannot deterministically split, leave as is or put in notes
    return { brand: '', model: str, ambiguous: true };
  }
  
  // Format model casing: e.g. "INSPIRON 15" -> "Inspiron 15"
  model = model.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return { brand, model, ambiguous: false };
}

rows.forEach((row, idx) => {
  if (!row || !row[colInvCode]) return;
  const rawCode = String(row[colInvCode]).trim();
  if (!rawCode) return;
  
  summary.totalSourceRecords++;
  
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

  // Duplicate checks
  if (seenInvCodes.has(rawCode)) {
    summary.duplicateInvCodes++;
    anomalies.push(`Duplicate INV-code in source: ${rawCode}`);
  }
  seenInvCodes.add(rawCode);

  if (rawSn) {
    if (seenSerialNumbers[rawSn]) {
      summary.duplicateSerialNumbers++;
      anomalies.push(`Duplicate Serial Number in source: ${rawSn} (used by ${rawCode} and ${seenSerialNumbers[rawSn]})`);
    } else {
      seenSerialNumbers[rawSn] = rawCode;
    }
  } else {
    summary.missingSerialNumbers++;
  }

  if (!rawLocation) summary.missingLocations++;
  if (!rawCondition) summary.missingConditions++;
  if (!rawPurchase) summary.missingPurchaseYears++;

  if (rawCondition) {
    uniqueConditions.add(rawCondition);
  }
  if (rawLocation) {
    uniqueLocations.add(rawLocation);
  }

  // Anomalies checks
  if (rawCode === 'KHL02') anomalies.push(`KHL02: non-standard/legacy INV-code prefix`);
  if (rawCode === 'KSCL40') anomalies.push(`KSCL40: prefix differs from normal KCSL pattern`);
  if (rawCode === 'KSCL44') anomalies.push(`KSCL44: prefix differs from normal KCSL pattern`);
  if (rawCondition === '50%' || String(rawCondition) === '0.5') anomalies.push(`${rawCode}: Condition = 50%`);
  if (rawPurchase === '2O24') anomalies.push(`${rawCode}: Purchase Year = 2O24`);

  // Transform data
  const { brand, model, ambiguous: ambiguousBrand } = standardizeBrand(rawBrandModel);
  
  let notesArr = [];
  if (ambiguousBrand && rawBrandModel) {
    notesArr.push(`Legacy Brand-Model: ${rawBrandModel}`);
  }
  if (rawContract) notesArr.push(`Bruikleen contract: ${rawContract}`);
  if (rawCharger) notesArr.push(`Charger: ${rawCharger}`);
  if (rawBag) notesArr.push(`Laptop bag: ${rawBag}`);
  if (rawMouse) notesArr.push(`Mouse: ${rawMouse}`);
  
  // Non-standard users
  let assignedTo = '';
  const nonUsers = ['DAGLAPTOP', 'DAG LAPTOP', 'FREE', 'FINANCE BACK UP', 'ICT AFDELING', 'TERUG NAAR DE LEVERANCIER'];
  if (rawUser) {
    if (nonUsers.some(nu => rawUser.toUpperCase().includes(nu))) {
      notesArr.push(`Legacy gebruiker: ${rawUser}`);
    } else {
      assignedTo = rawUser; // Probably need proper matching, but keeping simple for dry run
    }
  }

  // Locations
  let location = rawLocation;
  if (rawLocation && !['ICT', 'STORAGE', 'FINANCE', 'HRM', 'KO/NSO', 'KCS BASIS', 'KH', 'ADMIN/SECR'].includes(rawLocation.toUpperCase())) {
     notesArr.push(`Legacy locatie: ${rawLocation}`);
     location = '';
  }

  // Condition mapping
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
  
  // Purchase Year mapping
  let purchaseYear = rawPurchase;
  if (rawPurchase === '2O24') {
    notesArr.push(`Legacy aanschafjaar: 2O24`);
    purchaseYear = '';
  }

  if (rawSpecs) {
    notesArr.push(`Specificaties: ${rawSpecs.replace(/\n/g, ', ')}`);
  }

  let warnings = [];
  if (anomalies.some(a => a.includes(rawCode) || a.includes(rawSn))) {
    warnings.push("REVIEW_REQUIRED");
  }

  let action = '';
  const existingAims = aimsAssets[rawCode];
  if (existingAims) {
    // Compare
    const isSame = existingAims.serialNumber === rawSn;
    if (isSame) {
      action = warnings.length > 0 ? 'MANUAL_REVIEW_REQUIRED' : 'ALREADY_CORRECT';
      if (action === 'ALREADY_CORRECT') summary.alreadyCorrect++;
      else summary.manualReview++;
    } else {
      action = 'CONFLICT';
      summary.conflicts++;
    }
  } else {
    action = warnings.length > 0 ? 'MANUAL_REVIEW_REQUIRED' : 'MISSING_FROM_AIMS';
    if (action === 'MISSING_FROM_AIMS') summary.missingFromAIMS++;
    else summary.manualReview++;
  }

  outputLines.push(`### INV-code: ${rawCode}`);
  outputLines.push(`**Action:** ${action}`);
  outputLines.push(`- **Current AIMS status:** ${existingAims ? 'Exists (' + existingAims.category + ')' : 'Not Found'}`);
  outputLines.push(`- **Source values:** Brand/Model: "${rawBrandModel}", S/N: "${rawSn}", User: "${rawUser}", Location: "${rawLocation}", Condition: "${rawCondition}", Purchase: "${rawPurchase}"`);
  outputLines.push(`- **Proposed AIMS values:** Brand: "${brand}", Model: "${model}", S/N: "${rawSn}", User: "${assignedTo}", Location: "${location}", Condition: "${condition}", Purchase Year: "${purchaseYear}"`);
  if (notesArr.length > 0) {
    outputLines.push(`- **Notes to append:**\n  - ` + notesArr.join('\n  - '));
  }
  if (warnings.length > 0) {
    outputLines.push(`- **Warnings:** ${warnings.join(', ')}`);
  }
  outputLines.push('');
});

// Write Markdown Artifact
const artifactContent = `
# AIMS ICT Assets - Laptop Inventory Dry-Run

## Summary Statistics
- **Total laptop source records:** ${summary.totalSourceRecords}
- **Already correct:** ${summary.alreadyCorrect}
- **Safe updates:** ${summary.safeUpdates}
- **Missing from AIMS:** ${summary.missingFromAIMS}
- **Conflicts:** ${summary.conflicts}
- **Manual review:** ${summary.manualReview}
- **Duplicate INV-codes:** ${summary.duplicateInvCodes}
- **Duplicate serial numbers:** ${summary.duplicateSerialNumbers}
- **Missing serial numbers:** ${summary.missingSerialNumbers}
- **Missing locations:** ${summary.missingLocations}
- **Missing conditions:** ${summary.missingConditions}
- **Missing purchase years:** ${summary.missingPurchaseYears}

## Data Anomalies & Uniques
**Unique Condition values:** ${Array.from(uniqueConditions).join(', ')}
**Unique source locations:** ${Array.from(uniqueLocations).join(', ')}

**Anomalies Detected:**
${anomalies.map(a => '- ' + a).join('\n')}

---

## Detailed Dry-Run by Asset

${outputLines.join('\n')}
`;

fs.writeFileSync('C:/Users/Administrator/.gemini/antigravity/brain/cfed000b-5bdc-4ef7-b92a-776bac235642/MASTER_INVENTORY_DRY_RUN.md', artifactContent);
console.log('Artifact created.');
