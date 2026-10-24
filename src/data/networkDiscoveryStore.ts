import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, type DocumentData } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firebaseFunctions, firestore } from "../lib/firebase";
import type { DiscoveredDevice, DiscoveryAgent, DiscoveryRequest } from "../domain/networkDiscovery";

const toDate = (value: unknown) => value && typeof value === "object" && "toDate" in value
  ? (value as { toDate: () => Date }).toDate()
  : null;

const mapAgent = (id: string, data: DocumentData): DiscoveryAgent => ({
  id, name: data.agentName || id, site: data.organization || "", status: data.status || "PENDING",
  networkScope: data.networkScope || "", version: data.version ?? null,
  operatingSystem: data.operatingSystem ?? null, lastHeartbeat: toDate(data.lastHeartbeat),
  lastScan: toDate(data.lastScan), lastError: data.lastError ?? null,
});
const mapRequest = (id: string, data: DocumentData): DiscoveryRequest => ({
  id, agentId: data.agentId, scope: data.scope, status: data.status,
  createdAt: toDate(data.createdAt), completedAt: toDate(data.completedAt),
  deviceCount: data.deviceCount, error: data.error ?? null,
});
const mapDevice = (id: string, data: DocumentData): DiscoveredDevice => ({
  id, agentId: data.agentId, requestId: data.requestId, ipAddress: data.ipAddress,
  macAddress: data.macAddress ?? null, hostname: data.hostname ?? null, vendor: data.vendor ?? null,
  deviceType: data.deviceType ?? null, discoveryMethod: data.method || "ICMP", status: "DISCOVERED",
  lastSeen: toDate(data.lastSeen),
});

export function useNetworkDiscoveryData() {
  const [agents, setAgents] = useState<DiscoveryAgent[]>([]);
  const [requests, setRequests] = useState<DiscoveryRequest[]>([]);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [loading, setLoading] = useState(Boolean(firestore));
  const [error, setError] = useState(firestore ? "" : "Firebase is not configured.");
  useEffect(() => {
    if (!firestore) return;
    const fail = (cause: Error) => { setError(cause.message); setLoading(false); };
    const unsubs = [
      onSnapshot(query(collection(firestore, "discoveryAgents"), limit(100)), snap => { setAgents(snap.docs.map(d => mapAgent(d.id, d.data()))); setLoading(false); }, fail),
      onSnapshot(query(collection(firestore, "discoveryRequests"), orderBy("createdAt", "desc"), limit(100)), snap => setRequests(snap.docs.map(d => mapRequest(d.id, d.data()))), fail),
      onSnapshot(query(collection(firestore, "discoveredDevices"), orderBy("lastSeen", "desc"), limit(500)), snap => setDevices(snap.docs.map(d => mapDevice(d.id, d.data()))), fail),
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, []);
  return { agents, requests, devices, loading, error };
}

function callable<TInput, TOutput>(name: string) {
  if (!firebaseFunctions) throw new Error("Firebase is not configured.");
  return httpsCallable<TInput, TOutput>(firebaseFunctions, name);
}
export async function createDiscoveryEnrollment(input: { name: string; site: string; scope: string }) {
  return (await callable<{ agentName: string; site: string; networkScope: string }, { enrollmentId: string; enrollmentToken: string; expiresAt: string }>("createDiscoveryEnrollment")({agentName: input.name, site: input.site, networkScope: input.scope})).data;
}
export async function manageDiscoveryAgent(input: { agentId: string; action: "ENABLE" | "DISABLE" | "REVOKE" }) {
  return (await callable<typeof input, { ok: boolean }>("manageDiscoveryAgent")(input)).data;
}
export async function requestNetworkDiscovery(input: { agentId: string; scope: string }) {
  return (await callable<{ agentId: string; networkScope: string }, { requestId: string; expiresAt: string }>("requestNetworkDiscovery")({agentId: input.agentId, networkScope: input.scope})).data;
}

