# Browser and UX verification matrix

| Test | 320 | 375 | 768 | 1024 | 1440 |
|---|---|---|---|---|---|
| Navigation | | | | | |
| Primary task | | | | | |
| Overflow and zoom | | | | | |
| Dialogs/forms | | | | | |
| Long text/localization | | | | | |

Test with keyboard-only, visible focus, reduced motion, screen-reader smoke test, 200% and 400% zoom where applicable. Async tests: loading, empty, partial, timeout, offline, 401/403, 429, 500, retry and duplicate submit. Include permission-denied and unauthorized action tests.

Record: environment, command, timestamp, target route, actual result, evidence artifact and PASS/FAIL/NOT_RUN.
