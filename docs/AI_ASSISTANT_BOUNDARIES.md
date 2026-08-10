# AI Assistant Boundaries

## Wave 9 final-audit addendum

The deterministic provider remains local, read-only and mutation-blocking. Fine-grained record/sensitive-field filters, persistent owner-scoped history, retention and trusted provider execution are prerequisites for any later real provider.

Validation date: 2026-07-31

The assistant uses `DeterministicMockAiProvider`; it performs no HTTP request and imports no provider SDK. Responses are reproducible from the current mock repository snapshot.

Implemented boundaries:

- Read-only provider contract.
- Mutation language is detected before informational intent matching.
- Mutation requests return a refusal and workflow link without calling the repository.
- Supported results require the relevant module read permission.
- Citations are internal references drawn from returned mock records.
- Unsupported or unauthorized requests reveal no citations.
- English and Dutch response variants.
- Visible mock-data, no-external-AI, human-review and read-only notices.

Not yet complete:

- Fine-grained department/location/ownership and sensitive-field filters.
- Persisted conversation history, saved results, feedback and AI activity events.
- Full required intent catalog and route-link filtering.
- Retention enforcement and management-summary/export permissions.

No API keys or real provider configuration are stored.
