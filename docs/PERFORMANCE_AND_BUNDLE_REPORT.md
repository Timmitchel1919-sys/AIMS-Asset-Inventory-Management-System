# Performance and Bundle Report

Validation date: 2026-07-31

Architecture:

- Page components are lazy-loaded through the route manifest.
- Dashboard charts remain in a large lazy chunk rather than initial route code.
- Lists use query pagination rather than rendering the full seed set.
- The deterministic AI provider is local and contains no network/provider library.

Final build: 2,406 transformed modules and 43 precache entries totaling 1,089.22 KiB. Largest emitted JavaScript chunks were the shared application chunk at 382.33 kB (111.00 kB gzip) and Dashboard at 367.78 kB (108.34 kB gzip); asset management was 74.97 kB (21.76 kB gzip). Dashboard/chart code remains lazy by route. No speculative virtualization or major dependency upgrade was performed.

Dependencies are React/Vite, routing, forms/schema, charting, icons, date helpers, queries, QR and PWA support. No Firebase or export SDK was installed. A formal license/legal review remains external.

`npm ls --depth=0` resolved the direct tree. `npm audit --omit=dev` could not run because npm returned `ENOLOCK`; a pnpm audit fallback was unavailable because no `pnpm` executable is installed. No lockfile was created merely to satisfy an audit command.
