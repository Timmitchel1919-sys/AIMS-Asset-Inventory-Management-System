# AIMS Network Discovery Agent

Phase 1 is a discovery-only outbound HTTPS agent. It accepts only signed `DISCOVER_NETWORK` requests for its exact authorized RFC1918 CIDR (`/24` through `/32`). It does not execute shell commands, collect credentials, exploit devices, create assets, or scan outside scope.

Requires Node.js 22+. Create an enrollment in AIMS, then set `AIMS_DISCOVERY_BASE_URL` to the deployed Functions base URL and set the one-time `AIMS_ENROLLMENT_TOKEN`. Optionally set `AIMS_AGENT_CONFIG_PATH`. Run `npm start` from this directory. The credential is stored locally with restricted permissions and is never printed.
