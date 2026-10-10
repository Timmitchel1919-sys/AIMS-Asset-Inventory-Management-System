import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { firestore } from "../lib/firebase";
import {
  DEFAULT_ASSET_TYPES,
  assetTypeId,
  normalizeAssetTypeName,
  validateAssetType,
  type AssetTypeError,
  type AssetTypeRecord,
  type AssetTypeStatus,
} from "../domain/assetTypes";

const COLLECTION = "assetTypes";
export interface AssetTypeActor {
  uid?: string;
  name?: string;
}

const iso = (value: unknown) =>
  value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : typeof value === "string"
      ? value
      : undefined;
const mapRecord = (id: string, d: DocumentData): AssetTypeRecord => ({
  id,
  name: String(d.name || ""),
  description: String(d.description || ""),
  behavior: d.behavior,
  status: d.status || "Active",
  createdAt: iso(d.createdAt),
  updatedAt: iso(d.updatedAt),
});

export function useAssetTypes() {
  const [state, setState] = useState({
    items: [] as AssetTypeRecord[],
    loading: !!firestore,
    error: "",
  });
  useEffect(() => {
    if (!firestore) return;
    return onSnapshot(
      collection(firestore, COLLECTION),
      (snap) =>
        setState({
          items: snap.docs
            .map((d) => mapRecord(d.id, d.data()))
            .sort((a, b) => a.name.localeCompare(b.name)),
          loading: false,
          error: "",
        }),
      (err) => setState((s) => ({ ...s, loading: false, error: err.message })),
    );
  }, []);
  return { ...state, connected: !!firestore };
}

// Written in the same batch as the change; mirrors validActivity in the rules.
function activity(
  db: NonNullable<typeof firestore>,
  actor: AssetTypeActor,
  action: string,
  entityId: string,
  detail: string,
) {
  const uid = actor.uid ?? "";
  return [
    doc(collection(db, "activityLogs")),
    {
      at: new Date().toISOString(),
      user: actor.name || uid || "Unknown user",
      action,
      entityType: "assetType",
      entityId,
      result: "Success",
      detail,
      createdAt: serverTimestamp(),
      createdBy: uid,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    },
  ] as const;
}

function requireDb() {
  if (!firestore) throw new Error("Firebase is not connected.");
  return firestore;
}

export async function createAssetTypes(
  inputs: { name: string; description?: string; behavior: string }[],
  existing: AssetTypeRecord[],
  actor: AssetTypeActor,
): Promise<AssetTypeError | null> {
  const ids = new Set(existing.map((item) => item.id));
  for (const input of inputs) {
    const problem = validateAssetType(input, ids);
    if (problem) return problem;
    ids.add(assetTypeId(input.name));
  }
  const db = requireDb();
  const uid = actor.uid ?? "";
  const batch = writeBatch(db);
  for (const input of inputs) {
    const name = normalizeAssetTypeName(input.name);
    const id = assetTypeId(name);
    batch.set(doc(db, COLLECTION, id), {
      name,
      description: (input.description ?? "").trim().slice(0, 500),
      behavior: input.behavior,
      status: "Active",
      createdAt: serverTimestamp(),
      createdBy: uid,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
    const [ref, data] = activity(db, actor, "ASSET_TYPE_CREATED", id, `Asset type "${name}" (${input.behavior}) created`);
    batch.set(ref, data);
  }
  await batch.commit();
  return null;
}

/** Creates only the specified defaults that do not exist yet (idempotent). */
export function createMissingDefaults(existing: AssetTypeRecord[], actor: AssetTypeActor) {
  const have = new Set(existing.map((item) => item.id));
  const missing = DEFAULT_ASSET_TYPES.filter((item) => !have.has(assetTypeId(item.name)));
  return missing.length ? createAssetTypes([...missing], existing, actor) : Promise.resolve(null);
}

export async function setAssetTypeStatus(
  item: AssetTypeRecord,
  status: AssetTypeStatus,
  actor: AssetTypeActor,
) {
  const db = requireDb();
  const uid = actor.uid ?? "";
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTION, item.id), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  const [ref, data] = activity(
    db,
    actor,
    status === "Archived" ? "ASSET_TYPE_ARCHIVED" : "ASSET_TYPE_UPDATED",
    item.id,
    `Asset type "${item.name}" set to ${status}`,
  );
  batch.set(ref, data);
  await batch.commit();
}
