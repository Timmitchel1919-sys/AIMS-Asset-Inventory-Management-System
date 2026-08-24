import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { ImportWriteAdapter, ImportWrite } from "./finalImportPlan";

/** Production-capable adapter. It performs no work until executeFinalImportPlan is explicitly called. */
export function createFirestoreImportAdapter(
  db: Firestore,
  actorUid: string,
): ImportWriteAdapter {
  const existingDocuments = new Set<string>();
  const comparable = (value: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(value).filter(
        ([key]) =>
          !["createdAt", "createdBy", "updatedAt", "updatedBy"].includes(key),
      ),
    );
  const stable = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object")
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
        .join(",")}}`;
    return JSON.stringify(value);
  };
  return {
    async isIdentical(item: ImportWrite) {
      const snapshot = await getDoc(doc(db, item.collection, item.documentId));
      if (snapshot.exists())
        existingDocuments.add(`${item.collection}/${item.documentId}`);
      return (
        snapshot.exists() &&
        stable(comparable(snapshot.data())) === stable(comparable(item.data))
      );
    },
    async writeBatch(writes: readonly ImportWrite[]) {
      if (writes.length > 450)
        throw new Error("Veilige batchlimiet overschreden.");
      const batch = writeBatch(db);
      writes.forEach((item) => {
        const exists = existingDocuments.has(
          `${item.collection}/${item.documentId}`,
        );
        const data = {
          ...item.data,
          ...(exists
            ? {}
            : { createdAt: serverTimestamp(), createdBy: actorUid }),
          updatedAt: serverTimestamp(),
          updatedBy: actorUid,
        };
        batch.set(doc(db, item.collection, item.documentId), data, {
          merge: true,
        });
      });
      await batch.commit();
    },
  };
}
