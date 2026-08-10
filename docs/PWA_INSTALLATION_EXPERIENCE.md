# PWA installation experience

The landing page reuses the application install-prompt handling exposed by `usePwaInstall` in `PwaStatus.tsx`. Install actions appear only when `beforeinstallprompt` is available. After selection, the browser owns the confirmation and outcome.

On iPhone and iPad, where the browser prompt is unavailable, the install action opens localized guidance to use the browser Share menu and choose Add to Home Screen. Already installed standalone experiences do not show an install action. The public header, device section, and final CTA follow the same availability rules.

Installation support varies by browser, operating system, manifest eligibility, and secure hosting context.
# AIMS PWA installation experience

`PwaInstallProvider` owns the browser install prompt and installed state. Every public Install App control uses `PwaInstallButton`, so header, hero, compatibility, and final CTA controls share one prompt. `PwaInstallDialog` supplies iOS Add to Home Screen guidance and browser-menu guidance when a native prompt is unavailable. Controls disappear in standalone mode.

No APK, EXE, or ZIP is offered by the public page. The browser version remains usable without installation. Buttons retain the approved glossy gradient and download arrow while idle.
