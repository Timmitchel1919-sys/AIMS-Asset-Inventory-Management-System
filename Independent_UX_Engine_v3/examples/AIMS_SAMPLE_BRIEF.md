# Example only — AIMS digiboard management

Evidence: USER-STATED requirement to manage school ICT assets; INFERRED primary workflow to find offline digiboards. No repository inspection performed.

Primary task: find a specific digiboard by location and determine its current connectivity status.

Acceptance criteria:
1. Operator can search by asset ID and filter by location.
2. Each row shows status as text plus icon; never color alone.
3. API timeout displays retry and retains current filters.
4. Destructive operations require explicit confirmation and server-side authorization.
5. Mobile layout exposes the same primary task as desktop.

Validation: inspect real API schema, permissions, existing design tokens and run browser tests before declaring production-ready.
