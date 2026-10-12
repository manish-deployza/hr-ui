/* Per-review state machine - see 18-appraisal-enterprise-expansion.md's
 * Appraisal state machine. Pure predicates only (no DOM/network), used by
 * js/api/hr-appraisal-cycles.js and js/api/appraisal-view.js to decide
 * which action buttons a given status allows, and by js/status-badge.js's
 * APPRAISAL_STATUS_BADGE_MAP for display.
 *
 *   SELF_APPRAISAL -> MANAGER_REVIEW -> HR_REVIEW -> CALIBRATION ->
 *   FINALIZED -> ACKNOWLEDGED -> CLOSED
 *
 * Branches off that chain: RETURNED (HR_REVIEW -> manager re-edits ->
 * back to HR_REVIEW), REOPENED (from FINALIZED/ACKNOWLEDGED/CLOSED, back to
 * FINALIZED once corrected), CANCELLED (terminal, from any non-terminal
 * status). SELF_SUBMITTED and MANAGER_SUBMITTED from the source spec are
 * modeled as instantaneous - see mock-data.js's self-review/manager-review
 * handlers - so they're never a stored status.
 */

const APPRAISAL_TERMINAL_STATUSES = ["CLOSED", "CANCELLED"];

function isTerminalAppraisalStatus(status) {
  return APPRAISAL_TERMINAL_STATUSES.indexOf(status) !== -1;
}

// Cancelling a done review doesn't make sense - only while it's still
// actively moving through the chain (including a HR-returned review).
function canCancelAppraisal(status) {
  return ["SELF_APPRAISAL", "MANAGER_REVIEW", "HR_REVIEW", "CALIBRATION", "RETURNED"].indexOf(status) !== -1;
}

function canReopenAppraisal(status) {
  return ["FINALIZED", "ACKNOWLEDGED", "CLOSED"].indexOf(status) !== -1;
}

// Calibration ("HR can also compare... with a required reason/comment for
// changing the rating", 18-appraisal-enterprise-expansion.md) only demands
// a reason when HR's number actually differs from the manager's - leaving
// it untouched (or re-entering the same value) needs no justification.
function calibrationNeedsReason(managerScore, calibratedScore) {
  if (calibratedScore == null || managerScore == null) return false;
  return Math.abs(calibratedScore - managerScore) > 0.005;
}

if (typeof module !== "undefined")
  module.exports = {
    APPRAISAL_TERMINAL_STATUSES,
    isTerminalAppraisalStatus,
    canCancelAppraisal,
    canReopenAppraisal,
    calibrationNeedsReason,
  };
