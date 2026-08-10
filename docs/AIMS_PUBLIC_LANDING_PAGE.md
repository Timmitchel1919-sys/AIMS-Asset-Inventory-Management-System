# AIMS public landing page

The `/` route is the public AIMS presentation surface. It is lazy-loaded through the route manifest and does not load protected dashboard business logic. `/login` remains public; `/dashboard` and operational routes retain the existing authentication and permission checks.

The page contains a glass header, hero, realistic device showcase, eight core modules, six-step workflow, security notice, device compatibility and PWA sections, final CTA, and navy footer. English and Dutch copy lives in `src/content/aimsLanding.ts`; visible page content is not embedded in JSX.

All preview information is synthetic. No real users, asset records, or organization inventory is exposed.
