---
description: Restyle existing UI without changing its behavior
---

# /restyle

## Mission
Produce a coherent, production-quality visual redesign of existing screens while retaining behavior and project identity.

## Workflow
1. Inventory routes, layouts, shared components, CSS/theme files, tokens, assets, breakpoints and interactive states. Identify the framework and styling conventions.
2. Establish the current visual baseline from code and, only if tools allow, actual rendered screenshots at representative viewports. Do not claim to have seen the UI from code alone.
3. Perform a focused UX audit: hierarchy, density, navigation, affordances, feedback, error states, forms, contrast, keyboard access, touch targets and responsiveness.
4. Define visual direction: style keywords, reference constraints, layout grid, spacing, surfaces, elevation, border/radius system, icons and motion principles. Treat Dark Bento, Liquid Glass and other aesthetics as optional user preferences, not universal defaults.
5. Apply **color-design** and **typography-design** disciplines within this workflow: propose semantic color tokens and a typographic scale; these are design tasks, not automatic execution of other slash commands.
6. Provide before/after design specification per affected page, component inventory, state matrix (default/hover/focus/active/disabled/loading/empty/error/success), and responsive behavior.
7. Create a phased file-by-file implementation plan; identify safe visual-only edits versus behavior-impacting changes. Request approval.
8. Only after approval, implement minimally invasive changes through authorized tools. Reuse shared components and tokens, avoid duplicated overrides and unnecessary dependencies.
9. Verify build/lint/tests where authorized, keyboard navigation, reduced motion, mobile overflow, contrast and key user journeys. Compare screenshots if a rendering tool exists; record what was actually tested.

## Deliverables
- Visual direction and token proposals (colors, typography, spacing, radii, shadows, motion).
- Page/component restyle matrix and design-system compatibility notes.
- Concrete implementation plan, approval gate and post-change regression report.

## Acceptance criteria
The redesigned UI is consistent across states and viewports; critical workflows remain intact; no security or data-layer modifications; all reported validation is evidenced.

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
