# AIMS Legacy Data Quality Report

## Current status

`NOT READY — APPROVED SPREADSHEET RUNTIME UNAVAILABLE`

Both originals remain unchanged. No workbook values were echoed, copied, imported or written to Firebase. Exact checks for blank rows, duplicate codes/serials/MAC addresses, invalid dates, missing references and ambiguous users cannot be reported until the required `@oai/artifact-tool` runtime is available.

The implemented dry-run normalizer is ready to classify extracted records as `VALID`, `VALID_WITH_WARNING`, `ERROR`, `AMBIGUOUS`, `DUPLICATE`, `SKIPPED`, or `EXCLUDED_SENSITIVE_FIELD`. Sensitive administrator-password columns are removed before normalized output is constructed.
