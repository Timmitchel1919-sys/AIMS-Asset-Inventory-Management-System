# Acceptance and benchmark plan

The package integrity validator checks structure only. To establish real quality:

1. Run each skill against 3 real tasks: a fresh screen, a complex existing screen and a failure-state scenario.
2. Compare baseline agent without skill versus agent with skill using identical prompts, model settings and repository commit.
3. Blind-review outputs for task completion, accessibility, error recovery, consistency and maintainability (0–4 each).
4. Run Playwright, axe-core and project tests; record pass/fail/NOT_RUN.
5. Measure regression rate, rework time and token/cost overhead. Repeat with multiple seeds/runs.
6. Require no critical security regression and no blocked primary task before production rollout.

No benchmark has been executed as part of this pack creation.
