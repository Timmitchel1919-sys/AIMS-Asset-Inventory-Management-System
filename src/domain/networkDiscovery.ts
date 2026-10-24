export type DiscoveryAgentStatus = "PENDING" | "ACTIVE" | "OFFLINE" | "DISABLED" | "REVOKED";
export type DiscoveryRequestStatus = "QUEUED" | "DISPATCHED" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED" | "REJECTED";

export interface DiscoveryAgent {
  id: string;
  name: string;
  site: string;
  status: DiscoveryAgentStatus;
  networkScope: string;
  version?: string | null;
  operatingSystem?: string | null;
  lastHeartbeat?: Date | null;
  lastScan?: Date | null;
  lastError?: string | null;
}

export interface DiscoveryRequest {
  id: string;
  agentId: string;
  scope: string;
  status: DiscoveryRequestStatus;
  createdAt?: Date | null;
  completedAt?: Date | null;
  deviceCount?: number;
  error?: string | null;
}

export interface DiscoveredDevice {
  id: string;
  agentId: string;
  requestId: string;
  ipAddress: string;
  macAddress?: string | null;
  hostname?: string | null;
  vendor?: string | null;
  deviceType?: string | null;
  discoveryMethod: "ARP" | "ICMP" | "DNS";
  status: "DISCOVERED";
  lastSeen?: Date | null;
}

export function effectiveAgentStatus(agent: DiscoveryAgent, now = Date.now()): DiscoveryAgentStatus {
  if (agent.status !== "ACTIVE") return agent.status;
  const heartbeat = agent.lastHeartbeat?.getTime();
  return !heartbeat || now - heartbeat > 10 * 60_000 ? "OFFLINE" : "ACTIVE";
}

