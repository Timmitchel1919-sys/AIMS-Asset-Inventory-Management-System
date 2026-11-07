# Mobile sidebar and profile panel

## Scope and evidence

The supplied 1080 x 2408 phone screenshot shows an open navigation drawer with module icons and labels compressed into a narrow centered column. The profile avatar sits at the bottom of the drawer. The implementation also mounted the profile panel inside the transformed drawer, so closing the drawer could translate or clip the panel.

## Responsive behavior

- At 780 px and below, the drawer uses the available width up to 22 rem and keeps a 3 rem edge of the underlying page visible.
- Every module is a full-width grid row with a 44 px icon column, a flexible label column, and at least a 52 px row height.
- The desktop collapsed preference cannot hide or recenter labels inside the mobile drawer.
- The profile panel is a root-level fixed layer and can be opened from both the drawer profile control and the always-available bottom navigation profile control.
- Opening the profile panel from the bottom navigation closes the drawer first; opening it from the drawer leaves the drawer open.

## Viewport matrix

| Width | Expected behavior |
| --- | --- |
| 320 px | Six equal bottom-navigation cells; no horizontal document overflow |
| 375 px | Full-width drawer rows with aligned icons and labels |
| 768 px | Mobile drawer and bottom navigation remain active |
| 1024 px | Desktop sidebar and desktop profile anchoring |
| 1440 px | Desktop layout remains unchanged |

## Interaction and accessibility

- Both profile controls expose `aria-haspopup`, `aria-expanded`, and `aria-controls`.
- Escape closes the panel and restores focus to the control that opened it.
- Clicking the scrim closes the panel.
- Drawer module rows and bottom-navigation controls meet the 44 px minimum touch target.
