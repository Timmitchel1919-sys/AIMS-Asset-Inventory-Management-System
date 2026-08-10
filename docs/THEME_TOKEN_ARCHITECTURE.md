# Theme Token Architecture

## KCS Azure Flow addendum

`kcsAzureFlow` uses the same `ThemeId`, validation, application, persistence, and runtime PWA-branding path. Its exact foundations are `#D5EFFE`, `#00AEEF`, and `#2C7EF4`; derived shades live in `src/styles/kcs-azure-flow.css`. It does not override permanent `--asset-status-*` variables, add a provider, or change the organization fallback.

Theme variables control application surfaces and accents. Permanent asset-status variables live once in the base `:root` block of `src/styles/tokens.css`:

- `--asset-status-available-*`
- `--asset-status-assigned-*` — `#EDE9FE`, `#5B21B6`, `#8B5CF6`, `#7C3AED`
- `--asset-status-borrowed-*`
- `--asset-status-reserved-*`
- `--asset-status-under-maintenance-*`
- `--asset-status-under-repair-*` — `#FCE7F3`, `#9D174D`, `#EC4899`, `#DB2777`
- `--asset-status-damaged-*`
- `--asset-status-archived-*` — `#F1F5F9`, `#334155`, `#94A3B8`, `#64748B`

No `[data-theme]` selector redefines these variables. Theme switching may change surrounding surfaces but cannot reinterpret status meaning.

## KCS Evergreen

`kcsEvergreen` extends the existing registry and semantic `--color-*` variables. Its canonical raw aliases live in `src/styles/kcs-evergreen.css`; foundation colors are `#19763A`, `#D8D54F`, and `#FFFFFF`. The approved organization fallback remains `kcs-forest-gold`.
# KCS Azure Glass extension

The `kcsAzureGlass` theme maps its glass-specific `--theme-*` tokens onto the existing centralized `--color-*` semantic contract. Its exact foundation colors are `#D5EFFE`, `#00AEEF`, and `#2C7EF4`; permanent `--asset-status-*` tokens remain root-owned and theme-independent. Glass surfaces use 14px blur, with solid fallbacks and a 7px mobile value.
