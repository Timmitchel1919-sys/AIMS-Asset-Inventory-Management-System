# /ux-design — workflow specification

This document defines a workflow; it is not a registered slash command until installed in the coding agent's command system.

## Required skills
- `intent-discovery`
- `information-hierarchy`
- `state-completeness`
- `form-ux`
- `feedback-affordance`
- `design-system`
- `visual-character`
- `responsive`

## Steps
1. Parse target routes/components, scope and mode (`plan`, `audit`, `implement`, `fix`). Default to `plan`.
2. Read existing project design files and relevant skills; document evidence and assumptions.
3. Produce a proposed change set with accessibility, risk and rollback considerations.
4. Request authorization before making changes outside an approved scope or taking destructive actions.
5. Implement only approved changes; run unit, integration, browser and accessibility checks where available.
6. Deliver file-level summary, evidence, test results (including NOT_RUN) and unresolved risks.

## Output contract
Use the template in `templates/` best matching the task. Cite source file paths and line numbers when possible. Never assert passing tests that were not executed.
