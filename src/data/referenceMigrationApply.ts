import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "../lib/firebase";
import {
  REFERENCE_FIELDS,
  changesOf,
  type AssetPlan,
} from "../domain/referenceMigration";

export interface ApplyResult {
  updated: number;
  /** Assets where a target field was filled by someone else after the report. */
  skippedChanged: number;
  /** Assets that no longer exist. */
  skippedMissing: number;
  failedAssets: string[];
  fieldsWritten: number;
}

const CHUNK = 100;

/**
 * Writes ONLY the proposals of a reviewed report. Each chunk is one
 * transaction that re-reads every asset and skips a field that is no longer
 * empty, so a concurrent edit is never overwritten. Existing text fields and
 * all identifiers (code, prefix, number) are untouched.
 */
export async function applyReferenceMigration(
  plans: AssetPlan[],
  actor: { uid?: string; name?: string },
  onProgress?: (done: number, total: number) => void,
): Promise<ApplyResult> {
  if (!firestore) throw new Error("Firebase is not connected.");
  const db = firestore;
  const uid = actor.uid ?? "";
  const work = plans.filter((plan) => changesOf(plan).length > 0);
  const result: ApplyResult = {
    updated: 0,
    skippedChanged: 0,
    skippedMissing: 0,
    failedAssets: [],
    fieldsWritten: 0,
  };
  for (let start = 0; start < work.length; start += CHUNK) {
    const chunk = work.slice(start, start + CHUNK);
    try {
      const outcome = await runTransaction(db, async (transaction) => {
        const refs = chunk.map((plan) => doc(db, "assets", plan.assetId));
        const snaps = await Promise.all(refs.map((ref) => transaction.get(ref)));
        const local = { updated: 0, skippedChanged: 0, skippedMissing: 0, fieldsWritten: 0 };
        snaps.forEach((snap, index) => {
          if (!snap.exists()) {
            local.skippedMissing += 1;
            return;
          }
          const data = snap.data();
          const update: Record<string, unknown> = {};
          for (const change of changesOf(chunk[index])) {
            if (data[change.field]) continue; // filled meanwhile: never overwrite
            update[change.field] = change.id;
          }
          const written = Object.keys(update).length;
          if (!written) {
            local.skippedChanged += 1;
            return;
          }
          update.updatedAt = serverTimestamp();
          update.updatedBy = uid;
          transaction.update(refs[index], update);
          local.updated += 1;
          local.fieldsWritten += written;
        });
        return local;
      });
      result.updated += outcome.updated;
      result.skippedChanged += outcome.skippedChanged;
      result.skippedMissing += outcome.skippedMissing;
      result.fieldsWritten += outcome.fieldsWritten;
    } catch {
      result.failedAssets.push(...chunk.map((plan) => plan.code));
    }
    onProgress?.(Math.min(start + CHUNK, work.length), work.length);
  }
  // One audit entry per run (mirrors validActivity in the rules).
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "activityLogs")), {
    at: new Date().toISOString(),
    user: actor.name || uid || "Unknown user",
    action: "ASSET_REFERENCES_MIGRATED",
    entityType: "asset",
    entityId: "bulk",
    result: result.failedAssets.length ? "Failure" : "Success",
    detail: `Filled ${result.fieldsWritten} reference fields on ${result.updated} assets (${REFERENCE_FIELDS.join(", ")}); skipped ${result.skippedChanged} changed, ${result.skippedMissing} missing, ${result.failedAssets.length} failed.`.slice(0, 2000),
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  await batch.commit();
  return result;
}
