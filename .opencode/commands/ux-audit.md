---
description: Audit usability, accessibility and responsive UX
---

# /ux-audit

## Mission
Perform an evidence-based UX audit without modifying the product.

## Audit dimensions
- Information architecture, navigation, findability and task completion.
- Hierarchy, scanning, readability, terminology and cognitive load.
- Forms, validation, errors, recovery, confirmations and destructive actions.
- Interactive feedback, loading, empty/offline states and consistency.
- Responsive layout, mobile touch ergonomics and content overflow.
- Accessibility: semantic structure, labels, keyboard/focus, contrast, zoom/reflow, screen-reader considerations and reduced motion.
- Performance-related UX: layout shift, loading indicators, image/font loading and perceived latency.
- Trust and safety UX: sensitive-action confirmations, privilege cues and disclosure of consequential operations.

## Workflow
1. Identify target personas, core tasks and relevant routes from evidence; label unconfirmed assumptions.
2. Review actual code and design tokens; use browser, screenshots, accessibility scanners and task walkthroughs only when available and authorized.
3. Log each issue with: ID, location/file, observed evidence, user impact, severity (Critical/High/Medium/Low), confidence, relevant guideline and recommended fix.
4. Separate directly verified issues from likely risks requiring manual testing.
5. Prioritize by severity, frequency, task criticality and implementation effort; distinguish quick wins from structural improvements.
6. Recommend measurable success criteria and a retest plan. Stop before editing.

## Deliverables
- Executive summary with evidence coverage and limitations.
- Severity-ranked issue register; task-flow findings and accessibility checklist.
- Prioritized remediation roadmap with owners/effort estimates if supportable.
- Explicit note: automated checks do not establish complete WCAG compliance.

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
