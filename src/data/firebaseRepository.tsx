import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { firebaseAuth, requireFirebase } from "../lib/firebase";
import type { MockSnapshot, WorkflowCommand, WorkflowResult } from "./contracts";
import { MockInventoryRepository, RepositoryContext } from "./mockRepository";

const collections = {
  assets: "assets",
  inventory: "inventoryItems",
  assignments: "assignments",
  borrows: "borrows",
  repairs: "repairs",
  maintenance: "maintenanceRecords",
  movements: "assetMovements",
  audits: "audits",
  auditDiscrepancies: "auditDiscrepancies",
  correctiveActions: "correctiveActions",
  disposals: "disposals",
  notifications: "notifications",
  activity: "activityLogs",
  locationTypes: "locationTypes",
  codeGroups: "codeGroups",
  users: "directoryUsers",
  roles: "roles",
  reports: "reports",
  reportResults: "reportResults",
  scheduledReports: "scheduledReports",
  reservations: "inventoryReservations",
  inventoryMovements: "inventoryTransactions",
} as const satisfies Partial<Record<keyof MockSnapshot, string>>;

type CollectionKey = keyof typeof collections;
const collectionKeys = Object.keys(collections) as CollectionKey[];

export class FirebaseRepositoryError extends Error {
  constructor(
    message: string,
    public readonly code = "unknown",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "FirebaseRepositoryError";
  }
}

export function firestoreErrorMessage(error: unknown) {
  const code = String((error as { code?: string })?.code || "").replace(
    "firestore/",
    "",
  );
  const messages: Record<string, string> = {
    "permission-denied": "You do not have permission to perform this action.",
    unauthenticated: "Your session has expired. Please sign in again.",
    unavailable: "AIMS data is temporarily unavailable. Please try again.",
    "not-found": "The requested record no longer exists.",
    "already-exists": "A record with that identifier already exists.",
    "failed-precondition": "The record changed. Refresh and try again.",
    "resource-exhausted": "The service is busy. Please try again shortly.",
  };
  return new FirebaseRepositoryError(
    messages[code] || "AIMS could not save this change. Please try again.",
    code || "unknown",
    { cause: error },
  );
}

function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, clean(item)]),
    );
  }
  return value;
}

function deserialize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deserialize);
  if (value && typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function")
      return value.toDate().toISOString();
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deserialize(item)]),
    );
  }
  return value;
}

const changed = (before: unknown, after: unknown) =>
  JSON.stringify(before) !== JSON.stringify(after);

export class FirebaseInventoryRepository extends MockInventoryRepository {
  private initialized = false;
  private notificationUnsubscribe?: () => void;

  constructor(private readonly db: Firestore) {
    super();
  }

  async initialize() {
    const base = this.snapshot();
    const next = { ...base } as MockSnapshot;
    await Promise.all(
      collectionKeys.map(async (key) => {
        const result = await getDocs(collection(this.db, collections[key]));
        (next[key] as unknown) = result.docs.map((item) =>
          deserialize({ id: item.id, ...item.data() }),
        );
      }),
    );
    const referenceCollections = await Promise.all(
      (["categories", "locations", "departments"] as const).map((name) =>
        getDocs(collection(this.db, name)),
      ),
    );
    next.references = referenceCollections.flatMap((result) =>
      result.docs.map((item) =>
        deserialize({ id: item.id, ...item.data() }),
      ),
    ) as MockSnapshot["references"];
    const settings = await getDocs(collection(this.db, "systemSettings"));
    next.systemSettings = settings.docs[0]
      ? (deserialize(settings.docs[0].data()) as MockSnapshot["systemSettings"])
      : { hierarchyValidationMode: "warning" };
    this.replaceState(next);
    this.initialized = true;
    this.notificationUnsubscribe?.();
    this.notificationUnsubscribe = onSnapshot(
      collection(this.db, "notifications"),
      (result) => {
        this.state.notifications = result.docs.map((item) =>
          deserialize({ id: item.id, ...item.data() }),
        ) as MockSnapshot["notifications"];
        this.emit();
      },
    );
  }

  dispose() {
    this.notificationUnsubscribe?.();
  }

  private async allocateAssetCode(command: WorkflowCommand) {
    const prefix = String(command.values?.codePrefix || "KCSMD").toUpperCase();
    const group = this.state.codeGroups.find(
      (item) => item.prefix.toUpperCase() === prefix && item.isActive,
    );
    if (!group) throw new Error(`No active code group exists for ${prefix}.`);
    const allocated = await runTransaction(this.db, async (transaction) => {
      const groupRef = doc(this.db, "codeGroups", group.id);
      const current = await transaction.get(groupRef);
      if (!current.exists()) throw new Error("The code group no longer exists.");
      const data = current.data();
      const minimum = Number(data.minimumNumber);
      const maximum = Number(data.maximumNumber);
      const requested = Number(command.values?.codeNumber || 0);
      const number = requested || Math.max(minimum, Number(data.nextAvailableNumber));
      if (number < minimum || number > maximum || number > 5000)
        throw new Error("The asset-code range has been exhausted.");
      const code = `${prefix}-${number < 100 ? String(number).padStart(2, "0") : number}`;
      const reservation = doc(this.db, "assetCodes", code);
      if ((await transaction.get(reservation)).exists())
        throw new Error("That asset code is already in use.");
      transaction.set(reservation, {
        code,
        codeGroupId: group.id,
        reservedBy: firebaseAuth?.currentUser?.uid,
        createdAt: serverTimestamp(),
      });
      transaction.update(groupRef, {
        nextAvailableNumber: Math.max(Number(data.nextAvailableNumber), number + 1),
        updatedAt: serverTimestamp(),
        updatedBy: firebaseAuth?.currentUser?.uid,
      });
      return number;
    });
    command.values = { ...command.values, codePrefix: prefix, codeNumber: allocated };
    group.nextAvailableNumber = Math.max(group.nextAvailableNumber, allocated + 1);
  }

  private async persistAtomicStock(before: MockSnapshot, after: MockSnapshot) {
    const oldItems = new Map(before.inventory.map((item) => [item.id, item]));
    const modified = after.inventory.filter((item) => {
      const old = oldItems.get(item.id);
      return old && (old.onHand !== item.onHand || old.reserved !== item.reserved);
    });
    if (!modified.length) return new Set<string>();
    await runTransaction(this.db, async (transaction) => {
      for (const item of modified) {
        const old = oldItems.get(item.id)!;
        const target = doc(this.db, "inventoryItems", item.id);
        const current = await transaction.get(target);
        if (!current.exists()) throw new Error("The inventory item no longer exists.");
        const data = current.data();
        const onHand = Number(data.onHand) + (item.onHand - old.onHand);
        const reserved = Number(data.reserved) + (item.reserved - old.reserved);
        if (onHand < 0 || reserved < 0 || reserved > onHand)
          throw new Error("There is not enough available stock for this operation.");
        transaction.update(target, {
          onHand,
          reserved,
          updatedAt: serverTimestamp(),
          updatedBy: firebaseAuth?.currentUser?.uid,
        });
      }
      for (const movement of after.inventoryMovements) {
        if (!before.inventoryMovements.some((item) => item.id === movement.id))
          transaction.set(
            doc(this.db, "inventoryTransactions", movement.id),
            clean({ ...movement, createdAt: serverTimestamp(), createdBy: firebaseAuth?.currentUser?.uid }) as DocumentData,
          );
      }
      for (const reservation of after.reservations) {
        const old = before.reservations.find((item) => item.id === reservation.id);
        if (changed(old, reservation))
          transaction.set(
            doc(this.db, "inventoryReservations", reservation.id),
            clean({ ...reservation, updatedAt: serverTimestamp(), updatedBy: firebaseAuth?.currentUser?.uid }) as DocumentData,
            { merge: true },
          );
      }
    });
    return new Set(modified.map((item) => item.id));
  }

  private async persist(
    before: MockSnapshot,
    after: MockSnapshot,
    atomicInventoryIds = new Set<string>(),
  ) {
    const batch = writeBatch(this.db);
    const actor = firebaseAuth?.currentUser;
    const oldReferences = new Map(before.references.map((item) => [item.id, item]));
    for (const item of after.references) {
      const old = oldReferences.get(item.id);
      if (!changed(old, item)) continue;
      const name = item.kind === "category" ? "categories" : item.kind === "department" ? "departments" : "locations";
      batch.set(
        doc(this.db, name, item.id),
        clean({ ...item, id: undefined, ...(old ? {} : { createdAt: serverTimestamp(), createdBy: actor?.uid }), updatedAt: serverTimestamp(), updatedBy: actor?.uid }) as DocumentData,
        { merge: true },
      );
    }
    for (const [id, item] of oldReferences) {
      if (after.references.some((candidate) => candidate.id === id)) continue;
      const name = item.kind === "category" ? "categories" : item.kind === "department" ? "departments" : "locations";
      batch.set(doc(this.db, name, id), { isArchived: true, archivedAt: serverTimestamp(), archivedBy: actor?.uid }, { merge: true });
    }
    for (const key of collectionKeys) {
      const oldItems = new Map(
        (before[key] as { id: string }[]).map((item) => [item.id, item]),
      );
      const newItems = after[key] as { id: string }[];
      for (const item of newItems) {
        const old = oldItems.get(item.id);
        if (!changed(old, item)) continue;
        if (key === "inventory" && atomicInventoryIds.has(item.id)) continue;
        if (
          atomicInventoryIds.size &&
          (key === "inventoryMovements" || key === "reservations")
        )
          continue;
        const target = doc(this.db, collections[key], item.id);
        batch.set(
          target,
          clean({
            ...item,
            id: undefined,
            ...(old ? {} : { createdAt: serverTimestamp(), createdBy: actor?.uid }),
            updatedAt: serverTimestamp(),
            updatedBy: actor?.uid,
          }) as DocumentData,
          { merge: true },
        );
      }
      for (const [id, old] of oldItems) {
        if (!newItems.some((item) => item.id === id)) {
          batch.set(doc(this.db, collections[key], id), {
            ...(clean(old) as Record<string, unknown>),
            isArchived: true,
            archivedAt: serverTimestamp(),
            archivedBy: actor?.uid,
            updatedAt: serverTimestamp(),
            updatedBy: actor?.uid,
          });
        }
      }
    }
    if (changed(before.systemSettings, after.systemSettings))
      batch.set(
        doc(this.db, "systemSettings", "organization"),
        { ...after.systemSettings, updatedAt: serverTimestamp(), updatedBy: actor?.uid },
        { merge: true },
      );
    await batch.commit();
  }

  override async execute(command: WorkflowCommand): Promise<WorkflowResult> {
    if (!this.initialized)
      return { ok: false, message: "AIMS data is still loading. Please wait." };
    const before = structuredClone(this.snapshot());
    try {
      if (command.action === "asset.create") await this.allocateAssetCode(command);
      const result = await super.execute(command);
      if (!result.ok) return result;
      const atomicInventoryIds = await this.persistAtomicStock(
        before,
        this.snapshot(),
      );
      await this.persist(before, this.snapshot(), atomicInventoryIds);
      return result;
    } catch (error) {
      this.replaceState(before);
      const normalized =
        error instanceof FirebaseRepositoryError ? error : firestoreErrorMessage(error);
      return { ok: false, message: normalized.message };
    }
  }

  override reset = () => {
    throw new FirebaseRepositoryError(
      "Production data cannot be reset from the AIMS client.",
      "permission-denied",
    );
  };
}

export function FirebaseRepositoryProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(
    () => new FirebaseInventoryRepository(requireFirebase().db),
    [],
  );
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    repository
      .initialize()
      .then(() => active && setState("ready"))
      .catch((reason) => {
        if (!active) return;
        setError(firestoreErrorMessage(reason).message);
        setState("error");
      });
    return () => {
      active = false;
      repository.dispose();
    };
  }, [repository]);
  if (state === "loading")
    return <div className="route-loader" role="status">Loading AIMS data…</div>;
  if (state === "error")
    return <main className="auth-page"><section className="auth-card"><h1>AIMS data unavailable</h1><p>{error}</p><button className="btn" onClick={() => location.reload()}>Retry</button></section></main>;
  return (
    <RepositoryContext.Provider value={repository}>
      {children}
    </RepositoryContext.Provider>
  );
}
