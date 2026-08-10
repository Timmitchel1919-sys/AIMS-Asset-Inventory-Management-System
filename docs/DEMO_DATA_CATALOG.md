# Demo Data Catalog

Version: `demo-2026.07-pc1`. All identities, emails, serials and operational examples are fictional.

- 20 serialized assets across KCSMD, KCSL, KCSBD, KCSRT and KCSPW.
- 11 quantity inventory items covering toner, cables, batteries, peripherals, adapters and cleaning material.
- Asset states include available, assigned, borrowed, repair, maintenance, damaged, archived and reserved.
- Inventory includes normal, low, out-of-stock and reserved examples.
- Personas cover administrator, inventory manager, technician, auditor, department manager and read-only demonstration access.
- Operational seeds include movements, overdue/issued borrowing, waiting-for-parts/diagnosing repairs, due/scheduled maintenance, active/completed audits, notifications, disposal and monthly/low-stock/audit reports.

## Required backup capture list

Capture from Candidate 1 at 1366×768, plus representative 360px views:

`/dashboard`, `/assets`, `/assets/ast-002`, `/assets/ast-002/labels`, `/inventory`, `/borrows`, `/repairs`, `/maintenance`, `/audits`, `/reports/monthly`, `/roles`, `/assistant`.

Captured at 1366×768: `presentation-screenshots/dashboard.png`, `presentation-screenshots/assets.png`, and `presentation-screenshots/assistant.png`. The remaining entries are the approved capture backlog; they are not represented as existing screenshots.

For a backup recording: reset first, use Inventory Manager, follow the demo script, keep the presentation strip visible at least once, avoid real browser profiles/notifications, record 1080p, and verbally state the mock/Firebase boundary.
# Asset status normalization

The presentation dataset continues to store business status and condition values, never CSS or color values. Recognized capitalization and legacy variants are normalized at the presentation layer; unknown values remain visible with a neutral fallback and are not discarded.

Extended normalization covers Assigned (`allocated`, `issued to employee`, `assigned-to-user`), Archived (`inactive archive`, `historical`, `retired record`), and Under Repair (`under-repair`, `under_repair`, `in repair`, `repair`). The normalization report groups original values, canonical values, affected counts, and manual-review flags.
