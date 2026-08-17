@echo off
npx -y firebase-tools@latest emulators:exec --project aims-rules-test --only firestore,storage "vitest run --config vitest.rules.config.ts --configLoader runner"
exit /b %errorlevel%
