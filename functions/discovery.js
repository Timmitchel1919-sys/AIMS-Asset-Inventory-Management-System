import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const DISCOVERY_COMMAND = "DISCOVER_NETWORK";
export const AGENT_STATES = ["PENDING", "ACTIVE", "OFFLINE", "DISABLED", "REVOKED"];
export const REQUEST_STATES = ["QUEUED", "DISPATCHED", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED", "REJECTED"];
export const MAX_DISCOVERY_HOSTS = 256;
export const HEARTBEAT_OFFLINE_AFTER_MS = 10 * 60 * 1000;
export const REQUEST_TTL_MS = 5 * 60 * 1000;
export const ENROLLMENT_TTL_MS = 15 * 60 * 1000;

export const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export const normalizeAgentId = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  if (!/^[A-Z0-9][A-Z0-9-]{2,63}$/.test(normalized))
    throw new Error("Agent ID must contain 3-64 letters, numbers, or hyphens.");
  return normalized;
};

const ipv4Number = (ip) => {
  const parts = String(ip).split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map(Number);
  if (bytes.some((part, index) => !Number.isInteger(part) || part < 0 || part > 255 || String(part) !== parts[index])) return null;
  return bytes.reduce((value, part) => ((value << 8) | part) >>> 0, 0) >>> 0;
};

export function parseAuthorizedScope(value) {
  const match = String(value || "").trim().match(/^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/);
  if (!match) throw new Error("Network scope must be valid IPv4 CIDR notation.");
  const address = ipv4Number(match[1]);
  const prefix = Number(match[2]);
  if (address === null || prefix < 24 || prefix > 32)
    throw new Error("Phase 1 scopes must contain at most 256 IPv4 addresses (/24 to /32).");
  const privateAddress =
    (address >= ipv4Number("10.0.0.0") && address <= ipv4Number("10.255.255.255")) ||
    (address >= ipv4Number("172.16.0.0") && address <= ipv4Number("172.31.255.255")) ||
    (address >= ipv4Number("192.168.0.0") && address <= ipv4Number("192.168.255.255"));
  if (!privateAddress) throw new Error("Only RFC1918 private network scopes are permitted.");
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (address & mask) >>> 0;
  if (network !== address) throw new Error("Scope must use the canonical network address.");
  const hostCount = 2 ** (32 - prefix);
  return { cidr: `${match[1]}/${prefix}`, network, prefix, hostCount };
}

export function ipInScope(ip, cidr) {
  const address = ipv4Number(ip);
  if (address === null) return false;
  const scope = parseAuthorizedScope(cidr);
  const mask = scope.prefix === 0 ? 0 : (0xffffffff << (32 - scope.prefix)) >>> 0;
  return ((address & mask) >>> 0) === scope.network;
}

export function commandPayload(command) {
  return [command.command, command.requestId, command.agentId, command.scope, command.issuedAt, command.expiresAt].join("\n");
}

export function signCommand(command, credentialHash) {
  return createHmac("sha256", credentialHash).update(commandPayload(command)).digest("hex");
}

export function verifyCommand(command, credentialHash, now = Date.now()) {
  if (command.command !== DISCOVERY_COMMAND) return "Unsupported command.";
  if (!command.requestId || !command.agentId) return "Malformed command.";
  if (!Number.isFinite(Date.parse(command.issuedAt)) || !Number.isFinite(Date.parse(command.expiresAt))) return "Invalid command timestamps.";
  if (Date.parse(command.expiresAt) <= now) return "Command expired.";
  try { parseAuthorizedScope(command.scope); } catch (error) { return error.message; }
  const expected = Buffer.from(signCommand(command, credentialHash), "hex");
  const provided = Buffer.from(String(command.signature || ""), "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return "Invalid command signature.";
  return "";
}

export function bearerToken(header) {
  const match = String(header || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export function normalizedDiscoveryResult(value, scope) {
  const ipAddress = String(value?.ipAddress || "").trim();
  if (!ipInScope(ipAddress, scope)) throw new Error(`Result IP ${ipAddress || "(missing)"} is outside the authorized scope.`);
  const macAddress = String(value?.macAddress || "").trim().toUpperCase();
  const hostname = String(value?.hostname || "").trim().slice(0, 253);
  const method = ["ARP", "ICMP", "DNS"].includes(value?.method) ? value.method : "ICMP";
  return {
    ipAddress,
    macAddress: /^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/.test(macAddress) ? macAddress.replaceAll("-", ":") : null,
    hostname: hostname || null,
    vendor: null,
    deviceType: null,
    status: "DISCOVERED",
    method,
  };
}

export function offlineState(agent, now = Date.now()) {
  if (["PENDING", "DISABLED", "REVOKED"].includes(agent.status)) return agent.status;
  const last = typeof agent.lastHeartbeat?.toMillis === "function"
    ? agent.lastHeartbeat.toMillis()
    : Date.parse(agent.lastHeartbeat || "");
  return !Number.isFinite(last) || now - last > HEARTBEAT_OFFLINE_AFTER_MS ? "OFFLINE" : "ACTIVE";
}
