# Responsive Validation Report

## KCS Azure Flow addendum

The theme uses existing responsive semantics rather than mobile-specific colors. Automated checks cover 320×568, 360×800, 375×812, 390×844, and 412×915 across landing/app routes, plus the existing tablet/desktop matrix. The sidebar remains a drawer, cards stack, tables retain the mobile-record strategy, and horizontal overflow is rejected.

Validation date: 2026-07-31  
Status: **Partial**

The shared shell, data tables/mobile cards, dialogs, forms and primary modules have responsive CSS and representative 360px Playwright coverage. Desktop checks cover the default viewport.

Outstanding certification includes every required route at 360, 768, 1024, 1440 and 1920px; landscape mobile; long Dutch labels; zoom/reflow; sticky headers; charts; wide permission matrices; assistant history; settings; and overflow inspection on real devices. Browser completion evidence is therefore pending.
# KCS Evergreen coverage

Evergreen is token-driven and uses the existing responsive shell, mobile drawer, mobile record cards, full-width mobile forms and viewport-contained dialogs. Browser checks cover representative 360 px and 1366 px viewports; no separate mobile color rules are introduced.
# Azure Glass landing update (2026-08-03)

Playwright validated the public page at 320×568, 360×800, 375×812, 390×844, 412×915, 768×1024, 820×1180, 1024×768, 1366×768, 1440×900, and 1920×1080. The public landing specifications and viewport matrix passed with no horizontal overflow and no critical console errors. CSS breakpoints cover 1120px, 860px, 560px, and 360px, including stacked CTAs, wrapped badges, vertical workflow, compact navigation, and reduced mobile blur.
# KCS Azure Glass note

The theme retains existing responsive layout breakpoints. Below 780px it simplifies the page gradient, raises surface opacity to 0.90, reduces blur from 14px to 7px, and reduces shadow depth. Existing mobile cards, drawer navigation, safe-area bottom navigation, full-width forms, and viewport-bounded dialogs continue to use semantic tokens.
# AIMS responsive validation report

The landing layout has explicit breakpoints at 1100px, 860px, and 560px and supports reflow down to 320px. The implementation prevents horizontal overflow, uses fixed aspect ratios for every screen, masks all preview content, prioritizes the mobile preview on phone widths, and replaces the desktop navigation with an accessible menu.

Required validation widths: 320×568, 360×800, 375×812, 390×844, 412×915, 768×1024, 820×1180, 1024×768, 1280×720, 1366×768, 1440×900, and 1920×1080. Automated Playwright checks cover desktop and mobile; manual browser inspection remains recommended after changes to device-frame geometry.
# Emerald Glass addendum

Protected mobile navigation inherits Emerald when selected. At 780px and below, glass opacity increases to 92% and blur decreases to 10px for readability and performance. Public mobile surfaces remain Azure. Existing safe-area and touch-target behavior is unchanged.
