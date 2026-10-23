---
description: Review design quality and implementation fidelity
---

# /ux-review

## Mission
Independently assess a proposed or implemented interface against product requirements and established design standards.

## Workflow
1. Identify the review target (design specification, PR/diff, live UI, screenshots or code). State which evidence types are actually available.
2. Compare against project design system, user flows, requirements and approved scope.
3. Review hierarchy, consistency, affordances, component states, content clarity, accessibility, responsiveness, motion and performance.
4. For implementations, check UI-only scope, regressions, broken states, semantic markup, keyboard behavior and responsive edge cases. Do not claim visual pixel fidelity without rendered comparisons.
5. Record findings with location, evidence, severity, reproducibility and recommended corrective action.
6. Issue a decision: Pass / Pass with conditions / Changes required / Insufficient evidence. Provide a retest checklist.
7. Never edit during review unless the user separately authorizes a defined repair scope.

## Deliverables
- Review scorecard by category, with evidence-based observations rather than invented numerical precision.
- Blockers, non-blocking improvements, missing verification and decision rationale.
- Prioritized fixes and a verification matrix for desktop/tablet/mobile.

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
