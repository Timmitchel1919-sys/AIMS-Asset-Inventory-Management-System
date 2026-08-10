# Theme Scope and Routing

The application stores an authenticated preference separately from the effective route theme.

- `/`, authentication, legal/support, and public download routes force `aimsAzureGlass` without overwriting the saved preference.
- Protected routes use `authenticatedThemePreference`.
- Navigation to a public route changes the effective theme immediately; returning to a protected route restores the saved preference.
- Invalid preferences fall back to `aimsAzureGlass`; supported legacy values migrate safely.
- PWA browser and OS branding always uses the Azure manifest and blue master icon.
