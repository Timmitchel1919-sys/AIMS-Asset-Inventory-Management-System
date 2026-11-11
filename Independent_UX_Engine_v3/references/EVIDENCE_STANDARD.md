# Evidence and severity standards

Evidence labels: OBSERVED (direct code or tool inspection), USER-STATED (user requirement), INFERRED (reasoned but unverified), UNKNOWN (missing). Each critical recommendation should cite a route, file:line, screenshot, test output or user statement.

Audit finding fields: id, title, task, severity, impact, likelihood, scope, evidence, reproduction, root_cause, recommendation, acceptance_criteria, verification_status.

Severity:
- BLOCKER: prevents critical task or creates immediate high-risk data/security harm.
- HIGH: significantly blocks common tasks, excludes users, or risks data loss.
- MEDIUM: causes substantial friction or recoverable errors.
- LOW: minor clarity or consistency issue.
- INFO: preference or opportunity, not a verified defect.

Do not assign severity from aesthetics alone. Mark unverifiable findings as hypotheses.
