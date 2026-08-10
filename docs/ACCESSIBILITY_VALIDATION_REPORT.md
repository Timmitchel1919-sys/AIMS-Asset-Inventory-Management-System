# Accessibility Validation Report

## KCS Azure Flow addendum

Dark navy text is used on pale-blue/cyan surfaces and white text on primary blue. Cyan is limited to focus rings, active indicators, icons, and larger accents. Navigation selection combines color with placement and a visible indicator; operational states retain labels and permanent colors. Focus-visible outlines, reduced motion/transparency, print fallbacks, and responsive reflow remain active.

Validation date: 2026-07-31  
Target: WCAG 2.2 AA; **not independently certified**

Source evidence includes semantic controls, accessible names on icon buttons, visible focus styles, route headings, responsive tables/cards and representative Playwright accessibility checks. Route error/loading states are shared.

Uncertified areas:

- Automated axe coverage is not installed across every route/state/theme.
- Complete keyboard focus order, modal focus trapping/restoration, live-region announcements and escape behavior.
- Contrast for every semantic state across all four available themes.
- 200% zoom, 400% reflow, high contrast, reduced motion and screen-reader testing.
- Mobile keyboard and real assistive-technology validation.

No legal or external WCAG certification is claimed.
# KCS Evergreen decisions

Primary actions use white on `#19763A`; accent actions use `#273014` on `#D8D54F`. Accent is not body text on white and never communicates state alone. Focus-visible controls receive a 3 px green outline with offset. Print becomes white with dark text and dark borders, and reduced-motion preferences suppress theme transitions.
# Azure Glass landing update (2026-08-03)

The public route includes semantic header/nav/main/section/footer structure, a skip link, logical headings, labeled controls, keyboard focus rings, text-bearing status badges, minimum touch targets, reduced-motion support, reduced-transparency solid fallbacks, and reflow without horizontal overflow in the tested desktop and 390px mobile browsers. No automated full WCAG audit was run; this remains a known validation limitation.
# KCS Azure Glass note

Navy text (`#0B2340`) is used on strong white glass surfaces; inputs use 0.96 white opacity and primary actions remain solid `#2C7EF4`. Cyan `#00AEEF` supplies visible focus treatment. Reduced motion, reduced transparency, and no-backdrop-filter fallbacks are present. State is still conveyed through labels and existing status tokens, not theme color alone.
# Login ICT Support dialog update

The dialog has an accessible title, modal semantics, ticket-first alert, semantic headings, focus containment and restoration, Escape close, 44px close/trigger targets, visible focus, reflowing contact cards, long-address wrapping, and a reduced-transparency fallback.
# AIMS landing accessibility validation

The public page includes a skip link, semantic header/main/section/footer landmarks, logical headings, keyboard-accessible controls, visible focus treatment, an announced mobile menu, and descriptive labels for all four device previews. Color is supplemental; text labels carry meaning.

Reduced-motion and reduced-transparency preferences are supported. Layouts reflow without horizontal scrolling at narrow widths and remain usable at increased zoom. The install guidance uses an accessible modal dialog with a labelled heading and close control.
# Emerald Glass addendum

Emerald uses white text on `#146C43`/`#0D2B1E`, forest text on mint/white, a `#2ECC71` focus indicator, and 48px collapsed navigation targets. Color is not used to replace labels or permanent status meaning. Reduced motion is inherited globally; reduced transparency switches glass surfaces to solid white.
