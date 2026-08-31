/**
 * Phase 8 — lightweight sync observability.
 *
 * Every export / import / scheduled / conflict-resolve run appends a record to
 * `syncRuns` and overwrites `syncHealth/latest`. There is no per-record job
 * queue yet (that arrives with Firestore triggers at production activation);
 * a failed run is its own dead-letter — the nightly cron retries, and a manual
 * run surfaces the error to the admin. `sheetsClient.withRetry` handles the
 * transient Sheets API failures within a run.
 */

const MAX_KEPT = 120;

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {typeof import("firebase-admin/firestore").FieldValue} FieldValue
 * @param {{ kind: string, ok: boolean, startedAt: number, summary?: object, error?: string, trigger?: string }} run
 */
export async function recordRun(db, FieldValue, run) {
  const finishedAt = new Date();
  const doc = {
    kind: run.kind,
    trigger: run.trigger || "manual",
    ok: run.ok,
    summary: run.summary || null,
    error: run.error ? String(run.error).slice(0, 500) : null,
    durationMs: run.startedAt ? Date.now() - run.startedAt : null,
    at: FieldValue.serverTimestamp(),
    atIso: finishedAt.toISOString(),
  };
  try {
    await db.collection("syncRuns").add(doc);
    await db
      .collection("syncHealth")
      .doc("latest")
      .set(doc, { merge: false });
  } catch (error) {
    console.error("recordRun failed (non-fatal)", error?.message);
    return;
  }
  // Cheap trim so the log cannot grow without bound.
  try {
    const stale = await db
      .collection("syncRuns")
      .orderBy("atIso", "desc")
      .offset(MAX_KEPT)
      .limit(50)
      .get();
    if (!stale.empty) {
      const batch = db.batch();
      stale.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (error) {
    console.error("syncRuns trim failed (non-fatal)", error?.message);
  }
}

/** Latest health doc + the most recent runs, for the admin UI. */
export async function readHealth(db, limit = 20) {
  const [latest, recent] = await Promise.all([
    db.collection("syncHealth").doc("latest").get(),
    db.collection("syncRuns").orderBy("atIso", "desc").limit(limit).get(),
  ]);
  return {
    latest: latest.exists ? latest.data() : null,
    recent: recent.docs.map((d) => ({ id: d.id, ...d.data(), at: undefined })),
  };
}
