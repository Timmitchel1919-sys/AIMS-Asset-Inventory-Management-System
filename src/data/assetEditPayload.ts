import type { WorkflowCommand } from "./contracts";

/**
 * Firestore Rules intentionally keep official asset identifiers immutable.
 * React Hook Form keeps read-only identity values in the edit form, so they
 * must never be sent as part of an ordinary asset update. Code corrections use
 * the audited Callable Function before this normal update is persisted.
 */
export function editableAssetValues(
  values: NonNullable<WorkflowCommand["values"]>,
) {
  const {
    code,
    codePrefix,
    codeNumber,
    previousCodes,
    codeCorrection,
    correctionReason,
    ...editable
  } = values;
  return editable;
}
