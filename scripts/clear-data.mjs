import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'aims-asset-inventory-system' });
const db = getFirestore();

async function deleteCollection(collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

async function main() {
  const cols = ['assets', 'codeGroups', 'locationTypes', 'inventoryItems', 'references'];
  for (const c of cols) {
    console.log(`Deleting ${c}...`);
    try {
      await deleteCollection(c, 500);
      console.log(`Deleted ${c}`);
    } catch(e) {
      console.error(`Error deleting ${c}:`, e);
    }
  }
}

main().then(() => process.exit(0)).catch(console.error);

