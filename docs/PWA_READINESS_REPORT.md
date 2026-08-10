# PWA Readiness Report

## KCS Azure Flow addendum

`kcsAzureFlow` maps runtime theme color to `#2C7EF4` and reuses the existing Azure icon and manifest. Static manifest and cached installed splash values cannot be switched reliably per user at runtime and may require reinstall. No deployment was performed.

Validation date: 2026-07-31  
Status: **Partial**

Implemented:

- `vite-plugin-pwa` with `generateSW`, standalone display, start URL/scope, theme/background colors and business/productivity categories.
- Generated manifest, service worker registration and 43-entry precache in the production build.
- Install prompt, online/offline status and update prompt components.
- Route-level offline page.

Open:

- Raster 192×192 and 512×512 any/maskable icons and browser installability evidence.
- Explicit navigation fallback and reviewed runtime cache expiration/size policies.
- Dirty-form protection before accepting an update.
- Offline mutation queue/conflict resolution, which must not be claimed as production-ready.
- Current iOS/Android/Windows standalone and update-cycle validation.

The service worker must never cache credentials, tokens, sensitive exports or private evidence.
# KCS Evergreen update

The runtime PWA branding registry now maps `kcsEvergreen` to theme color `#19763A`, the existing forest KCS icon, and the existing forest manifest. The static manifest background remains white. Installed platforms may cache splash branding until reinstall; this is a browser/platform limitation.
# KCS Azure Glass note

Selecting `kcsAzureGlass` persists the canonical key, uses the Azure logo and manifest, and sets the runtime PWA theme color to `#2C7EF4`. Install and offline banners use strong semantic surfaces and remain readable without backdrop-filter support.
