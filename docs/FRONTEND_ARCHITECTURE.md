# KCS frontend architecture

Last updated: 2026-07-30

## Application architecture

The frontend is a strict TypeScript React/Vite PWA. It is organized around one route manifest, a permission-aware application shell, lazy feature modules, semantic design tokens, centralized mock repositories and context providers for session, language, theme and transient UI state.

The enforced data path is:

`route -> feature page -> InventoryRepository contract -> MockInventoryRepository`

Pages do not import operational fixture arrays and do not make backend calls. The future Firebase adapter must implement the same repository contract; trusted mutations can then move behind callable functions without changing page APIs.

## Source boundaries

| Concern | Authoritative source |
|---|---|
| Routes, titles, breadcrumbs, nav visibility, permissions, lazy imports | `src/routes/manifest.tsx` |
| Role-to-permission mapping | `src/auth/permissions.ts` |
| Operational contracts and workflow commands | `src/data/contracts.ts` |
| Stateful development repository and seed snapshot | `src/data/mockRepository.tsx`, `src/data/mock.ts` |
| Domain invariants and transitions | `src/domain/rules.ts` |
| English/Dutch key registry and fallback | `src/i18n.ts` |
| Semantic theme tokens | `src/styles/tokens.css` |
| Shared shell and responsive navigation | `src/components/shell.tsx` |
| Route loading/error boundaries | `src/components/RouteBoundary.tsx` |

## Full route manifest

The executable manifest contains 40 entries.

| Area | Routes |
|---|---|
| Authentication | `/login`, `/register`, `/forgot-password`, `/reset-password` |
| Dashboard | `/dashboard` |
| Assets | `/assets`, `/assets/new`, `/assets/:id/edit`, `/assets/:id` |
| Reference and stock | `/inventory`, `/categories`, `/locations`, `/departments` |
| Assignments and borrowing | `/assignments`, `/borrow`, `/borrow/new`, `/borrow/:id` |
| Service | `/service-forms`, `/repairs`, `/repairs/:id`, `/maintenance` |
| Movement and audit | `/movements`, `/movements/new`, `/audits`, `/audits/new`, `/audits/:id` |
| Insights and administration | `/reports`, `/notifications`, `/assistant`, `/users`, `/roles`, `/activity` |
| Disposal | `/disposals`, `/disposals/new`, `/disposals/:id` |
| Settings and system | `/settings/*`, `/install`, `/offline`, `/403`, `*` |

`App.tsx`, the desktop sidebar and mobile navigation all consume this manifest. Direct protected navigation is checked with the same permission model used to hide navigation items.

## Domain-model manifest

- Identity: user, role, permission and local preference state.
- Inventory: serialized assets, quantity inventory, category, location and department references.
- Operations: assignments, borrow records, repairs, maintenance schedules and immutable movements.
- Assurance: audits, audit items, disposals, notifications and activity events.
- Platform: theme, language, PWA state and repository command/result envelopes.

The current operational snapshot is typed as `MockSnapshot`. `InventoryRepository` exposes `getSnapshot`, `subscribe`, `execute` and `reset`. Commands cover 30 mock actions across asset, stock, assignment, borrow, repair, maintenance, movement, audit, disposal, settings and notification domains.

Core rules prohibit negative stock, invalid lifecycle transitions, borrowing unavailable assets, out-of-order disposal completion and disposal of assets with active loans. Mutations append activity records and update related asset state.

## Reusable-component inventory

- Shell: `AppShell`, sidebar, top bar, breadcrumbs, mobile drawer and bottom navigation.
- Primitives: `Button`, `Card`, `Badge`, `Field`, `SearchInput`, loaders and state surfaces.
- Domain compositions: asset form/detail/list, audit form, disposal list and `WorkflowCenter`.
- Feedback: suspense loader, route error boundary, inline status/error responses and system-state pages.
- Data display: responsive tables, metric cards, activity timelines and module lists.

Remaining componentization work is recorded in the acceptance report; generic operational screens are intentionally shared but do not yet provide every domain-specific editor.

## Design-token architecture

`src/styles/tokens.css` defines geometry, typography, elevation, motion and semantic color roles. Three theme selectors override semantic variables only:

1. KCS Forest Gold
2. KCS Azure Intelligence

Components consume semantic variables rather than theme-specific palette values. Theme selection is validated before application, saved locally and covered by unit and browser tests.

## Mock-data architecture

The centralized repository owns the mutable development snapshot and simulates latency. Feature pages subscribe through `useMockSnapshot`; workflow pages dispatch typed commands. This preserves referential updates across assets, inventory, assignments, borrowing, repairs, maintenance, movements, audits, disposals and activity.

`reset()` recreates the deterministic seed state for tests. The architecture is intentionally in-memory: reload persistence is not claimed, and no Firebase SDK or configuration is present.

## Localization and accessibility

Route titles, breadcrumbs, shared navigation and shell controls use centralized English/Dutch keys with English fallback and development-time missing-key warnings. Several feature-page body strings remain English-only, so localization acceptance is not complete.

The shell uses banner, main, navigation and complementary landmarks; controls have accessible names; visible focus uses a semantic focus token. Automated browser checks cover landmarks and unnamed buttons on representative routes. A full WCAG contrast, keyboard-order and assistive-technology audit remains required.

## Build, PWA and test architecture

- `npm run typecheck`: strict application type checking.
- `npm run lint`: ESLint over source and tests.
- `npm test`: Vitest domain, permissions, repository, localization and token tests.
- `npm run build`: type check, route-split production build and PWA generation.
- `npm run test:e2e`: Playwright production-preview tests in desktop and mobile Edge projects.

The browser-plugin runtime was attempted first but failed to initialize in this environment (`Cannot redefine property: process`); Playwright against the local production preview is the documented fallback.

## Gated implementation plan

1. Complete remaining localized strings and domain-specific forms/actions.
2. Complete table controls, empty/loading/error/offline variants and accessibility audit.
3. Re-run the frontend gate until every checklist item is evidenced.
4. Only then add a Firebase repository adapter, Auth, Firestore, Storage, Functions, Rules, indexes and emulator fixtures.
5. Pass a separate Firebase acceptance gate.
6. Deploy only after both gates pass.

No Firebase integration or deployment is authorized while the frontend gate is marked not ready.
