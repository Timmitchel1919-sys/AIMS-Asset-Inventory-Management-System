# Production UX quality gates

## Mandatory gates
1. Intent: primary task, audience, evidence and success criterion documented.
2. Information: critical content and primary action findable; destructive actions separated.
3. States: all applicable loading/empty/partial/error/success/offline/permission states handled.
4. Forms: accessible labels, server validation, actionable errors, retry without data loss.
5. Feedback: honest async status, keyboard focus, confirmation proportional to risk.
6. Design: canonical semantic tokens, component consistency, documented variants.
7. Visual: recognizable but usable, sufficient contrast, reduced motion.
8. Responsive: task parity across mobile and desktop, no critical clipping.
9. Audit: reproducible findings and actual test evidence.

## Gate outcomes
PASS = verified with evidence; FAIL = verified violation; NOT_RUN = verification unavailable; NOT_APPLICABLE = justified absence. Do not collapse NOT_RUN into PASS.

## Suggested tools (not included)
Playwright, axe-core, Storybook, ESLint, TypeScript, screenshot diff tools, unit test runner. Automated accessibility checks are incomplete and require manual review.
