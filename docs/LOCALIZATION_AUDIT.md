# Wave 1–7 Localization Audit

## KCS Azure Flow addendum

The canonical theme definition contains English and Dutch name, full description, light-theme label, blue school-management category, web/mobile compatibility, preview, and apply strings. The selector presents the compatibility description bilingually. Automated tests assert both language sets.

Validation date: 2026-07-31

Wave 9 final audit: English/Dutch key parity and existing localization tests remain automated, but route-local strings and complete controlled vocabulary across partial Waves 6–8 prevent final localization certification. Long-label, date/time-zone and number/currency review is not exhaustive.

Wave 8 adds paired English/Dutch assistant prompts, notices, limitation responses, workflow-link labels and empty states. Provider responses preserve the selected language. Complete central-catalog coverage for user lifecycle, permission simulator, settings categories, activity detail and every assistant intent remains incomplete.

The localization audit tests passed as part of the 143-test unit suite. Representative browser language coverage passed before the E2E command timed out, but the full Wave 8 localization/browser matrix is not certified.

Wave 7 reporting and notification surfaces retain paired English/Dutch labels through the established localization pattern. Route titles resolve through the shared catalog, but exhaustive localization of every report field, chart, schedule, escalation, management KPI and error state is incomplete.

## Automated evidence

- English and Dutch central-resource key parity passes.
- Wave 2 asset-catalog parity passes.
- Static translation-key and raw-JSX audits for their declared source scope pass.
- The complete unit suite passes: 137 tests across 17 files.
- Playwright language switching and representative Dutch mobile rendering pass.

## Wave 7 vocabulary currently covered

- Reports, export formats, schedules, generation metadata, notification center and preferences.
- Existing neutral print-preview labels and report summary metrics.
- Full centralization of all Wave 7 controlled vocabulary remains open.
- Success, validation, permission, offline and empty-state feedback through shared UI primitives.

Official KCS codes, user-entered names, ISO dates, route paths, identifiers and file-format names remain intentionally untranslated.

Central-catalog consolidation of older page-local bilingual expressions remains wider-project technical debt, not a Wave 4 source blocker.
# Public front page localization

All navigation, hero, platform modules, capabilities, workflow, status explanation, device guidance, security content, audience labels, CTA, footer notices, presentation notice, and install instructions are available in English and Dutch through `src/content/publicLanding.ts`. The selected language is persisted through the existing application context, and the document language is updated on the public page.

Permanent status names and conditions continue to use the centralized application translation keys through `AssetStatusBadge`; status colors are not duplicated in public-page copy or styles.
# Forest Gold localization

Theme metadata includes English `Forest Gold`, `Forest Gold theme`, `Institutional green and gold` and Dutch `Bosgroen en Goud`, `Thema Bosgroen en Goud`, `Institutioneel groen en goud` labels. Settings exposes the canonical theme alongside legacy themes.
# KCS Evergreen strings

The theme definition includes English and Dutch name, description, light-theme, community-green, web/mobile compatibility, apply, and preview strings. The Settings preview exposes bilingual compatibility copy without adding Firebase persistence.
# Azure Glass landing update (2026-08-03)

English and Dutch public content now covers navigation, hero, synthetic preview, features, workflow, statuses, device/PWA guidance, security, presentation notice, final CTA, and placeholder footer links. Visible section copy remains in `src/content/publicLanding.ts`; the localization audit tests passed.
# KCS Azure Glass labels

- English: KCS Azure Glass; Glassmorphism theme; Light theme; Works on web and mobile.
- Dutch: KCS Azure Glass; Glassmorphism-thema; Licht thema; Werkt op web en mobiel.
# Login ICT Support update

English and Dutch support labels, ticket-first policy, hours, escalation order, categories, simulated-workflow notice, security warning, and actions are centralized in `src/i18n/ictSupport.ts`. Names, roles, and approved email spellings remain untranslated.
