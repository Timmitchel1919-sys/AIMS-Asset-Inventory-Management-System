import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type Firestore,
  where,
} from "firebase/firestore";
import { firebaseAuth, requireFirebase } from "../lib/firebase";
import { rolePermissions, type Permission } from "../auth/permissions";
import { AIMS_BOOTSTRAP_ADMIN_UID } from "../auth/accessBootstrap";
import {
  isCommandAllowed,
  requiredPermission,
} from "../auth/workflowAuthorization";
import type {
  MockSnapshot,
  WorkflowCommand,
  WorkflowResult,
} from "./contracts";
import { WorkflowRepositoryEngine } from "./mockRepository";
import { RepositoryProvider } from "./repositoryContext";

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
  assetHistoryEvents: "assetHistoryEvents",
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
const eagerCollectionKeys = collectionKeys.filter(
  (key) => key !== "assetHistoryEvents",
);

const isPermissionDenied = (error: unknown) =>
  String((error as { code?: unknown })?.code || "").replace(
    "firestore/",
    "",
  ) === "permission-denied";

export interface ActorAccess {
  permissions: string[];
  denials: string[];
  active: boolean;
}

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
    if (Object.getPrototypeOf(value) !== Object.prototype) return value;
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

function writeData(
  item: {
    id?: string;
    createdAt?: unknown;
    createdBy?: unknown;
    updatedAt?: unknown;
    updatedBy?: unknown;
  },
  exists: boolean,
  actorUid?: string,
) {
  const fields = Object.fromEntries(
    Object.entries(item).filter(
      ([key]) =>
        !["id", "createdAt", "createdBy", "updatedAt", "updatedBy"].includes(
          key,
        ),
    ),
  );
  const importMetadata = fields.importMetadata as
    Record<string, unknown> | undefined;
  return clean({
    ...fields,
    ...(importMetadata
      ? {
          importMetadata: {
            ...importMetadata,
            importedAt: serverTimestamp(),
          },
        }
      : {}),
    ...(exists ? {} : { createdAt: serverTimestamp(), createdBy: actorUid }),
    updatedAt: serverTimestamp(),
    updatedBy: actorUid,
  }) as DocumentData;
}

export class FirebaseInventoryRepository extends WorkflowRepositoryEngine {
  private initialized = false;
  private notificationUnsubscribe?: () => void;

  constructor(
    private readonly db: Firestore,
    private readonly actorUid: () => string | undefined = () =>
      firebaseAuth?.currentUser?.uid,
    private readonly actorAccess?: () => Promise<ActorAccess>,
  ) {
    super();
  }

  private async resolveActorAccess(): Promise<ActorAccess> {
    if (this.actorAccess) return this.actorAccess();
    const user = firebaseAuth?.currentUser;
    if (!user) return { permissions: [], denials: [], active: false };
    if (user.uid === AIMS_BOOTSTRAP_ADMIN_UID)
      return {
        permissions: rolePermissions.administrator,
        denials: [],
        active: true,
      };
    const token = await user.getIdTokenResult();
    const tokenPermissions = Array.isArray(token.claims.permissions)
      ? token.claims.permissions.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const tokenDenials = Array.isArray(token.claims.denials)
      ? token.claims.denials.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const role = String(
      token.claims.role || "",
    ) as keyof typeof rolePermissions;
    const roleGrants = role in rolePermissions ? rolePermissions[role] : [];
    const assignment = await getDoc(
      doc(this.db, "accessAssignments", user.uid),
    );
    const data = assignment.data();
    const grants = Array.isArray(data?.permissions)
      ? data.permissions.filter(
          (value: unknown): value is string => typeof value === "string",
        )
      : [];
    const denials = Array.isArray(data?.denials)
      ? data.denials.filter(
          (value: unknown): value is string => typeof value === "string",
        )
      : [];
    return {
      permissions: [
        ...new Set<Permission | string>([
          ...roleGrants,
          ...tokenPermissions,
          ...grants,
        ]),
      ],
      denials: [...new Set([...tokenDenials, ...denials])],
      active: data?.active !== false,
    };
  }

  async initialize() {
    const base = this.snapshot();
    const next = { ...base } as MockSnapshot;
    await Promise.all(
      eagerCollectionKeys.map(async (key) => {
        try {
          const result = await getDocs(collection(this.db, collections[key]));
          (next[key] as unknown) = result.docs.map((item) =>
            deserialize({ id: item.id, ...item.data() }),
          );
        } catch (error) {
          if (!isPermissionDenied(error)) throw error;
          (next[key] as unknown) = [];
        }
      }),
    );
    const referenceCollections = await Promise.all(
      (["categories", "locations", "departments"] as const).map((name) =>
        getDocs(collection(this.db, name)),
      ),
    );
    next.references = referenceCollections.flatMap((result) =>
      result.docs.map((item) => deserialize({ id: item.id, ...item.data() })),
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

  override async queryAssetHistory(assetId: string, maximum = 250) {
    try {
      const result = await getDocs(
        query(
          collection(this.db, collections.assetHistoryEvents),
          where("assetId", "==", assetId),
          orderBy("occurredAt", "desc"),
          limit(Math.min(Math.max(maximum, 1), 500)),
        ),
      );
      const events = result.docs.map((item) =>
        deserialize({ id: item.id, ...item.data() }),
      ) as MockSnapshot["assetHistoryEvents"];
      this.state.assetHistoryEvents = [
        ...this.state.assetHistoryEvents.filter(
          (event) => event.assetId !== assetId,
        ),
        ...events,
      ];
      return events;
    } catch (error) {
      if (isPermissionDenied(error)) return [];
      throw firestoreErrorMessage(error);
    }
  }

  private prepareAssetCode(command: WorkflowCommand) {
    const prefix = String(command.values?.codePrefix || "KCSMD").toUpperCase();
    const group = this.state.codeGroups.find(
      (item) => item.prefix.toUpperCase() === prefix && item.isActive,
    );
    if (!group) throw new Error(`No active code group exists for ${prefix}.`);
    const requested = Number(command.values?.codeNumber || 0);
    const number =
      requested || Math.max(group.minimumNumber, group.nextAvailableNumber);
    if (
      number < group.minimumNumber ||
      number > group.maximumNumber ||
      number > 5000
    )
      throw new Error("The asset-code range has been exhausted.");
    command.values = {
      ...command.values,
      codePrefix: prefix,
      codeNumber: number,
    };
    return { group, number };
  }

  private async persist(
    before: MockSnapshot,
    after: MockSnapshot,
    assetCode?: { groupId: string; code: string },
  ) {
    const actorUid = this.actorUid();
    const writes: Array<{
      collection: string;
      id: string;
      old?: unknown;
      data: DocumentData;
      delete?: boolean;
    }> = [];
    const oldReferences = new Map(
      before.references.map((item) => [item.id, item]),
    );
    for (const item of after.references) {
      const old = oldReferences.get(item.id);
      if (!changed(old, item)) continue;
      const name =
        item.kind === "category"
          ? "categories"
          : item.kind === "department"
            ? "departments"
            : "locations";
      writes.push({
        collection: name,
        id: item.id,
        old,
        data: writeData(item, Boolean(old), actorUid),
      });
    }
    for (const [id, item] of oldReferences) {
      if (after.references.some((candidate) => candidate.id === id)) continue;
      const name =
        item.kind === "category"
          ? "categories"
          : item.kind === "department"
            ? "departments"
            : "locations";
      writes.push({ collection: name, id, old: item, data: {}, delete: true });
    }
    for (const key of collectionKeys) {
      const oldItems = new Map(
        (before[key] as { id: string }[]).map((item) => [item.id, item]),
      );
      const newItems = after[key] as { id: string }[];
      for (const item of newItems) {
        const old = oldItems.get(item.id);
        if (!changed(old, item)) continue;
        writes.push({
          collection: collections[key],
          id: item.id,
          old,
          data: writeData(item, Boolean(old), actorUid),
        });
      }
      for (const [id, old] of oldItems) {
        if (!newItems.some((item) => item.id === id)) {
          writes.push({
            collection: collections[key],
            id,
            old,
            data: {
              isArchived: true,
              archivedAt: serverTimestamp(),
              archivedBy: actorUid,
              updatedAt: serverTimestamp(),
              updatedBy: actorUid,
            },
          });
        }
      }
    }
    if (changed(before.systemSettings, after.systemSettings))
      writes.push({
        collection: "systemSettings",
        id: "organization",
        old: before.systemSettings,
        data: {
          ...after.systemSettings,
          updatedAt: serverTimestamp(),
          updatedBy: actorUid,
        },
      });

    const isLegacyInventoryBatch = writes.some(
      (write) =>
        (write.collection === "assets" || write.collection === "inventoryItems") &&
        Boolean(write.data.importMetadata),
    );
    if (isLegacyInventoryBatch) {
      // A legacy row produces an inventory item, asset, history event and audit
      // record. Firestore evaluates security rules across an atomic transaction;
      // persisting a large import as one transaction exceeds its expression
      // budget. Stable document IDs keep these individually validated writes
      // retry-safe while preserving the same schema and authorization rules.
      for (const write of writes) {
        await runTransaction(this.db, async (transaction) => {
          const target = doc(this.db, write.collection, write.id);
          const current = await transaction.get(target);
          const importedRecord =
            write.collection === "assets" ||
            write.collection === "inventoryItems" ||
            write.collection === "assetHistoryEvents";
          if (current.exists() && importedRecord) return;
          if (write.delete) transaction.delete(target);
          else transaction.set(target, write.data, { merge: true });
        });
      }
      return;
    }

    await runTransaction(this.db, async (transaction) => {
      const existing = new Map<string, DocumentData>();
      for (const write of writes) {
        const importedCreate =
          !write.old &&
          (write.collection === "assets" ||
            write.collection === "inventoryItems") &&
          Boolean(write.data.importMetadata);
        if (!write.old && !importedCreate) continue;
        const target = doc(this.db, write.collection, write.id);
        const snapshot = await transaction.get(target);
        if (importedCreate) {
          if (snapshot.exists())
            throw new Error(
              "An imported record was created by another session. Refresh and analyze again.",
            );
          continue;
        }
        if (!snapshot.exists())
          throw new Error(
            "A record changed or was removed. Refresh and try again.",
          );
        existing.set(`${write.collection}/${write.id}`, snapshot.data());
      }
      const codeRef = assetCode
        ? doc(this.db, "assetCodes", assetCode.code)
        : null;
      const codeSnapshot = codeRef ? await transaction.get(codeRef) : null;
      if (codeSnapshot?.exists())
        throw new Error("That asset code is already in use.");

      for (const write of writes) {
        if (write.collection === "inventoryItems" && write.old) {
          const current = existing.get(`${write.collection}/${write.id}`)!;
          const old = write.old as { onHand?: unknown; reserved?: unknown };
          if (
            Number(current.onHand) !== Number(old.onHand) ||
            Number(current.reserved) !== Number(old.reserved)
          )
            throw new Error(
              "Inventory changed while you were working. Refresh and try again.",
            );
        }
        if (write.collection === "codeGroups" && write.old) {
          const current = existing.get(`${write.collection}/${write.id}`)!;
          const old = write.old as { nextAvailableNumber?: unknown };
          if (
            Number(current.nextAvailableNumber) !==
            Number(old.nextAvailableNumber)
          )
            throw new Error(
              "The asset-code sequence changed. Refresh and try again.",
            );
        }
      }

      if (codeRef && assetCode)
        transaction.set(codeRef, {
          code: assetCode.code,
          codeGroupId: assetCode.groupId,
          reservedBy: actorUid,
          createdAt: serverTimestamp(),
        });
      for (const write of writes) {
        const target = doc(this.db, write.collection, write.id);
        if (write.delete) transaction.delete(target);
        else transaction.set(target, write.data, { merge: true });
      }
    });
  }

  override async execute(command: WorkflowCommand): Promise<WorkflowResult> {
    if (!this.initialized)
      return { ok: false, message: "AIMS data is still loading. Please wait." };
    const before = structuredClone(this.snapshot());
    try {
      const access = await this.resolveActorAccess();
      if (
        !access.active ||
        !isCommandAllowed(command, access.permissions, access.denials)
      )
        return {
          ok: false,
          message: `You do not have the required permission: ${requiredPermission(command)}.`,
        };
      if (command.action === "history.legacy.import") {
        const eventId = String(command.values?.id || "");
        if (!eventId)
          return {
            ok: false,
            message: "A stable legacy-history event ID is required.",
          };
        if (
          (
            await getDoc(doc(this.db, collections.assetHistoryEvents, eventId))
          ).exists()
        )
          return {
            ok: true,
            message: "Legacy history event already imported; skipped.",
            entityId: eventId,
          };
      }
      const allocation =
        command.action === "asset.create"
          ? this.prepareAssetCode(command)
          : undefined;
      const result = await super.execute(command);
      if (!result.ok) return result;
      let codeReservation: { groupId: string; code: string } | undefined;
      if (allocation) {
        allocation.group.nextAvailableNumber = Math.max(
          allocation.group.nextAvailableNumber,
          allocation.number + 1,
        );
        const asset = this.state.assets.find(
          (item) => item.id === result.entityId,
        );
        if (!asset)
          throw new Error(
            "The created asset could not be prepared for persistence.",
          );
        codeReservation = { groupId: allocation.group.id, code: asset.code };
      }
      await this.persist(before, this.snapshot(), codeReservation);
      return result;
    } catch (error) {
      this.replaceState(before);
      const normalized =
        error instanceof FirebaseRepositoryError
          ? error
          : firestoreErrorMessage(error);
      if (
        command.action === "inventory.legacy.importBatch" &&
        normalized.code === "permission-denied"
      )
        return {
          ok: false,
          message:
            "Voorraadimport is door Firebase geblokkeerd. Controleer of de nieuwste Firestore-regels zijn gedeployed en of je account de machtiging inventory.import heeft. Meld je daarna opnieuw aan.",
        };
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

export function FirebaseRepositoryProvider({
  children,
}: {
  children: ReactNode;
}) {
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
    return (
      <div className="route-loader" role="status">
        Loading AIMS data…
      </div>
    );
  if (state === "error")
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>AIMS data unavailable</h1>
          <p>{error}</p>
          <button className="btn" onClick={() => location.reload()}>
            Retry
          </button>
        </section>
      </main>
    );
  return (
    <RepositoryProvider repository={repository}>{children}</RepositoryProvider>
  );
}
