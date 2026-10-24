# Network Discovery Phase 1

Network Discovery is deliberately separate from Device Management. It identifies reachable devices; it does not control them, create assets, infer matches, collect credentials, exploit services, or cross an authorized CIDR boundary.

## Trust boundaries

- The verified owner `aliendas@kangoeroeschool.com` is the only browser identity allowed to read or administer discovery data.
- Firestore clients can read owner-visible records but cannot write discovery collections. Cloud Functions use the Admin SDK after authorization.
- Agent enrollment tokens are single-use, hashed at rest, and expire after 15 minutes.
- Agent credentials are returned once, stored locally, and represented only by a SHA-256 hash in Firestore.
- Requests expire after five minutes and contain only a signed `DISCOVER_NETWORK` command for the agent's exact private `/24`–`/32` CIDR.
- Submitted IP addresses are validated again by the server. Results are normalized as `DISCOVERED`; unknown metadata stays `null`.
- Lifecycle and scope events are appended to the existing `activityLogs` audit collection.

## Components

- `functions/discovery.js`: validation, signing, normalization, and offline-state rules.
- `functions/index.js`: owner callables and authenticated HTTPS agent endpoints.
- `discovery-agent/`: Node.js 22 Windows-first agent using ARP, bounded ICMP and reverse DNS. Process spawning never uses a shell.
- `/network-discovery`: owner-only agent, request and discovered-device workspace.

## Agent operation

Create an enrollment in AIMS. On the Windows host, install Node.js 22+, set `AIMS_DISCOVERY_BASE_URL` to the deployed Cloud Functions regional base URL, set the one-time `AIMS_ENROLLMENT_TOKEN`, and optionally set `AIMS_AGENT_ID` and `AIMS_AGENT_CONFIG_PATH`. Run `npm start` in `discovery-agent`.

For production, run the process under a restricted Windows service account with read/write access only to its config file. Permit outbound HTTPS to the deployed function endpoints and required local ICMP/ARP activity. Never place an enrollment token or credential in source control, command logs, screenshots, or shared scripts.

## Deferred by design

Asset matching, asset creation, service fingerprinting, SNMP, remote commands, Linux packaging, Docker packaging, scheduled scans, and privileged network integrations require separate authorization and threat review.
