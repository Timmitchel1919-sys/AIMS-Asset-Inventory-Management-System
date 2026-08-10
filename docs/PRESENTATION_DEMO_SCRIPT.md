# Presentation Demo Script

Target duration: 15–20 minutes. Run `npm run demo:validate`, `npm run build:presentation`, then `npm run preview:presentation`.

| Step | Persona / route | Action and expected result | Speaking point | Time |
|---:|---|---|---|---:|
| 1 | Inventory Manager, `/dashboard` | Select persona; show repository-derived metrics | Fictional data and simulated access | 1:30 |
| 2 | `/assets` | Search `KCSL-125`; open the printer | Codes, filtering and digital record | 1:30 |
| 3 | `/assets/ast-002/labels` | Show QR/barcode label and print preview | Internal route payload; no public database | 1:00 |
| 4 | `/assets/ast-002/assign` | Demonstrate assignment form; reset afterward if needed | Workflow validation and history | 1:30 |
| 5 | `/borrows` | Open overdue/issued examples; demonstrate approved workflow with an authorized persona | Role-aware lifecycle | 2:00 |
| 6 | `/repairs` | Open `REP-2026-0041` waiting for parts | Diagnosis and asset state consistency | 1:00 |
| 7 | `/maintenance` | Show due and scheduled tasks | Preventive planning | 1:00 |
| 8 | `/audits` | Show active/completed audits and explain partial discrepancy UI | Assurance workflow is still partial | 1:30 |
| 9 | `/reports/monthly` | Show monthly report surface | Mock snapshot; exports need human review | 1:00 |
| 10 | `/assistant` | Ask “Which inventory items are low in stock?” | Deterministic, read-only, no external AI | 1:00 |
| 11 | Read-only demonstration | Switch persona; open `/users` or edit route and show denial/navigation difference | UI permission simulation; backend enforcement not connected | 1:30 |
| 12 | Header/settings | Switch EN/NL and two themes | Localization and appearance | 1:00 |
| 13 | Presentation strip | Reset demo data | Exact deterministic recovery | 0:30 |

Backup captures should use the route list in `DEMO_DATA_CATALOG.md`; no screenshot is claimed until captured from the candidate build.
# Public front page opening

1. Open `/` and point out the subtle Presentation Environment label.
2. Explain that all visible product-preview content is illustrative and no operational records are public.
3. Use Features and How it works to demonstrate in-page navigation.
4. Switch between English and Dutch from the public header.
5. Show install availability or the iOS Add to Home Screen guidance where supported.
6. Select Sign in to continue to the unchanged `/login` experience.
# Forest Gold theme demonstration

Open Settings → Appearance, select Forest Gold, reload, and show that the selection persists. Review the green sidebar with white active item and gold indicator, dashboard cards, forms, asset-status badges, public page, and login page.
# Azure Glass public-page walkthrough

Start at `/` in presentation mode and point out the subtle environment indicator and simulated-data notice. Walk through the synthetic hero dashboard, lifecycle features, workflow, permanent status system, supported devices/PWA guidance, and accountability section. Finish with the CTA, then open `/login`. Do not present the synthetic quantities or activity lines as school records.
# Login ICT Support demonstration

Open **Need help? Contact ICT Support**, show the ticket-first notice and approved directory, then explain that the Ticket action is simulated and opens `/support#ticket-system`; it does not store a ticket or send notifications.
# AIMS public presentation demo

1. Open `/` while signed out and introduce the AIMS purpose and official blue identity.
2. Switch EN/NL in the header and confirm the full public surface and dashboard-preview labels update.
3. Review the desktop, laptop, tablet, and mobile previews; state that all records are synthetic.
4. Walk through the eight modules and six lifecycle steps.
5. Read the presentation security notice and explain that Firebase enforcement is a later phase.
6. Select Install App. Use the native prompt when available or demonstrate the browser/iOS guidance dialog.
7. Select Sign in to AIMS and confirm navigation to `/login`.

Known limitation: authentication and permanent backend security remain simulated until the planned Firebase implementation.
