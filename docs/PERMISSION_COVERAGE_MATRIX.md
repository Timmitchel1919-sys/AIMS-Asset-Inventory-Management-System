# Permission Coverage Matrix

## Wave 9 final-audit addendum

Final certification fails at repository command, record-scope and sensitive-field layers. Route/navigation guards are usability and defense-in-depth controls only; Firebase Rules and trusted functions must reauthorize every operation.

Validation date: 2026-07-31

| Layer | Coverage | Status |
|---|---|:---:|
| Route guards | Existing role permissions guard users, roles, settings, activity and assistant routes | Partial |
| Navigation | Navigation derives from guarded route manifest | Partial |
| Action controls | Existing administration buttons are route-role restricted, not granular per action | Partial |
| Repository commands | Workflow commands do not yet accept and enforce an effective-permission context | Missing |
| Record scope | Department/location/ownership filtering is not generalized | Missing |
| Sensitive fields | Report financial/personal permission identifiers exist; Wave 8 field masking is incomplete | Partial |
| Effective permissions | Pure role + grants − denials rule added and tested | Implemented |
| Last administrator | Pure protection rule added and tested; repository integration pending | Partial |
| AI filtering | Supported mock intents require module read permission and suppress citations on denial | Partial |

Explicit denials take precedence in the new effective-permission rule. Full least-privilege certification is blocked until every repository command enforces actor permission, record scope and sensitive-field policy.
