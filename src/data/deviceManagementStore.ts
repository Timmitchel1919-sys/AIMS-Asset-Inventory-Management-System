import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Query,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { firestore } from "../lib/firebase";
import {
  MAX_BULK_TARGETS,
  normalizePolicyRules,
  validateCommandRequest,
  type CommandRequest,
  type DeviceAuditEntry,
  type DeviceCommand,
  type DevicePolicy,
  type ManagedDevice,
} from "../domain/deviceManagement";

/**
 * Persistence for the owner-only Device Management console. Every collection
 * here is readable/writable only by the Owner (see firestore.rules). Every
 * mutation writes its audit entry in the same atomic batch, and the audit
 * collection is create-only.
 */

export const DEVICE_COLLECTIONS = {
  devices: "deviceManagement",
  policies: "devicePolicies",
  commands: "deviceCommands",
  audit: "deviceAuditTrail",
} as const;

export interface DeviceActor {
  uid?: string;
  name?: string;
}

const toIso = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof (value as { toDate?: unknown }).toDate === "function")
    return (value as { toDate: () => Date }).toDate().toISOString();
  return undefined;
};

const mapDevice = (id: string, data: DocumentData): ManagedDevice => ({
  assetId: id,
  assetCode: String(data.assetCode || ""),
  policyId: data.policyId || undefined,
  notes: data.notes || undefined,
  enrolledBy: data.enrolledBy,
  enrolledAt: toIso(data.enrolledAt),
});
const mapPolicy = (id: string, data: DocumentData): DevicePolicy => ({
  id,
  name: String(data.name || ""),
  description: String(data.description || ""),
  active: data.active !== false,
  rules: normalizePolicyRules(data.rules || {}),
  updatedBy: data.updatedBy,
  updatedAt: toIso(data.updatedAt),
});
const mapCommand = (id: string, data: DocumentData): DeviceCommand => ({
  id,
  assetId: String(data.assetId || ""),
  assetCode: String(data.assetCode || ""),
  type: data.type,
  status: data.status === "cancelled" ? "cancelled" : "queued",
  reason: String(data.reason || ""),
  createdBy: data.createdBy,
  createdAt: toIso(data.createdAt),
  batchId: data.batchId,
});
const mapAudit = (id: string, data: DocumentData): DeviceAuditEntry => ({
  id,
  action: String(data.action || ""),
  assetId: data.assetId,
  assetCode: data.assetCode,
  detail: String(data.detail || ""),
  actor: data.actor,
  createdAt: toIso(data.createdAt),
});

export interface DeviceManagementData {
  devices: ManagedDevice[];
  policies: DevicePolicy[];
  commands: DeviceCommand[];
  audit: DeviceAuditEntry[];
  loading: boolean;
  error: string;
  connected: boolean;
}

export function useDeviceManagementData(): DeviceManagementData {
  const [state, setState] = useState<Omit<DeviceManagementData, "connected">>({
    devices: [],
    policies: [],
    commands: [],
    audit: [],
    loading: !!firestore,
    error: "",
  });
  useEffect(() => {
    if (!firestore) return;
    const db: Firestore = firestore;
    const pending = new Set<string>(Object.keys(DEVICE_COLLECTIONS));
    const settle = (key: string) => {
      pending.delete(key);
      if (!pending.size) setState((s) => ({ ...s, loading: false }));
    };
    const fail = (key: string) => (err: Error) => {
      setState((s) => ({ ...s, error: err.message, loading: false }));
      settle(key);
    };
    const listen = <T,>(
      key: keyof typeof DEVICE_COLLECTIONS,
      map: (id: string, data: DocumentData) => T,
      ordering?: Query<DocumentData>,
    ) =>
      onSnapshot(
        ordering ?? collection(db, DEVICE_COLLECTIONS[key]),
        (snap) => {
          const rows = snap.docs.map((d) => map(d.id, d.data()));
          setState((s) => ({ ...s, [key]: rows, error: "" }));
          settle(key);
        },
        fail(key),
      );
    const unsubscribers = [
      listen("devices", mapDevice),
      listen("policies", mapPolicy),
      listen(
        "commands",
        mapCommand,
        query(
          collection(db, DEVICE_COLLECTIONS.commands),
          orderBy("createdAt", "desc"),
          limit(300),
        ),
      ),
      listen(
        "audit",
        mapAudit,
        query(
          collection(db, DEVICE_COLLECTIONS.audit),
          orderBy("createdAt", "desc"),
          limit(300),
        ),
      ),
    ];
    return () => unsubscribers.forEach((stop) => stop());
  }, []);
  return { ...state, connected: !!firestore };
}

function requireDb(): Firestore {
  if (!firestore) throw new Error("Firebase is not connected.");
  return firestore;
}

function auditEntry(
  actor: DeviceActor,
  action: string,
  detail: string,
  asset?: { assetId: string; assetCode: string },
) {
  return {
    action,
    detail,
    assetId: asset?.assetId ?? null,
    assetCode: asset?.assetCode ?? null,
    actor: actor.name || "Owner",
    actorUid: actor.uid ?? null,
    createdAt: serverTimestamp(),
  };
}

export async function enrollDevices(
  targets: { assetId: string; assetCode: string }[],
  actor: DeviceActor,
) {
  if (!targets.length || targets.length > MAX_BULK_TARGETS)
    throw new Error(`Select between 1 and ${MAX_BULK_TARGETS} devices.`);
  const db = requireDb();
  const batch = writeBatch(db);
  for (const target of targets) {
    batch.set(doc(db, DEVICE_COLLECTIONS.devices, target.assetId), {
      assetCode: target.assetCode,
      enrolledBy: actor.name || "Owner",
      enrolledAt: serverTimestamp(),
    });
    batch.set(
      doc(collection(db, DEVICE_COLLECTIONS.audit)),
      auditEntry(actor, "device.enrolled", "Device added to managed register", target),
    );
  }
  await batch.commit();
}

export async function unenrollDevice(
  target: { assetId: string; assetCode: string },
  actor: DeviceActor,
) {
  const db = requireDb();
  const batch = writeBatch(db);
  batch.delete(doc(db, DEVICE_COLLECTIONS.devices, target.assetId));
  batch.set(
    doc(collection(db, DEVICE_COLLECTIONS.audit)),
    auditEntry(actor, "device.removed", "Device removed from managed register", target),
  );
  await batch.commit();
}

export async function assignPolicy(
  targets: { assetId: string; assetCode: string }[],
  policy: { id: string; name: string } | null,
  actor: DeviceActor,
) {
  if (!targets.length || targets.length > MAX_BULK_TARGETS)
    throw new Error(`Select between 1 and ${MAX_BULK_TARGETS} devices.`);
  const db = requireDb();
  const batch = writeBatch(db);
  for (const target of targets) {
    batch.update(doc(db, DEVICE_COLLECTIONS.devices, target.assetId), {
      policyId: policy?.id ?? null,
    });
    batch.set(
      doc(collection(db, DEVICE_COLLECTIONS.audit)),
      auditEntry(
        actor,
        "policy.assigned",
        policy ? `Policy "${policy.name}" assigned` : "Policy removed",
        target,
      ),
    );
  }
  await batch.commit();
}

export async function savePolicy(
  policy: Omit<DevicePolicy, "id" | "updatedAt" | "updatedBy"> & { id?: string },
  actor: DeviceActor,
) {
  const name = policy.name.trim();
  if (name.length < 2 || name.length > 80)
    throw new Error("Policy name must be 2-80 characters.");
  const db = requireDb();
  const ref = policy.id
    ? doc(db, DEVICE_COLLECTIONS.policies, policy.id)
    : doc(collection(db, DEVICE_COLLECTIONS.policies));
  const batch = writeBatch(db);
  batch.set(ref, {
    name,
    description: policy.description.trim().slice(0, 500),
    active: policy.active,
    rules: normalizePolicyRules(policy.rules),
    updatedBy: actor.name || "Owner",
    updatedAt: serverTimestamp(),
  });
  batch.set(
    doc(collection(db, DEVICE_COLLECTIONS.audit)),
    auditEntry(
      actor,
      policy.id ? "policy.updated" : "policy.created",
      `Policy "${name}" ${policy.id ? "updated" : "created"}`,
    ),
  );
  await batch.commit();
}

export async function deletePolicy(
  policy: DevicePolicy,
  assignedAssetIds: string[],
  actor: DeviceActor,
) {
  const db = requireDb();
  const batch = writeBatch(db);
  for (const assetId of assignedAssetIds)
    batch.update(doc(db, DEVICE_COLLECTIONS.devices, assetId), { policyId: null });
  batch.delete(doc(db, DEVICE_COLLECTIONS.policies, policy.id));
  batch.set(
    doc(collection(db, DEVICE_COLLECTIONS.audit)),
    auditEntry(actor, "policy.deleted", `Policy "${policy.name}" deleted`),
  );
  await batch.commit();
}

/**
 * Records commands as "queued". Nothing is sent to a device: AIMS has no
 * device agent, so these are an auditable request log only.
 */
export async function queueCommands(request: CommandRequest, actor: DeviceActor) {
  const problem = validateCommandRequest(request);
  if (problem) throw new Error(problem);
  const db = requireDb();
  const batchId = crypto.randomUUID();
  const batch = writeBatch(db);
  for (const target of request.targets) {
    batch.set(doc(collection(db, DEVICE_COLLECTIONS.commands)), {
      assetId: target.assetId,
      assetCode: target.assetCode,
      type: request.type,
      status: "queued",
      reason: request.reason.trim().slice(0, 500),
      batchId,
      createdBy: actor.name || "Owner",
      createdByUid: actor.uid ?? null,
      createdAt: serverTimestamp(),
    });
    batch.set(
      doc(collection(db, DEVICE_COLLECTIONS.audit)),
      auditEntry(
        actor,
        "command.queued",
        `Command "${request.type}" queued${request.reason.trim() ? `: ${request.reason.trim().slice(0, 200)}` : ""}`,
        target,
      ),
    );
  }
  await batch.commit();
  return batchId;
}

export async function cancelCommand(command: DeviceCommand, actor: DeviceActor) {
  if (command.status !== "queued") return;
  const db = requireDb();
  const batch = writeBatch(db);
  batch.update(doc(db, DEVICE_COLLECTIONS.commands, command.id), {
    status: "cancelled",
  });
  batch.set(
    doc(collection(db, DEVICE_COLLECTIONS.audit)),
    auditEntry(actor, "command.cancelled", `Command "${command.type}" cancelled`, {
      assetId: command.assetId,
      assetCode: command.assetCode,
    }),
  );
  await batch.commit();
}
