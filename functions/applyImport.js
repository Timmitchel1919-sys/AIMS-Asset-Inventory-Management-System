/**
 * Phase 4 — execute an approved import plan against Firestore (Admin SDK).
 *
 * Called only when the admin has reviewed the dry-run plan and confirmed.
 * Every write is guarded:
 *   - updates run in a transaction that re-checks `syncVersion` and aborts on a
 *     race (reported as skipped, never overwritten);
 *   - code-group creates re-check prefix uniqueness inside the transaction;
 *   - history corrections append a new event, never touching existing ones.
 *
 * Returns the results plus the exact cell write-backs the caller should push to
 * the sheet so its system columns stay coherent without a full re-export.
 */

export async function applyPlan(db, FieldValue, plan) {
  const now = new Date().toISOString();
  const results = {
    updated: [],
    created: [],
    corrected: [],
    skipped: [],
    writeBack: [], // { tab, row, cells: { header: value } }
  };

  /* ---------------- updates ---------------- */
  for (const u of plan.updates) {
    const ref = db.collection(u.collection).doc(u.recordId);
    try {
      const newVersion = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error("record vanished");
        const current = Number(snap.data().syncVersion ?? 0) || 0;
        if (current !== u.baseVersion) throw new Error("version-race");
        const next = current + 1;
        tx.set(
          ref,
          {
            ...u.patch,
            syncVersion: next,
            syncSource: "SHEETS",
            updatedBy: "sheets-sync",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return next;
      });
      results.updated.push({ tab: u.tab, row: u.row, recordId: u.recordId, syncVersion: newVersion });
      results.writeBack.push({
        tab: u.tab, row: u.row,
        cells: {
          "Sync Version": String(newVersion),
          "Sync Status": "SYNCED",
          Source: "SHEETS",
          "Updated At": now,
          "Last Synced At": now,
        },
      });
    } catch (error) {
      results.skipped.push({
        tab: u.tab, row: u.row, recordId: u.recordId,
        reason: error.message === "version-race" ? "changed in AIMS during apply" : error.message,
      });
    }
  }

  /* ---------------- creates (refs + code groups) ---------------- */
  for (const c of plan.creates) {
    try {
      const ref = db.collection(c.collection).doc();
      const base = {
        ...c.data,
        createdBy: "sheets-sync",
        updatedBy: "sheets-sync",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        syncVersion: 1,
        syncSource: "SHEETS",
      };

      if (c.collection === "codeGroups") {
        base.nextAvailableNumber =
          c.data.nextAvailableNumber ?? c.data.minimumNumber ?? 1;
        base.isActive = c.data.isActive ?? true;
        base.sortOrder = c.data.sortOrder ?? 0;
        await db.runTransaction(async (tx) => {
          const dup = await tx.get(
            db.collection("codeGroups").where("prefix", "==", c.data.prefix).limit(1),
          );
          if (!dup.empty) throw new Error("prefix taken");
          tx.set(ref, base);
        });
      } else {
        // location / department / category
        base.kind = c.kind;
        base.status = c.data.status || "Active";
        base.relatedCount = 0;
        base.details = c.data.details || {};
        if (c.kind === "location") {
          base.parentLocationId = null;
          base.containerLocationId = null;
          base.mainLocationId = null;
          base.managerId = null;
          base.managerUserId = null;
        }
        await ref.set(base);
      }

      results.created.push({ tab: c.tab, row: c.row, recordId: ref.id });
      results.writeBack.push({
        tab: c.tab, row: c.row,
        cells: {
          "Record ID": ref.id,
          "Sync Version": "1",
          "Sync Status": "SYNCED",
          Source: "SHEETS",
          "Updated At": now,
          "Last Synced At": now,
        },
      });
    } catch (error) {
      results.skipped.push({ tab: c.tab, row: c.row, reason: error.message });
    }
  }

  /* ---------------- history corrections ---------------- */
  for (const cor of plan.corrections) {
    try {
      const ref = db.collection("assetHistoryEvents").doc();
      await ref.set({
        assetId: cor.assetId || "",
        assetCode: cor.assetCode || "",
        eventType: "correction",
        category: "correction",
        title: "Correction from Google Sheets",
        description: cor.text,
        source: "correction",
        sourceModule: "sheets_sync",
        isLegacyImport: false,
        isManual: true,
        status: "Final",
        version: 1,
        occurredAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        createdBy: "sheets-sync",
        performedBy: "sheets-sync",
      });
      results.corrected.push({ row: cor.row, id: ref.id });
      results.writeBack.push({
        tab: "History Log", row: cor.row, cells: { Correction: "" },
      });
    } catch (error) {
      results.skipped.push({ tab: "History Log", row: cor.row, reason: error.message });
    }
  }

  return results;
}
