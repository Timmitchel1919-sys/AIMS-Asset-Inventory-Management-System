---
description: Create responsive multilingual typography systems
---

# /typography-design

## Mission
Build a readable, consistent, performant typography system that reflects product identity.

## Workflow
1. Inspect existing fonts, licensing constraints, languages/scripts, typography tokens, component library and performance setup.
2. Identify UI contexts: headings, body, data tables, numeric financial displays, forms, labels, buttons, navigation, captions and code.
3. Propose up to five purposeful font pairings (including safe system fallbacks), explain tone and distinguish display from body usage. Verify license and language coverage before recommending deployment; do not claim verification without evidence.
4. Define a modular scale with H1-H6, body sizes, labels, captions, button text and dense-data variants; include font size, weight, line height, letter spacing and responsive adjustments.
5. Prefer rem/em and fluid clamp() where appropriate; preserve text zoom and avoid fixed heights that clip content.
6. Address multilingual coverage, diacritics, long words, numerals, tabular figures, RTL only when relevant, and fallback rendering.
7. Optimize loading with limited weights, variable fonts where appropriate, font-display strategy, subsetting only if language coverage remains intact, and measurable CLS/LCP considerations.
8. Supply semantic typography tokens and example CSS/Tailwind mappings matching the project's actual framework.
9. Test hierarchy, readability, wrapping, mobile widths, 200% zoom and component states when tooling exists. Request approval before changes.

## Deliverables
- Font pairing recommendations with licensing/coverage status.
- Responsive type-scale matrix and component usage rules.
- Token definitions, font-loading strategy, implementation plan and validation checklist.

## Mandatory operating contract
- Treat the current repository as the only project in scope unless the user explicitly identifies another.
- Read applicable repository instructions (AGENTS.md, README, design system, package manifest, existing tokens and components). Never assume a stack.
- Inspect before proposing changes. If repository access or visual tools are unavailable, say what was not verified; never invent findings, screenshots, test results, or implementation status.
- Default to **analysis and proposal only**. Do not edit, install dependencies, execute mutating shell commands, generate files, or change configuration until the user explicitly approves a defined implementation scope. Prior approval for another task does not carry over.
- Follow stricter repository/agent permissions. Never bypass denied shell/edit permissions or security controls. If the current agent cannot edit, prepare an actionable handoff for an authorized implementation agent.
- Preserve business logic, APIs, routes, authentication, authorization, Firebase rules, data models, integrations, analytics and existing user data unless explicitly in scope. UI hiding is never access control.
- Never access or expose secrets. Do not alter production resources, deploy, commit, push, merge, or open PRs without separate explicit authorization.
- Favor accessible, responsive, performant, maintainable solutions. Target WCAG 2.2 AA where applicable; verify rather than claim compliance.
- Distinguish observed facts, assumptions, proposals and verified results. Show exact files expected to change, risks, rollback approach, and test plan before implementation.
- If the request is underspecified, make conservative design assumptions and list them; ask only about decisions that materially affect scope or safety.

## Input
User request: $ARGUMENTS
If no arguments are supplied, infer the current project from the working directory and ask which page, component, or scope should be addressed if it cannot be determined safely.

## Standard response structure
1. Scope and current-state evidence (files inspected; tools available/unavailable).
2. Findings and prioritized recommendations with rationale.
3. Proposed design specifications and affected files.
4. Accessibility, responsive, performance, security and regression considerations.
5. Approval checkpoint: exact changes proposed; stop before edits.
6. After separately approved implementation: actual file changes, commands/tests executed and their outcomes, remaining limitations and rollback guidance.
