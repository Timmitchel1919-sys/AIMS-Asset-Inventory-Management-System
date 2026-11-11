# Security and privacy boundary

UX confirmation is not authorization. Enforce authorization and permissions server-side; require appropriate reauthentication for critical operations. Avoid storing secrets in design briefs, screenshots, logs or LLM prompts. Use synthetic data for tests. Do not weaken CSRF protections, audit logs, rate limits or destructive-action approval flows for visual convenience. Respect existing project-specific policy and human approval gates. Never deploy or delete without explicit authorization.
