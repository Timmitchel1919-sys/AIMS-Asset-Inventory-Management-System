# AIMS operational toolbar hierarchy

## Scope and evidence

Observed routes: Categories, Departments, Assignments and Inventory Movements. The supplied screenshots show primary create actions detached above the white data toolbar, while counts, filters and export remain inside it. Reports are explicitly excluded.

## Action inventory

1. Context: the global topbar owns the module name and global search.
2. Evidence: record counts and operational status counters start the data toolbar.
3. Refinement: filters and export follow the counters.
4. Primary action: create or assign closes the toolbar at the far right.

Destructive actions remain inside dialogs or selection toolbars and never compete with the primary action.

## Before and after

- Before: global search → detached create button → toolbar counters/filters/export → table.
- After: global search → one white toolbar containing counters → filters → export → primary action → table.

## Responsive behavior

Desktop keeps the primary action at the right edge. Mobile preserves DOM order and allows the toolbar action group to wrap or scroll without horizontal page overflow. Reports retain their existing specialized layout.

## Accessibility

The visual and DOM order match. Existing button labels, focus handling, permissions and dialog behavior are preserved. Status remains text-backed and is not communicated by color alone.
