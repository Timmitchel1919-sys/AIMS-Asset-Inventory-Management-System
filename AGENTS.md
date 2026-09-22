# AIMS — Agent Working Rules

This file applies to every AI coding agent working in this repository
(Claude Code, Codex, or any other agent). The project owner has set the
following as standing policy for this repo.

## Rule: ship every change, every prompt

After completing the work requested in a prompt (a code change, a fix, a
new feature), before ending the turn:

1. **Validate first, always:**
   - `npx tsc -p tsconfig.app.json --noEmit` (or the repo's typecheck script)
   - `npx vitest run` for anything the change could plausibly affect
   - `npx vite build` (must succeed)
   Do not skip this step to save time. Do not commit or deploy on a
   failing build/typecheck/test — stop and report the failure instead.

2. **Commit** with a clear, descriptive message explaining what changed and
   why (not just "fix" or "update"). Follow the existing commit style in
   `git log` (imperative, `type(scope): summary`, body explaining root
   cause when it's a bug fix).

3. **Push** to `origin/main` (this repo works directly on `main`; only
   branch/PR when the user asks for one explicitly, e.g. a larger,
   multi-step feature).

4. **Deploy** the validated build:
   - `firebase deploy --only hosting --project aims-asset-inventory-system`
     — always, for any UI/frontend change.
   - Also `firestore:rules` and/or `functions` **only when those specific
     files changed** in this prompt's diff. Don't redeploy them
     unnecessarily.

5. **Report back** plainly: what changed, the commit SHA, and confirmation
   that hosting is live at https://aims-asset-inventory-system.web.app —
   don't just say "done", show it worked (build succeeded, tests passed,
   deploy completed).

## Guardrails (do not skip these even though the rule above says "ship
every prompt")

- Never commit `.env*` files, service-account JSON keys, or any other
  secret. Check `git status`/`git diff` before committing if anything
  looks unfamiliar.
- Never `git push --force` to `main`. Never rewrite history.
- If the change is genuinely destructive, ambiguous, or the build/tests
  fail and the cause isn't a quick fix: stop and ask the user rather than
  pushing/deploying something broken or something they didn't ask for.
- If a request depends on a backend contract, permission, or data that
  doesn't exist yet: say so and stop, rather than faking it client-side.

## Reference

- Repo: https://github.com/Timmitchel1919-sys/AIMS-Asset-Inventory-Management-System
- Firebase project / Hosting: `aims-asset-inventory-system`
- Production URL: https://aims-asset-inventory-system.web.app
