import fs from 'fs';
import xlsx from 'xlsx';

const token = process.argv[2];
if (!token) {
  console.error("No token provided");
  process.exit(1);
}

const EXCEL_PATH = 'C:\\Users\\Administrator\\Downloads\\History Log .xlsx';

async function fetchAllAssets() {
  let docs = [];
  let pageToken = '';
  do {
    let url = `https://firestore.googleapis.com/v1/projects/aims-asset-inventory-system/databases/(default)/documents/assets?pageSize=300`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

function normalizeCode(code) {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseExcelDate(val) {
  if (typeof val === 'number') {
    // Excel date
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  if (typeof val === 'string') {
    // try to parse Dutch string or standard date
    const str = val.trim().toLowerCase();
    // Month mapping
    const months = {
      'jan': 0, 'januari': 0, 'feb': 1, 'februari': 1, 'mrt': 2, 'maart': 2,
      'apr': 3, 'april': 3, 'mei': 4, 'jun': 5, 'juni': 5, 'jul': 6, 'juli': 6,
      'aug': 7, 'augustus': 7, 'sep': 8, 'sept': 8, 'september': 8,
      'okt': 9, 'oktober': 9, 'nov': 10, 'november': 10, 'dec': 11, 'december': 11
    };
    // format like "22 september 2023"
    const parts = str.match(/(\d+)\s+([a-z]+)\s+(\d+)/);
    if (parts) {
      const d = parseInt(parts[1], 10);
      const m = months[parts[2]];
      const y = parseInt(parts[3], 10);
      if (m !== undefined) {
        return new Date(y, m, d);
      }
    }
    // format like "28-8-26"
    const parts2 = str.match(/(\d+)-(\d+)-(\d+)/);
    if (parts2) {
      const d = parseInt(parts2[1], 10);
      const m = parseInt(parts2[2], 10) - 1;
      let y = parseInt(parts2[3], 10);
      if (y < 100) y += 2000;
      return new Date(y, m, d);
    }
  }
  return null;
}

async function run() {
  console.log("Fetching DB assets...");
  const dbDocs = await fetchAllAssets();
  const dbAssetMap = new Map();
  for (const doc of dbDocs) {
    if (doc.fields && doc.fields.code) {
      const rawCode = doc.fields.code.stringValue;
      dbAssetMap.set(normalizeCode(rawCode), rawCode);
    }
  }

  console.log("Reading Excel file...");
  const wb = xlsx.readFile(EXCEL_PATH);
  
  const OVERVIEWS = ['OVERZICHT LAPTOP', 'OVERZICHT DESKTOP', 'OVERZICHT MD', 'OVERZICHT DIGIBORD'];
  
  let stats = {
    totalSheets: wb.SheetNames.length,
    overviewSheets: 0,
    individualSheets: 0,
    matchedAssets: 0,
    unmatchedAssets: 0,
    historyEventsFound: 0,
    historyEventsReady: 0,
    ambiguousRows: 0,
    datesSuccessfullyParsed: 0,
    datesRequiringReview: 0,
    sensitiveValuesExcluded: 0,
    assetsRequiringCodeReview: 0
  };
  
  let unmatchedList = [];
  let codeReviewList = [];
  let problems = [];
  let previews = [];
  
  let previewTypes = { 'Laptops': false, 'Desktops': false, 'Digibords': false };

  for (const sheetName of wb.SheetNames) {
    if (OVERVIEWS.includes(sheetName.toUpperCase())) {
      stats.overviewSheets++;
      continue;
    }
    
    stats.individualSheets++;
    const sheet = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });
    if (!rows || rows.length === 0) continue;
    
    // Find Asset DB match
    let matchedDbCode = dbAssetMap.get(normalizeCode(sheetName));
    
    // Scan for Device Name in first few rows
    let deviceNameInSheet = '';
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      if (!rows[i]) continue;
      const r = Array.from(rows[i]).map(c => c ? String(c).trim() : '');
      for (let j = 0; j < r.length; j++) {
        if (r[j] && (r[j].toUpperCase() === 'DEVICE NAME' || r[j].toUpperCase() === 'DEVICE')) {
          if (r[j+1]) deviceNameInSheet = r[j+1];
        }
      }
    }
    
    if (!matchedDbCode && deviceNameInSheet) {
      matchedDbCode = dbAssetMap.get(normalizeCode(deviceNameInSheet));
    }
    
    if (!matchedDbCode) {
      stats.unmatchedAssets++;
      unmatchedList.push({ sheetName, deviceNameInSheet });
      continue;
    }
    
    stats.matchedAssets++;
    
    // Parse Sections
    let sectionA = {};
    let historyRows = [];
    let inHistory = false;
    let headerIndices = {};
    
    for (let rIndex = 0; rIndex < rows.length; rIndex++) {
      let row = rows[rIndex];
      if (!row || row.length === 0) continue;
      
      const strRow = Array.from(row).map(c => c ? String(c).trim() : '');
      const strRowUpper = strRow.map(c => c.toUpperCase());
      
      if (!inHistory) {
        if (strRowUpper.includes('DATE:') || strRowUpper.includes('DATE') || strRowUpper.includes('STATUS')) {
          inHistory = true;
          headerIndices = {
            date: strRowUpper.findIndex(c => c === 'DATE:' || c === 'DATE'),
            status: strRowUpper.findIndex(c => c === 'STATUS' || c === 'STATUS:'),
            issue: strRowUpper.findIndex(c => c === 'ISSUE' || c === 'ISSUE:'),
            solution: strRowUpper.findIndex(c => c === 'SOLUTION' || c === 'SOLUTION:'),
            opmerkingen: strRowUpper.findIndex(c => c.includes('OPMERKING'))
          };
          continue;
        } else {
          // Parse as key-value pairs (Section A)
          for (let cIndex = 0; cIndex < strRow.length - 1; cIndex++) {
            if (strRow[cIndex] && strRow[cIndex].endsWith(':')) {
              const key = strRow[cIndex].replace(':', '').trim();
              const val = strRow[cIndex+1];
              if (val) sectionA[key] = val;
            } else if (strRow[cIndex] && strRow[cIndex+1]) {
              // Sometimes it's just adjacent cells
              if (['USER', 'BRAND', 'MODEL', 'CPU', 'RAM', 'SSD/HDD', 'CONDITION'].includes(strRowUpper[cIndex])) {
                 sectionA[strRow[cIndex]] = strRow[cIndex+1];
              }
            }
          }
        }
      } else {
        // In History
        const isEmptyRow = strRow.every(c => c === '');
        if (isEmptyRow) continue;
        
        let dateCell = headerIndices.date >= 0 ? row[headerIndices.date] : undefined;
        let statusStr = headerIndices.status >= 0 ? strRow[headerIndices.status] : '';
        let issueStr = headerIndices.issue >= 0 ? strRow[headerIndices.issue] : '';
        let solStr = headerIndices.solution >= 0 ? strRow[headerIndices.solution] : '';
        let opmStr = headerIndices.opmerkingen >= 0 ? strRow[headerIndices.opmerkingen] : '';
        
        // Logical events
        // If date is missing, but status/issue has content, check if it's a continuation
        const parsedDate = parseExcelDate(dateCell);
        let dateReview = false;
        
        if (dateCell && !parsedDate) {
           dateReview = true;
           stats.datesRequiringReview++;
        } else if (parsedDate) {
           stats.datesSuccessfullyParsed++;
        }
        
        const isAfgifte = (statusStr && statusStr.toUpperCase().includes('AFGIFTE')) || (dateCell && String(dateCell).toUpperCase().includes('AFGIFTE'));
        
        if (!dateCell && !statusStr && !issueStr && solStr) {
           // likely a continuation
           if (historyRows.length > 0) {
             historyRows[historyRows.length - 1].solution += ' ' + solStr;
             continue;
           } else {
             stats.ambiguousRows++;
           }
        } else {
           stats.historyEventsFound++;
           stats.historyEventsReady++;
           
           let event = {
             parsedDate,
             rawDate: dateCell,
             dateReview,
             status: statusStr,
             issue: issueStr,
             solution: solStr,
             notes: opmStr,
             isAfgifte,
             sourceRow: rIndex + 1
           };
           historyRows.push(event);
        }
      }
    }
    
    // Security check for Section A
    const sensitiveKeys = ['Admin Passw', 'AnyDesk', 'Teamviewer', 'Password', 'WIFI PASSWORD'];
    for (const key of Object.keys(sectionA)) {
      if (sensitiveKeys.some(sk => key.toUpperCase().includes(sk.toUpperCase()))) {
        stats.sensitiveValuesExcluded++;
        problems.push({
          invCode: matchedDbCode,
          sheet: sheetName,
          problem: 'SECURE_CREDENTIAL_REVIEW_REQUIRED',
          action: `Do not import ${key} into Notes`
        });
      }
    }
    
    // Generate Previews
    if (historyRows.length > 0 && previews.length < 5) {
       previews.push({
         asset: matchedDbCode,
         sheet: sheetName,
         sourceHistory: historyRows[0]
       });
    }
  }

  // Generate Markdown
  let md = `# HISTORY LOG DRY RUN REPORT

## SUMMARY
- **Workbook sheets:** ${stats.totalSheets}
- **Overview sheets excluded:** ${stats.overviewSheets}
- **Individual asset sheets analyzed:** ${stats.individualSheets}
- **Existing assets matched:** ${stats.matchedAssets}
- **Assets unmatched:** ${stats.unmatchedAssets}
- **Assets requiring code review:** ${stats.assetsRequiringCodeReview}

## HISTORY
- **History events found:** ${stats.historyEventsFound}
- **History events ready for import:** ${stats.historyEventsReady}
- **Ambiguous history continuation rows:** ${stats.ambiguousRows}
- **Dates successfully parsed:** ${stats.datesSuccessfullyParsed}
- **Dates requiring review:** ${stats.datesRequiringReview}
- **Sensitive values excluded:** ${stats.sensitiveValuesExcluded}

---
## UNMATCHED ASSETS
`;
  for (const u of unmatchedList) {
    md += `- Sheet: ${u.sheetName} (Device in sheet: ${u.deviceNameInSheet || 'None'})\n`;
  }
  
  md += `\n---
## PROBLEMS / REVIEWS
`;
  for (const p of problems) {
    md += `- **${p.invCode}** (${p.sheet}): ${p.problem} -> ${p.action}\n`;
  }

  md += `\n---
## TRANSFORMATION PREVIEWS

`;
  for (const p of previews) {
    md += `### ASSET: ${p.asset}
**SOURCE HISTORY EVENT (Row ${p.sourceHistory.sourceRow})**
- Date: ${p.sourceHistory.rawDate}
- Status: ${p.sourceHistory.status}
- Issue: ${p.sourceHistory.issue}
- Solution: ${p.sourceHistory.solution}

**AIMS HISTORY PREVIEW**
- Date: ${p.sourceHistory.parsedDate ? p.sourceHistory.parsedDate.toISOString() : 'N/A (Review Required)'}
- Status: ${p.sourceHistory.status}
- Issue: ${p.sourceHistory.issue}
- Solution: ${p.sourceHistory.solution}
- Source: History Log migration
- Action: NEW_HISTORY\n\n`;
  }

  fs.writeFileSync('HISTORY_LOG_DRY_RUN.md', md, 'utf-8');
  console.log("Wrote HISTORY_LOG_DRY_RUN.md");
}

run().catch(console.error);
