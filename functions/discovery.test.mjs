import test from "node:test";
import assert from "node:assert/strict";
import {
  DISCOVERY_COMMAND,
  ipInScope,
  normalizeAgentId,
  normalizedDiscoveryResult,
  parseAuthorizedScope,
  sha256,
  signCommand,
  verifyCommand,
} from "./discovery.js";

test("accepts a canonical private /24 and blocks public, oversized, and noncanonical scopes", () => {
  assert.equal(parseAuthorizedScope("192.168.10.0/24").hostCount, 256);
  assert.throws(() => parseAuthorizedScope("192.168.10.1/24"));
  assert.throws(() => parseAuthorizedScope("8.8.8.0/24"));
  assert.throws(() => parseAuthorizedScope("10.0.0.0/16"));
});

test("enforces exact authorized scope", () => {
  assert.equal(ipInScope("192.168.10.52", "192.168.10.0/24"), true);
  assert.equal(ipInScope("192.168.20.52", "192.168.10.0/24"), false);
});

test("signs deterministic structured commands and rejects tampering or expiration", () => {
  const command = {
    command: DISCOVERY_COMMAND,
    requestId: "req-1",
    agentId: "KCS-DISCOVERY-01",
    scope: "192.168.10.0/24",
    issuedAt: "2026-10-23T20:00:00.000Z",
    expiresAt: "2026-10-23T20:05:00.000Z",
  };
  const key = sha256("agent-secret");
  const signed = { ...command, signature: signCommand(command, key) };
  assert.equal(verifyCommand(signed, key, Date.parse("2026-10-23T20:01:00Z")), "");
  assert.match(verifyCommand({ ...signed, scope: "192.168.20.0/24" }, key, Date.parse("2026-10-23T20:01:00Z")), /signature/i);
  assert.match(verifyCommand(signed, key, Date.parse("2026-10-23T20:06:00Z")), /expired/i);
});

test("normalizes agent identity and keeps unknown discovery metadata null", () => {
  assert.equal(normalizeAgentId(" kcs discovery 01 "), "KCS-DISCOVERY-01");
  const result = normalizedDiscoveryResult({ ipAddress: "192.168.10.52", method: "ARP" }, "192.168.10.0/24");
  assert.equal(result.status, "DISCOVERED");
  assert.equal(result.vendor, null);
  assert.equal(result.hostname, null);
});
