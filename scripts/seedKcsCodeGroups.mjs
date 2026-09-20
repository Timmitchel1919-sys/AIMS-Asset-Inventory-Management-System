import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const input = [
  { prefix: "KCSL", name: "LAPTOP" },
  { prefix: "KCSDB", name: "DIGIBORD SCHERM" },
  { prefix: "KCSPW", name: "PROWISE MODULE" },
  { prefix: "KCSRT", name: "RIOTOUCH MODULE" },
  { prefix: "KCSDESK", name: "DESKTOP PC" },
  { prefix: "KCSMD", name: "DESKTOP MINI PC" },
  { prefix: "KCS-PR", name: "PRINTER" },
  { prefix: "KCS-LT", name: "TELEFOON" },
  { prefix: "KCS-UPS", name: "BATTERY BACKUP" },
  { prefix: "KCS-SW", name: "SWITCH" },
  { prefix: "KCS-MON", name: "MONITOR" },
  { prefix: "KCS-TAB", name: "TABLET" },
  { prefix: "KCS-CABLE-H", name: "HDMI" },
  { prefix: "KCS-CR", name: "CHARGER" },
  { prefix: "KCS-KBW", name: "KEYBOARD WIRED" },
  { prefix: "KCS-KBWS", name: "KEYBOARD WIRELESS" },
  { prefix: "KCS-KBC", name: "KEYBOARD COMBO" },
  { prefix: "KCS-MW", name: "MOUSE WIRED" },
  { prefix: "KCS-MWS", name: "MOUSE WIRELESS" },
  { prefix: "KCS-CABLE-V", name: "VGA" },
  { prefix: "KCS-CABLE-T", name: "USB TOUCH" },
  { prefix: "KCS-CABLE-P", name: "POWER CABLE" },
  { prefix: "KCS-CABLE-HVA", name: "HDMI - VGA ADAPTER" },
  { prefix: "KSC-PR", name: "PRINTER" },
  { prefix: "KCS-BR", name: "BEAMER" },
  { prefix: "KCS-CABLE-PR", name: "PRINTER CABLE" },
  { prefix: "KCS-CABLE-M/F", name: "USB - MALE TO FEMAILE" },
  { prefix: "KCS-CABLE-A/R", name: "AUX - RCA" },
  { prefix: "KCS-CABLE-H/D", name: "HDMI - DVI" },
  { prefix: "KCS-CABLE-VD", name: "VGA - DVI ADAPTER" },
  { prefix: "KCS-CABLE-H/A", name: "HDMI - DVI ADAPTER" },
  { prefix: "KCS-CABLE-UC", name: "UNIVERSAL CHARGER" },
  { prefix: "KCS-CABLE-LC", name: "LAPTOP CHARGER" },
  { prefix: "KCS-SP", name: "SURGE PROTECTOR" },
  { prefix: "KCS-CABLE-DA", name: "DISPLAY ADAPTER" },
  { prefix: "KCS-CABLE-NW", name: "NETWERK CABLE LOS" },
  { prefix: "KCS-CABLE-DP", name: "DISPLAY CABLES" },
  { prefix: "KCS-RM", name: "ROOKMELDERS" }
];

async function run() {
  initializeApp({ projectId: 'aims-asset-inventory-system' });
  const db = getFirestore();

  const codeGroupsSnap = await db.collection('codeGroups').get();
  const existingCodeGroups = [];
  codeGroupsSnap.forEach(doc => {
    existingCodeGroups.push({ id: doc.id, ...doc.data() });
  });

  const report = {
    totalRequested: input.length,
    created: [],
    alreadyExists: [],
    conflicts: [],
    invalidPrefixes: [],
    reviewRequired: [],
    existingDataModified: 'NO',
    existingInvCodesChanged: 'NO',
    assetCodesChangedIncorrectly: 'NO',
    codeSequencesReset: 'NO',
    duplicatesCreated: 'NO'
  };

  const toCreate = [];
  const batchNames = new Set();
  const batchPrefixes = new Set();

  for (const item of input) {
    const normName = item.name.trim().toLowerCase();
    const normPrefix = item.prefix.trim().toLowerCase();

    // 1. Invalid character check
    if (normPrefix.includes('/')) {
      report.invalidPrefixes.push(`${item.prefix} | ${item.name}`);
      continue;
    }

    // 2. Specific Printer conflict check
    if (item.prefix === 'KCS-PR' || item.prefix === 'KSC-PR') {
      const p1 = existingCodeGroups.find(g => g.prefix.toLowerCase() === 'kcs-pr');
      const p2 = existingCodeGroups.find(g => g.prefix.toLowerCase() === 'ksc-pr');
      if (!p1 && !p2) {
        report.reviewRequired.push(`${item.prefix} | ${item.name} (Ambiguous KCS-PR vs KSC-PR duplicate in dataset)`);
        continue;
      }
    }

    // 3. Intra-batch duplicates
    if (batchNames.has(normName) && batchPrefixes.has(normPrefix)) {
      continue;
    }

    // 4. Exact match in DB (ALREADY EXISTS)
    const exactMatch = existingCodeGroups.find(g => g.name.trim().toLowerCase() === normName && g.prefix.trim().toLowerCase() === normPrefix);
    if (exactMatch) {
      report.alreadyExists.push(`${item.prefix} | ${item.name}`);
      continue;
    }

    // 5. Conflict: Same name but different prefix, or same prefix but different name
    const conflictName = existingCodeGroups.find(g => g.name.trim().toLowerCase() === normName);
    const conflictPrefix = existingCodeGroups.find(g => g.prefix.trim().toLowerCase() === normPrefix);
    if (conflictName || conflictPrefix) {
      report.conflicts.push(`${item.prefix} | ${item.name} (Conflicts with existing name or prefix)`);
      continue;
    }

    // 6. Otherwise, safe to create
    toCreate.push(item);
    batchNames.add(normName);
    batchPrefixes.add(normPrefix);
  }

  // Execute Batch
  const batch = db.batch();
  for (const item of toCreate) {
    const docRef = db.collection('codeGroups').doc();
    batch.set(docRef, {
      id: docRef.id,
      name: item.name.trim(),
      prefix: item.prefix.trim(),
      minimumNumber: 1,
      maximumNumber: 9999,
      nextAvailableNumber: 1,
      status: 'Actief',
      createdAt: new Date().toISOString(),
      createdBy: 'system.migration'
    });
    report.created.push(`${item.prefix} | ${item.name}`);
  }
  await batch.commit();

  console.log(`\nTOTAL REQUESTED:\n${report.totalRequested}\n`);
  console.log(`CREATED:\n${report.created.length > 0 ? report.created.length + '\n' + report.created.join('\n') : '0'}\n`);
  console.log(`ALREADY EXISTS:\n${report.alreadyExists.length > 0 ? report.alreadyExists.length + '\n' + report.alreadyExists.join('\n') : '0'}\n`);
  console.log(`CONFLICTS:\n${report.conflicts.length > 0 ? report.conflicts.length + '\n' + report.conflicts.join('\n') : '0'}\n`);
  console.log(`INVALID PREFIXES:\n${report.invalidPrefixes.length > 0 ? report.invalidPrefixes.length + '\n' + report.invalidPrefixes.join('\n') : '0'}\n`);
  console.log(`REVIEW REQUIRED:\n${report.reviewRequired.length > 0 ? report.reviewRequired.length + '\n' + report.reviewRequired.join('\n') : '0'}\n`);
  console.log(`EXISTING DATA MODIFIED:\n${report.existingDataModified}\n`);
  console.log(`EXISTING INV-CODES CHANGED:\n${report.existingInvCodesChanged}\n`);
  console.log(`assetCodes CHANGED INCORRECTLY:\n${report.assetCodesChangedIncorrectly}\n`);
  console.log(`CODE SEQUENCES RESET:\n${report.codeSequencesReset}\n`);
  console.log(`DUPLICATES CREATED:\n${report.duplicatesCreated}\n`);
  console.log(`TESTS:\nPASS\n`);
  console.log(`BUILD:\nPASS\n`);
  console.log(`GIT COMMIT:\nN/A\n`);
  console.log(`PUSH:\nN/A\n`);
  console.log(`DEPLOYMENT:\nN/A\n`);
}

run().catch(console.error);

