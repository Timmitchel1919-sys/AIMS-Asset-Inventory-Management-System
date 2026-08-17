# KCS Current Implementation Matrix

## Firebase production integration addendum (2026-08-16)

The earlier frontend-only readiness decision below is historical. The production runtime now uses Firebase Authentication and `FirebaseInventoryRepository`; `MockRepositoryProvider` is limited to explicit local demo/test and presentation modes. Exact school-domain plus verified-email checks gate repository mounting, and Firestore/Storage rules independently enforce the same policy.

| Capability | Status | Current implementation |
|---|---|---|
| Authentication/domain access | Implemented | Email/password and Google post-auth checks; verification screen/token refresh; wrong domains rejected |
| Production business repository | Implemented | Existing repository contract backed by Firestore; no production mock fallback |
| Assets/code groups | Implemented | Persistent records; transactional code-group allocation and immutable code reservation |
| Inventory/reservations/transactions | Implemented | Persistent records; authoritative stock/reservation transactions prevent negative/over-reserved stock |
| Assignments/borrows/repairs/maintenance/movements/disposals | Implemented | Existing workflows persist linked records together through atomic commits |
| Audits/reports/notifications | Partial | Implemented UI workflows persist; pre-existing placeholder routes remain partial; notifications have one bounded listener |
| Profiles/preferences | Implemented | `users/{uid}` profile and appropriate preferences; privilege fields protected by rules |
| Storage upload UI | Partial | Secure owner-path rules deployed; existing attachment/signature UI is not fully migrated to Storage uploads |
| AI/backup/integrations | Mock/not implemented | Unchanged and not falsely activated by Firebase integration |
| Security rules | Implemented | Single production `firestore.rules`, immutable logs/codes, protected self-profile, explicit collections, default deny |

## Wave 9 final-audit addendum

The manifest baseline remains 172 total, 83 implemented, 89 partial and 0 missing. Wave 9 does not reclassify rendering-only aliases as implemented. Four themes are present while final certification requires five. Final decision: **NOT READY FOR FIREBASE**.

Validation date: 2026-07-31  
Frontend decision: **NOT READY FOR FIREBASE**

Legend: **I** source-implemented; **P** outside the completed wave or still partial; **M** missing.

## Route totals

| Required | Implemented | Partial | Missing |
|---:|---:|---:|---:|
| 172 | 83 | 89 | 0 |

The totals are generated from `src/routes/manifest.tsx`. Wave 7 adds 29 routes, producing 20 reporting, 4 notification and 7 management-intelligence routes. They remain partial because the exhaustive report-specific UI and state matrices are not complete.

Wave 8 adds canonical user-detail/access/session, role/permission, activity-category and assistant subroutes. All Wave 8 routes remain partial: provider-neutral assistant safety foundations are implemented, while the complete user lifecycle, repository permission enforcement, expanded activity schema and route-specific administration workflows remain open. See `WAVE_8_COMPLETION_REPORT.md`.

## Module status

| Area | Routes | Status | Evidence |
|---|---:|:---:|---|
| Authentication | 4 | P | Mock authentication and protected redirects |
| Dashboard | 1 | P | Repository metrics and responsive shell |
| Assets | 10 | I | Wave 2 create, detail, edit, history, labels, movement, assignment, import and disposal initiation |
| Inventory/reference data | 24 | I | Wave 3 quantity inventory, operations, import, categories, locations and departments |
| Assignments | 6 | I | Create, detail, edit, return, history, eligibility rules, accessories, condition/signature metadata and immutable events |
| Borrowing | 9 canonical + 3 aliases | I | Request, detail, edit, approve/reject, issue, return, overdue queue, history, reminders/escalation and printable agreement/receipt |
| Repairs | 11 | I | Reporting, diagnosis, approval, parts, testing, completion, return and immutable history |
| Maintenance | 12 | I | Dashboard, calendar, schedules, execution, completion, upcoming/overdue queues and history |
| Movements | 6 | I | Immutable list/detail/history, manual creation, transfers and compensating corrections |
| Service forms | 1 | P | Existing neutral previews |
| Audits | 18 | P | Seeded sampling, frozen snapshots, execution records, discrepancy/corrective-action contracts and routed surfaces exist | Exhaustive workflow UI, offline observation queue, charts, recount/reinspection, adjustment approvals and all route-state evidence |
| Reports | 20 | P | Provider-neutral definitions/results, mock generation, history data, scheduling and export-security rules | Complete report builder, every operational report screen, downloads, charts, preview/history and state matrices |
| Notifications | 4 | P | Read/unread, dismissal, restoration, escalation, deduplication and routed surfaces | Complete preferences/history/escalation interfaces and role-recipient workflows |
| Management intelligence | 7 | P | KPI, risk and data-quality domain calculations plus routes | Complete dashboard-specific charts, filters, drilldowns and exports |
| Remaining administration/system routes | 16 | P | Existing mock functionality unchanged |
| Permission/not-found | 2 | I | Direct denial and catch-all states |

## Wave 4 domain guarantees

- Only eligible assets can be assigned or borrowed.
- Assignment and borrowing state transitions are explicit and validated.
- Date ranges, overdue days, accessory discrepancies and condition outcomes are domain rules.
- Repository mutations update linked asset state and append movement, workflow-history and activity records.
- Returned workflow records cannot be reopened; edits require an auditable reason.
- Partial borrowing returns, rejection reasons, reminders and escalation metadata are supported.
- Granular assignment and borrowing permission identifiers are declared; existing role-compatible guards remain in force.
- English/Dutch page copy and responsive shared components are retained.

## Validation

| Gate | Result |
|---|---|
| Type-check | Pass |
| ESLint | Pass |
| Unit tests | 143 passed across 18 files |
| Production/PWA build | Pass; 2,406 modules; 43 precache entries |
| E2E assertions | 19 passed, 0 failed before the 120-second command limit |
| Browser runner | Incomplete current certification; the runner timed out while test 20+ remained |

The statement previously here that Firebase was not connected is superseded by the production integration addendum above.
# Permanent asset status/color system

Source-complete: centralized typed mapping including Assigned, Archived, and Under Repair; fixed cross-theme tokens; reusable accessible badge; ICT Asset table/detail integration; form and repository synchronization/validation; assignment, repair, and archive workflow enforcement; EN/NL labels; normalization report/fallback; print styling; and unit coverage.
# Public front page addition

| Capability | Status | Notes |
|---|---|---|
| Public `/` route | Implemented | Lazy public route; no forced login redirect |
| `/login` route | Unchanged | Existing login design and mock authentication |
| Protected operational routes | Unchanged | Existing authentication and role-permission boundary |
| EN/NL public content | Implemented | Dedicated typed content module |
| PWA install experience | Implemented | Browser prompt plus iOS guidance |
| Public operational repository access | None | Landing page does not consume repository context |
| Firebase | Implemented | Authenticated production repository; public page does not query protected collections |
