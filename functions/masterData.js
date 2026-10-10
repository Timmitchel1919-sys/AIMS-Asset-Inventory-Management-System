/**
 * Server-side Master Data dependency checks and guarded archive/delete.
 *
 * Why a function: Firestore Rules cannot query other collections, so they
 * cannot prove that nothing still references a Codegroep, Hoofdlocatie,
 * Category or Asset Type. This module runs with the Admin SDK, checks the real
 * data, enforces the deletion policy and only then performs the change. The
 * rules forbid the same archive/delete from clients, so this is the only path.
 *
 * Pure with an injected `db` (Admin Firestore shape) so it is unit-testable.
 */

// Keep in sync with MASTER_DATA_DELETE_EMAILS in src/auth/masterDataDeletion.ts
// (a test compares the two lists).
export const MASTER_DATA_DELETE_EMAILS = [
  "sastropawiroe@kangoeroeschool.com",
  "aliendas@kangoeroeschool.com",
  "manager-ict@kangoeroeschool.com",
];

export const canDeleteMasterData = (email) =>
  MASTER_DATA_DELETE_EMAILS.includes(String(email || "").trim().toLowerCase());

/** Samples per dependency type, and the cap of records read per query. */
const SAMPLE = 5;
const LIMIT = 26;
const INACTIVE_ASSET = ["Disposed", "Archived"];

export const KINDS = ["codeGroup", "mainLocation", "category", "assetType"];
const COLLECTION = {
  codeGroup: "codeGroups",
  mainLocation: "locations",
  category: "categories",
  assetType: "assetTypes",
};

export class MasterDataError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code; // maps 1:1 onto HttpsError codes
    this.details = details;
  }
}

async function rows(db, collection, field, value) {
  const snap = await db.collection(collection).where(field, "==", value).limit(LIMIT).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const uniqueById = (list) => [...new Map(list.map((r) => [r.id, r])).values()];

function dependency(type, list, label) {
  const unique = uniqueById(list);
  return {
    type,
    count: Math.min(unique.length, LIMIT - 1),
    capped: unique.length >= LIMIT,
    samples: unique.slice(0, SAMPLE).map(label),
  };
}

const assetLabel = (a) => a.code || a.id;
const nameLabel = (r) => r.name || r.id;

/**
 * Everything that still refers to a record. `includeInactive` additionally
 * counts disposed/archived assets: needed before a PERMANENT delete (a
 * disposed asset's history still points at the record).
 */
export async function findDependencies(db, kind, id, record, { includeInactive = false } = {}) {
  const keep = (a) => includeInactive || !INACTIVE_ASSET.includes(a.status);
  const found = [];
  const add = (type, list, label) => {
    const dep = dependency(type, list, label);
    if (dep.count) found.push(dep);
  };

  if (kind === "codeGroup") {
    const prefix = String(record.prefix || "");
    // Any asset ever issued under this group blocks it: Inv.codes are permanent.
    add(
      "assets",
      [...(await rows(db, "assets", "codeGroupId", id)), ...(prefix ? await rows(db, "assets", "codePrefix", prefix) : [])],
      assetLabel,
    );
    add(
      "categories",
      [
        ...(await rows(db, "categories", "details.codeGroupId", id)),
        ...(prefix ? await rows(db, "categories", "details.codeGroup", prefix) : []),
      ].filter((c) => c.status !== "Archived"),
      nameLabel,
    );
  } else if (kind === "mainLocation") {
    const assets = [
      ...(await rows(db, "assets", "mainLocationId", id)),
      ...(await rows(db, "assets", "currentLocationId", id)),
      ...(await rows(db, "assets", "homeLocationId", id)),
    ].filter(keep);
    add("assets", assets, assetLabel);
    add("departments", (await rows(db, "departments", "mainLocationId", id)).filter((d) => d.status !== "Archived"), nameLabel);
    add(
      "locations",
      [
        ...(await rows(db, "locations", "mainLocationId", id)),
        ...(await rows(db, "locations", "containerLocationId", id)),
        ...(await rows(db, "locations", "parentLocationId", id)),
      ].filter((l) => l.id !== id && l.status !== "Archived"),
      nameLabel,
    );
  } else if (kind === "category") {
    add(
      "assets",
      [...(await rows(db, "assets", "categoryId", id)), ...(record.name ? await rows(db, "assets", "category", record.name) : [])].filter(keep),
      assetLabel,
    );
    add("categories", (await rows(db, "categories", "details.categoryId", id)).filter((c) => c.status !== "Archived"), nameLabel);
  } else if (kind === "assetType") {
    add("assets", (await rows(db, "assets", "assetTypeId", id)).filter(keep), assetLabel);
  }
  return found;
}

export const describeDependencies = (deps) =>
  deps.map((d) => `${d.count}${d.capped ? "+" : ""} ${d.type} (${d.samples.join(", ")})`).join("; ");

async function loadRecord(db, kind, id) {
  if (!KINDS.includes(kind)) throw new MasterDataError("invalid-argument", "Unknown master data kind.");
  if (!id || typeof id !== "string") throw new MasterDataError("invalid-argument", "A record id is required.");
  const ref = db.collection(COLLECTION[kind]).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new MasterDataError("not-found", "The record no longer exists.");
  const record = { id, ...snap.data() };
  if (kind === "mainLocation" && record.type !== "Main location")
    throw new MasterDataError("invalid-argument", "Only a Hoofdlocatie can be archived or deleted here.");
  return { ref, record };
}

/** Read-only dependency report (any verified account). */
export async function checkDependencies(db, { kind, id, includeInactive }) {
  const { record } = await loadRecord(db, kind, id);
  const dependencies = await findDependencies(db, kind, id, record, { includeInactive: !!includeInactive });
  return { kind, id, name: record.name || id, blocked: dependencies.length > 0, dependencies };
}

const EVENT = {
  codeGroup: { archive: "CODEGROUP_ARCHIVED", delete: "CODEGROUP_ARCHIVED" },
  mainLocation: { archive: "LOCATION_ARCHIVED", delete: "LOCATION_DELETED" },
};

/**
 * Archive (move to the recycle bin) or permanently delete a Codegroep or
 * Hoofdlocatie. Policy: only the authorized administrator accounts.
 */
export async function archiveMasterData(db, actor, { kind, id, mode, reason }, serverTimestamp) {
  if (kind !== "codeGroup" && kind !== "mainLocation")
    throw new MasterDataError("invalid-argument", "Only code groups and Hoofdlocaties use this operation.");
  if (mode !== "archive" && mode !== "delete")
    throw new MasterDataError("invalid-argument", "Mode must be archive or delete.");
  if (!canDeleteMasterData(actor.email))
    throw new MasterDataError("permission-denied", "Only authorized administrators may delete Master Data.");
  const note = String(reason || "").trim().slice(0, 500);
  if (mode === "archive" && note.length < 3)
    throw new MasterDataError("invalid-argument", "A reason of at least 3 characters is required.");

  const { ref, record } = await loadRecord(db, kind, id);
  const alreadyArchived = kind === "codeGroup" ? record.archived === true : record.status === "Archived";
  if (mode === "delete" && !alreadyArchived)
    throw new MasterDataError("failed-precondition", "Move the record to the recycle bin before deleting it permanently.");
  if (mode === "archive" && alreadyArchived)
    throw new MasterDataError("failed-precondition", "The record is already archived.");

  const dependencies = await findDependencies(db, kind, id, record, { includeInactive: mode === "delete" });
  if (dependencies.length)
    throw new MasterDataError(
      "failed-precondition",
      `${record.name || id} is still in use: ${describeDependencies(dependencies)}. Reassign or archive these first. / Wijs deze eerst opnieuw toe of archiveer ze.`,
      { dependencies },
    );

  const batch = db.batch();
  if (mode === "delete") batch.delete(ref);
  else if (kind === "codeGroup")
    batch.update(ref, {
      archived: true,
      isActive: false,
      deletionReason: note,
      archivedAt: serverTimestamp,
      archivedBy: actor.uid,
      updatedAt: serverTimestamp,
      updatedBy: actor.uid,
    });
  else
    batch.update(ref, {
      status: "Archived",
      deletionReason: note,
      archivedAt: serverTimestamp,
      archivedBy: actor.uid,
      updatedAt: serverTimestamp,
      updatedBy: actor.uid,
    });
  batch.set(db.collection("activityLogs").doc(), {
    at: new Date().toISOString(),
    user: actor.email,
    action: `masterData.${kind}.${mode}`,
    event: EVENT[kind][mode],
    entityType: kind,
    entityId: id,
    result: "Success",
    detail: `${record.name || id} ${mode === "delete" ? "permanently deleted" : "moved to the recycle bin"}${note ? `: ${note}` : ""}`.slice(0, 2000),
    createdAt: serverTimestamp,
    createdBy: actor.uid,
    updatedAt: serverTimestamp,
    updatedBy: actor.uid,
  });
  await batch.commit();
  return { ok: true, kind, id, mode, name: record.name || id };
}
