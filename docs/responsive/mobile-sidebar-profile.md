# Mobile sidebar and profile panel

## Scope and evidence

The supplied 1080 x 2408 phone screenshot shows an open navigation drawer with module icons and labels compressed into a narrow centered column. The profile avatar sits at the bottom of the drawer. The implementation also mounted the profile panel inside the transformed drawer, so closing the drawer could translate or clip the panel.

## Responsive behavior

- At 780 px and below, the drawer uses the available width up to 22 rem and keeps a 3 rem edge of the underlying page visible.
- Every module is a full-width grid row with a 44 px icon column, a flexible label column, and at least a 52 px row height.
- The desktop collapsed preference cannot hide or recenter labels inside the mobile drawer.
- A global topbar shows the current module on the left, global search in the middle and the profile control at the far right.
- Module pages do not repeat their title or a second local search field; table filters, views, export and create/import actions share one responsive toolbar.
- The profile panel is a root-level fixed layer anchored below the topbar profile control, whether the drawer is open or closed.
- The mobile drawer uses about 78% of the viewport, matching the supplied phone reference while leaving the dimmed page edge visible.

## Viewport matrix

| Width | Expected behavior |
| --- | --- |
| 320 px | Five equal bottom-navigation cells and a compact global topbar; no horizontal document overflow |
| 375 px | Full-width drawer rows with aligned icons and labels |
| 768 px | Mobile drawer and bottom navigation remain active |
| 1024 px | Desktop sidebar and desktop profile anchoring |
| 1440 px | Desktop layout remains unchanged |

## Interaction and accessibility

- The topbar profile control exposes `aria-haspopup`, `aria-expanded`, and `aria-controls`.
- Escape closes the panel and restores focus to the control that opened it.
- Clicking the scrim closes the panel.
- Drawer module rows and bottom-navigation controls meet the 44 px minimum touch target.
