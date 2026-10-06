import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const functionsRequire = createRequire(join(here, '..', 'functions', 'package.json'));

const { initializeApp, applicationDefault, getApps } = functionsRequire('firebase-admin');
const { getFirestore } = functionsRequire('firebase-admin/firestore');
const { getAuth } = functionsRequire('firebase-admin/auth');
const { getStorage } = functionsRequire('firebase-admin/storage');

const PROJECT_ID = 'aims-asset-inventory-system';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('usage: node scripts/inventory-user-by-email.mjs <email>');
  process.exit(2);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set. Point it at the service account JSON (keep it out of git).');
  process.exit(2);
}

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
}
const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

const COLLECTIONS = [
  'assets', 'inventoryItems', 'assignments', 'borrows', 'repairs', 'maintenanceRecords',
  'assetMovements', 'audits', 'auditDiscrepancies', 'correctiveActions', 'disposals',
  'notifications', 'activityLogs', 'assetHistoryEvents', 'qrIdentities', 'locationTypes',
  'codeGroups', 'directoryUsers', 'roles', 'reports', 'reportResults', 'scheduledReports',
  'inventoryReservations', 'inventoryTransactions', 'users', 'userDirectory',
  'accessAssignments', 'presence',
];

const OWNERSHIP_FIELDS = ['createdBy', 'updatedBy', 'archivedBy', 'actorUserId', 'userId', 'ownerId'];
const out = [];
const say = (s = '') => { out.push(s); console.log(s); };

function findStringRefs(value, needle, trail = '', hits = []) {
  if (typeof value === 'string') {
    if (value.includes(needle)) hits.push(trail || '(root)');
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => findStringRefs(v, needle, `${trail}[${i}]`, hits));
    return hits;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) findStringRefs(v, needle, trail ? `${trail}.${k}` : k, hits);
  }
  return hits;
}

async function main() {
  say(`AIMS user inventory — ${email}`);
  say(`project: ${PROJECT_ID}   mode: READ-ONLY (no writes)`);
  say();

  say('== 1. Firebase Auth ==');
  let authUser = null;
  try {
    authUser = await auth.getUserByEmail(email);
    say(`  uid:            ${authUser.uid}`);
    say(`  displayName:    ${authUser.displayName || '(none)'}`);
    say(`  emailVerified:  ${authUser.emailVerified}`);
    say(`  disabled:       ${authUser.disabled}`);
    say(`  createdAt:      ${authUser.metadata.creationTime}`);
    say(`  lastSignInAt:   ${authUser.metadata.lastSignInTime || '(never)'}`);
  } catch (e) {
    say(`  no auth user found (${e.code || e.message})`);
  }
  say();

  const uids = new Set();
  if (authUser) uids.add(authUser.uid);

  say('== 2. Firestore users/ (private profile) ==');
  for (const col of ['users']) {
    const snap = await db.collection(col).get();
    for (const doc of snap.docs) {
      const d = doc.data();
      if ((d.email || '').toLowerCase() === email || (d.emailNormalized || '').toLowerCase() === email) {
        uids.add(doc.id);
        say(`  ${col}/${doc.id}`);
        say(`    fullName: ${d.fullName || '(none)'}   status: ${d.status || '(none)'}   role: ${d.role || '(none)'}`);
        say(`    createdAt: ${d.createdAt?.toDate?.().toISOString?.() || d.createdAt || '(none)'}`);
      }
    }
    if (!snap.docs.some(d => (d.data().email || '').toLowerCase() === email)) say(`  no match in ${col}/`);
  }
  say();

  for (const uid of uids) {
    say(`== 3. Ancillary docs for uid ${uid} ==`);
    for (const col of ['userDirectory', 'accessAssignments', 'presence']) {
      const doc = await db.collection(col).doc(uid).get();
      if (doc.exists) say(`  ${col}/${uid}  EXISTS  ${JSON.stringify(doc.data()).slice(0, 300)}`);
      else say(`  ${col}/${uid}  absent`);
    }
    say();
  }

  say('== 4. directoryUsers (legacy, email-bearing) ==');
  let dirHit = false;
  for (const doc of await db.collection('directoryUsers').get()) {
    if ((doc.data().email || '').toLowerCase() === email) {
      dirHit = true;
      say(`  directoryUsers/${doc.id}  name=${doc.data().name}  role=${doc.data().role}  status=${doc.data().status}`);
    }
  }
  if (!dirHit) say('  no match');
  say();

  say('== 5. Firebase Storage objects ==');
  for (const uid of uids) {
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({ prefix: `aims/${uid}/` });
    say(`  aims/${uid}/  ->  ${files.length} object(s)`);
    for (const f of files.sort((a, b) => a.name.localeCompare(b.name))) {
      say(`    ${f.name}  ${f.size} bytes  ${f.metadata?.contentType || 'unknown'}`);
    }
    const [all] = await bucket.getFiles({ prefix: 'aims/' });
    say(`  (bucket aims/ total for reference: ${all.length} object(s))`);
  }
  say();

  say('== 6. Ownership across collections (createdBy/updatedBy/archivedBy/... == uid) ==');
  for (const uid of uids) {
    for (const col of COLLECTIONS) {
      const snap = await db.collection(col).get();
      const owned = [];
      for (const doc of snap.docs) {
        const d = doc.data();
        const fields = OWNERSHIP_FIELDS.filter((f) => d[f] === uid);
        if (fields.length) owned.push(`${doc.id} [${fields.join(',')}]`);
      }
      if (owned.length) {
        say(`  ${col}: ${owned.length}`);
        for (const o of owned) say(`    ${o}`);
      }
    }
  }
  say();

  say('== 7. Records referencing this user\'s uploaded files ==');
  for (const uid of uids) {
    const needle = `aims/${uid}/`;
    for (const col of COLLECTIONS) {
      const snap = await db.collection(col).get();
      for (const doc of snap.docs) {
        const hits = findStringRefs(doc.data(), needle);
        if (hits.length) say(`  ${col}/${doc.id}: ${hits.join(', ')}`);
      }
    }
  }
  say();

  say('== 8. activityLogs with actorEmail == email ==');
  let logHits = 0;
  for (const doc of await db.collection('activityLogs').get()) {
    if ((doc.data().actorEmail || '').toLowerCase() === email) {
      logHits++;
      say(`  activityLogs/${doc.id}  action=${doc.data().action}  at=${doc.data().at || doc.data().createdAt || '(none)'}`);
    }
  }
  if (!logHits) say('  no match');
  say();

  say('== SUMMARY ==');
  say(`  uid(s):        ${[...uids].join(', ') || '(none found)'}`);
  say(`  auth account:  ${authUser ? 'present' : 'absent'}`);
  say(`  Rerun with the uid(s) above to enumerate deletions before performing any delete.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });